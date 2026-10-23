-- حفظ اللاعب: الفلوس وهبالي القاعدة.
-- - كل الكتابة بـ UpdateAsync، والسجل عليه "قفل جلسة" باسم السيرفر عشان سيرفرين ما يكتبون نفس اللاعب.
-- - لو القفل حق سيرفر ثاني وجديد، ننتظر ونعيد. ولو قديم مرة (السيرفر طاح) ناخذه.
-- - لو خسرنا القفل وقت اللعب (سيرفر ثاني أخذه) ما نكتب فوقه، ونطلّع اللاعب.
-- - في Studio نستخدم مخزن منفصل، ولو API Services مقفلة نشتغل بذاكرة مؤقتة بدون حفظ.

local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local BaseRules = require(Shared:WaitForChild("BaseRules"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local DataService = {}

local rules = BaseRules.new(BaseConfig, HabaliConfig, MapConfig)
local dataConfig = BaseConfig.Data
-- اسم السيرفر للقفل (في Studio الـ JobId فاضي)
local JOB_ID = if game.JobId ~= "" then game.JobId else "studio-" .. HttpService:GenerateGUID(false)

local storeName = dataConfig.StoreName .. (if RunService:IsStudio() then "_Studio" else "")
local store: DataStore? = nil
local memoryOnly = false
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(storeName)
	end)
	if ok then
		store = result
	else
		memoryOnly = true
		warn("[Data] DataStore مو متاح (فعّل API Services في Studio). الحفظ متوقف بهالجلسة:", result)
	end
end

export type Profile = {
	Player: Player,
	Record: BaseRules.Record,
	Loaded: boolean,
	Released: boolean,
	Dirty: boolean,
	Leaving: boolean?,
}

local profiles: { [Player]: Profile } = {}
local loadedSignal = Instance.new("BindableEvent")

local function keyFor(player: Player): string
	return "player_" .. tostring(player.UserId)
end

-- كتابة واحدة: تتأكد إن القفل حقنا قبل ما تكتب. release = نشيل القفل (اللاعب طالع)
local function write(profile: Profile, release: boolean): boolean
	if memoryOnly or not store then
		return true
	end
	local record = profile.Record
	local lostLock = false
	local ok, result = pcall(function()
		return store:UpdateAsync(keyFor(profile.Player), function(old)
			local current = rules.Migrate(old)
			if current == nil then
				return nil -- نسخة أجدد أو شكل غريب: ما نكتب فوقها
			end
			if current.session and current.session.job ~= JOB_ID then
				lostLock = true
				return nil -- سيرفر ثاني ماسك اللاعب: ما نكتب
			end
			-- حفظ دوري تأخر لين بعد ما طلع اللاعب: ما نرجّع القفل (وإلا السيرفر الجاي ينتظر)
			if not release and profile.Released then
				return nil
			end
			return {
				version = dataConfig.Version,
				money = record.money,
				base = record.base,
				gear = record.gear,
				fuel = record.fuel,
				jerries = record.jerries,
				tutorial = record.tutorial,
				playtime = record.playtime,
				session = if release then nil else { job = JOB_ID, time = os.time() },
			}
		end)
	end)
	if not ok then
		warn("[Data] فشل الحفظ لـ", profile.Player.Name, result)
		return false
	end
	if lostLock then
		warn("[Data] سيرفر ثاني أخذ جلسة", profile.Player.Name)
		profile.Released = true
		if profile.Player.Parent then
			profile.Player:Kick("دخلت من مكان ثاني. ارجع للعبة من جديد")
		end
		return false
	end
	profile.Dirty = false
	return result ~= nil
end

-- تحميل مع القفل: يعيد المحاولة لو سيرفر ثاني ماسكه
local function load(player: Player): BaseRules.Record?
	if memoryOnly or not store then
		return rules.NewRecord()
	end
	for attempt = 1, dataConfig.LoadRetries do
		local taken: BaseRules.Record? = nil
		local busy = false
		local ok, err = pcall(function()
			store:UpdateAsync(keyFor(player), function(old)
				local record = rules.Migrate(old)
				if record == nil then
					return nil
				end
				if not rules.CanTakeSession(record, JOB_ID, os.time()) then
					busy = true
					return nil
				end
				record.session = { job = JOB_ID, time = os.time() }
				taken = record
				return record
			end)
		end)
		if ok and taken then
			return taken
		end
		if ok and not busy then
			warn("[Data] سجل", player.Name, "نسخته أجدد من اللعبة أو تالف، ما نلمسه")
			return nil
		end
		if not ok then
			-- Studio بدون إذن API: نكمّل بذاكرة مؤقتة عشان نقدر نجرب
			if RunService:IsStudio() and tostring(err):find("API") then
				memoryOnly = true
				warn("[Data] Studio ما عنده إذن API Services: الحفظ متوقف بهالجلسة")
				return rules.NewRecord()
			end
			warn("[Data] فشل التحميل (محاولة " .. attempt .. ")", err)
		end
		if not player.Parent then
			return nil
		end
		task.wait(dataConfig.LoadRetryWait)
	end
	return nil
end

local function onPlayerAdded(player: Player)
	local record = load(player)
	if not player.Parent then
		return -- طلع وهو يحمّل (القفل يصير قديم ويتحرر لحاله)
	end
	if not record then
		player:Kick("ما قدرنا نحمّل بياناتك، جرّب بعد شوي")
		return
	end
	local profile: Profile = { Player = player, Record = record, Loaded = true, Released = false, Dirty = false }
	profiles[player] = profile
	player:SetAttribute("Money", record.money)
	loadedSignal:Fire(player, profile)
end

local function release(player: Player)
	local profile = profiles[player]
	if not profile or profile.Released then
		return
	end
	profile.Released = true
	write(profile, true)
	profiles[player] = nil
end

-- ===== للأنظمة الثانية =====

-- ينادي الدالة لكل لاعب أول ما تتحمّل بياناته (وللي تحمّلوا قبل)
function DataService.OnLoaded(callback: (Player, Profile) -> ())
	loadedSignal.Event:Connect(callback)
	for player, profile in profiles do
		task.spawn(callback, player, profile)
	end
end

function DataService.Get(player: Player): Profile?
	local profile = profiles[player]
	if profile and not profile.Released then
		return profile
	end
	return nil
end

-- قبل ما يطلع اللاعب: الأنظمة الثانية تحدّث السجل هنا (مثلاً تنزّل الحمولة في القاعدة)
local beforeRelease: { (Player, Profile) -> () } = {}
function DataService.BeforeRelease(callback: (Player, Profile) -> ())
	table.insert(beforeRelease, callback)
end

-- مرة وحدة بس لكل لاعب: لما السيرفر يقفل ينادي BindToClose و PlayerRemoving الاثنين،
-- ولو انعادت الحمولة تنحسب مرتين وتتكرر في القاعدة
local function runBeforeRelease(player: Player, profile: Profile)
	if profile.Leaving then
		return
	end
	profile.Leaving = true
	for _, callback in beforeRelease do
		pcall(callback, player, profile)
	end
end

function DataService.AddMoney(player: Player, amount: number): boolean
	local profile = DataService.Get(player)
	if not profile or amount ~= amount or math.abs(amount) == math.huge then
		return false
	end
	local record = profile.Record
	record.money = math.clamp(math.floor(record.money + amount), 0, dataConfig.MaxMoney)
	profile.Dirty = true
	player:SetAttribute("Money", record.money)
	return true
end

-- يصرف من فلوسه لو تكفي. يرجّع false (وما ينقص شي) لو ما تكفي
function DataService.Spend(player: Player, amount: number): boolean
	local profile = DataService.Get(player)
	if not profile or amount ~= amount or amount < 0 or math.abs(amount) == math.huge then
		return false
	end
	local record = profile.Record
	if record.money < amount then
		return false
	end
	record.money -= math.floor(amount)
	profile.Dirty = true
	player:SetAttribute("Money", record.money)
	return true
end

function DataService.MarkDirty(player: Player)
	local profile = profiles[player]
	if profile then
		profile.Dirty = true
	end
end

function DataService.IsMemoryOnly(): boolean
	return memoryOnly
end

function DataService.Start()
	-- في Studio نتأكد إن الحفظ مسموح قبل لا نبدأ (لو API Services مقفلة نشتغل بدون حفظ ونقول)
	if RunService:IsStudio() and store and not memoryOnly then
		local ok, err = pcall(function()
			return (store :: DataStore):GetAsync("probe")
		end)
		if not ok then
			memoryOnly = true
			warn("[Data] الحفظ متوقف في Studio. فعّل: Game Settings ← Security ← Enable Studio Access to API Services. السبب:", err)
		end
	end
	Players.PlayerAdded:Connect(onPlayerAdded)
	for _, player in Players:GetPlayers() do
		task.spawn(onPlayerAdded, player)
	end
	Players.PlayerRemoving:Connect(function(player)
		local profile = profiles[player]
		if profile then
			runBeforeRelease(player, profile)
		end
		release(player)
	end)

	-- حفظ دوري للي تغيّرت بياناتهم (ويجدد وقت القفل)
	task.spawn(function()
		while true do
			task.wait(dataConfig.AutosaveSeconds)
			for _, profile in profiles do
				if not profile.Released then
					task.spawn(write, profile, false)
				end
			end
		end
	end)

	-- السيرفر يقفل: نحفظ الكل قبل ما يطفي
	game:BindToClose(function()
		local pending = 0
		for player, profile in profiles do
			pending += 1
			task.spawn(function()
				runBeforeRelease(player, profile)
				release(player)
				pending -= 1
			end)
		end
		local deadline = os.clock() + 25
		while pending > 0 and os.clock() < deadline do
			task.wait(0.1)
		end
	end)
end

return DataService
