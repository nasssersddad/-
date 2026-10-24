-- المرحلة 7ب على السيرفر: إعادة البداية، ومضاعف الدخل (الإعادات × العصابة)، والمطلوب الأول،
-- ومكافأة الدعوة، ولوحة الأبطال العالمية. كل شي يقرره السيرفر.
-- يكتب على اللاعب: Rebirths، IncomeMult، GangCount، MostWanted (للجوال وللقاعدة).

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local RivalsConfig = require(Shared:WaitForChild("RivalsConfig"))
local RivalsRules = require(Shared:WaitForChild("RivalsRules"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local Loadout = require(Server:WaitForChild("Shop"):WaitForChild("Loadout"))
local Gear = require(Server:WaitForChild("Catch"):WaitForChild("Gear"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local Alerts = require(Server:WaitForChild("Events"):WaitForChild("Alerts"))
local Friends = require(script.Parent:WaitForChild("Friends"))

local RivalsService = {}

local rules = RivalsRules.new(RivalsConfig)
local shopRules = Loadout.Rules

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function rebirthsOf(player: Player): number
	local profile = DataService.Get(player)
	local n = profile and profile.Record.rebirths
	return if type(n) == "number" then n else 0
end

local function setStat(player: Player, name: string, value: number)
	local stats = player:FindFirstChild("leaderstats")
	if not stats then
		return
	end
	local v = stats:FindFirstChild(name) :: IntValue?
	if not v then
		local made = Instance.new("IntValue")
		made.Name = name
		made.Parent = stats
		v = made
	end
	(v :: IntValue).Value = value
end

-- مضاعف الدخل: القاعدة تقراه من Attribute حق صاحبها
local function refreshMultiplier(player: Player)
	local friends = Friends.CountInServer(player)
	player:SetAttribute("GangCount", friends)
	player:SetAttribute("Rebirths", rebirthsOf(player))
	player:SetAttribute("IncomeMult", rules.IncomeMultiplier(rebirthsOf(player), friends))
	player:SetAttribute("RebirthPrice", rules.RebirthPrice(rebirthsOf(player)))
	setStat(player, "♻️", rebirthsOf(player))
end

local function refreshAll()
	for _, player in Players:GetPlayers() do
		if DataService.Get(player) then
			task.spawn(refreshMultiplier, player)
		end
	end
end

-- ===== إعادة البداية =====

local function onRebirth(player: Player)
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local rebirths = rebirthsOf(player)
	local price = rules.RebirthPrice(rebirths)
	if profile.Record.money < price then
		Net.Notify(player, "💸 تحتاج " .. formatMoney(price) .. " عشان تعيد البداية")
		return
	end
	-- تنمسح الفلوس والأسلحة وتطويرات السيارة، والهبالي يبقون
	DataService.Spend(player, profile.Record.money)
	profile.Record.rebirths = rebirths + 1
	for _, key in shopRules.Keys() do
		Loadout.SetLevel(player, key, 1)
	end
	profile.Dirty = true
	if player.Character then
		Gear.Refresh(player.Character, Loadout.Gear(player))
	end
	CarService.ApplyGear(player)
	refreshMultiplier(player)
	Alerts.Event(string.format("♻️ %s سوّى إعادة بداية رقم %d! دخله صار ×%.2f", player.DisplayName, rebirths + 1, player:GetAttribute("IncomeMult") or 1), "Legendary")
end

-- ===== المطلوب الأول =====

local currentWanted: Player? = nil

local function worthOf(player: Player): number
	local profile = DataService.Get(player)
	if not profile then
		return 0
	end
	local worth = profile.Record.money
	for _, entry in profile.Record.base do
		worth += shopRules.SellPrice(entry.r, entry.v)
	end
	return worth
end

local function setCrown(player: Player, on: boolean)
	player:SetAttribute("MostWanted", if on then true else nil)
	local head = player.Character and player.Character:FindFirstChild("Head")
	local tag = head and head:FindFirstChild("WantedTag")
	if on and head and not tag then
		local board = Instance.new("BillboardGui")
		board.Name = "WantedTag"
		board.Size = UDim2.fromOffset(170, 32)
		board.StudsOffsetWorldSpace = Vector3.new(0, 4.2, 0)
		board.MaxDistance = 200
		board.Adornee = head
		board.Parent = head
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundColor3 = Color3.fromRGB(180, 40, 40)
		label.BackgroundTransparency = 0.15
		label.TextScaled = true
		label.Font = Enum.Font.GothamBlack
		label.TextColor3 = Color3.fromRGB(255, 230, 120)
		label.Text = "👑 المطلوب الأول"
		label.Parent = board
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0.5, 0)
		corner.Parent = label
	elseif not on and tag then
		tag:Destroy()
	end
end

local function refreshWanted()
	local entries = {}
	for _, player in Players:GetPlayers() do
		if DataService.Get(player) then
			table.insert(entries, { id = player.UserId, worth = worthOf(player) })
		end
	end
	local id = rules.MostWanted(entries)
	local wanted = if id then Players:GetPlayerByUserId(id) else nil
	if wanted ~= currentWanted then
		if currentWanted and currentWanted.Parent then
			setCrown(currentWanted, false)
		end
		currentWanted = wanted
		if wanted then
			Alerts.Event("👑 " .. wanted.DisplayName .. " صار المطلوب الأول! اسرقه وخذ +20%", "Legendary")
		end
	end
	if wanted then
		setCrown(wanted, true) -- لو مات ورجع نرجّع التاج
	end
end

-- اللي سرق من المطلوب الأول: بونص (BaseService يناديها)
function RivalsService.OnSteal(thief: Player, victimUserId: number, entry: { r: string, v: string? })
	local victim = Players:GetPlayerByUserId(victimUserId)
	if victim and victim:GetAttribute("MostWanted") then
		local bonus = rules.MostWantedBonus(shopRules.SellPrice(entry.r, entry.v))
		if bonus > 0 then
			DataService.AddMoney(thief, bonus)
			Net.Notify(thief, "👑 سرقت من المطلوب الأول! بونص +" .. formatMoney(bonus) .. " 💰")
		end
	end
end

-- ===== الدعوة =====

local function checkInvite(player: Player)
	local profile = DataService.Get(player)
	if not profile or profile.Record.referral then
		return
	end
	-- لاعب جديد بس (أول جلسة)
	local isNew = not profile.Record.tutorial and (profile.Record.playtime or 0) < 60
	profile.Record.referral = true
	profile.Dirty = true
	if not isNew then
		return
	end
	local ok, joinData = pcall(function()
		return player:GetJoinData()
	end)
	local referrerId = ok and type(joinData) == "table" and joinData.ReferredByPlayerId or 0
	local referrer = if type(referrerId) == "number" and referrerId > 0 then Players:GetPlayerByUserId(referrerId) else nil
	if not referrer or not Friends.Are(player, referrer) then
		return
	end
	local refProfile = DataService.Get(referrer)
	if not refProfile then
		return
	end
	local given = refProfile.Record.inviteRewards or 0
	local reward = RivalsConfig.Gang.InviteReward
	DataService.AddMoney(player, reward)
	Net.Notify(player, "🤝 دخلت بدعوة " .. referrer.DisplayName .. "! +" .. formatMoney(reward) .. " 💰")
	if given < RivalsConfig.Gang.MaxInviteRewards then
		refProfile.Record.inviteRewards = given + 1
		refProfile.Dirty = true
		DataService.AddMoney(referrer, reward)
		Net.Notify(referrer, "🤝 " .. player.DisplayName .. " دخل من دعوتك! +" .. formatMoney(reward) .. " 💰")
	end
end

-- ===== لوحة الأبطال =====

local suffix = if RunService:IsStudio() then "_Studio" else ""
local richStore, rebirthStore
pcall(function()
	richStore = DataStoreService:GetOrderedDataStore(RivalsConfig.Leaderboard.RichStore .. suffix)
	rebirthStore = DataStoreService:GetOrderedDataStore(RivalsConfig.Leaderboard.RebirthStore .. suffix)
end)
local nameCache: { [number]: string } = {}

local function nameOf(userId: number): string
	if nameCache[userId] then
		return nameCache[userId]
	end
	local ok, name = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	nameCache[userId] = if ok and name then name else "؟"
	return nameCache[userId]
end

local boardLabels: { [string]: TextLabel } = {}

local function buildBoard()
	local map = Workspace:WaitForChild("Map")
	local old = map:FindFirstChild("Leaderboard")
	if old then
		old:Destroy()
	end
	local cfg = RivalsConfig.Leaderboard
	local base = MapConfig.BaseHeight
	local spot = Vector3.new(cfg.X, base, cfg.Z)
	local face = CFrame.lookAt(spot, Vector3.new(0, base, 0))
	local model = Instance.new("Model")
	model.Name = "Leaderboard"
	for _, x in { -6.5, 6.5 } do
		local post = Instance.new("Part")
		post.Anchored = true
		post.Size = Vector3.new(0.8, 14, 0.8)
		post.Color = Color3.fromRGB(90, 65, 40)
		post.Material = Enum.Material.Wood
		post.CFrame = face * CFrame.new(x, 7, 0)
		post.Parent = model
	end
	local panel = Instance.new("Part")
	panel.Name = "Panel"
	panel.Anchored = true
	panel.Size = Vector3.new(14, 9, 0.5)
	panel.Color = Color3.fromRGB(40, 32, 26)
	panel.CFrame = face * CFrame.new(0, 9.5, 0)
	panel.Parent = model
	for i, info in { { key = "Rich", title = "💰 أغنى 10" }, { key = "Rebirth", title = "♻️ أكثر إعادات" } } do
		local gui = Instance.new("SurfaceGui")
		gui.Face = if i == 1 then Enum.NormalId.Front else Enum.NormalId.Back
		gui.PixelsPerStud = 30
		gui.Parent = panel
		local title = Instance.new("TextLabel")
		title.Size = UDim2.fromScale(1, 0.14)
		title.BackgroundTransparency = 1
		title.TextScaled = true
		title.Font = Enum.Font.GothamBlack
		title.TextColor3 = Color3.fromRGB(255, 225, 120)
		title.Text = info.title
		title.Parent = gui
		local body = Instance.new("TextLabel")
		body.Size = UDim2.fromScale(0.94, 0.84)
		body.Position = UDim2.fromScale(0.03, 0.15)
		body.BackgroundTransparency = 1
		body.TextScaled = true
		body.Font = Enum.Font.GothamBold
		body.TextColor3 = Color3.new(1, 1, 1)
		body.TextXAlignment = Enum.TextXAlignment.Right
		body.TextYAlignment = Enum.TextYAlignment.Top
		body.Text = "..."
		body.Parent = gui
		boardLabels[info.key] = body
	end
	model.Parent = map
end

local function pushScores()
	for _, player in Players:GetPlayers() do
		local profile = DataService.Get(player)
		if profile and not DataService.IsMemoryOnly() then
			local money = math.floor(profile.Record.money)
			local rebirths = rebirthsOf(player)
			pcall(function()
				if richStore then
					richStore:SetAsync(tostring(player.UserId), money)
				end
				if rebirthStore and rebirths > 0 then
					rebirthStore:SetAsync(tostring(player.UserId), rebirths)
				end
			end)
		end
	end
end

local function readBoard(store: any, label: TextLabel?, format: (number) -> string)
	if not store or not label then
		return
	end
	local ok, pages = pcall(function()
		return store:GetSortedAsync(false, RivalsConfig.Leaderboard.Top)
	end)
	if not ok or not pages then
		return
	end
	local lines = {}
	for rank, item in pages:GetCurrentPage() do
		local userId = tonumber(item.key)
		table.insert(lines, string.format("%d. %s  %s", rank, if userId then nameOf(userId) else "؟", format(item.value)))
	end
	label.Text = if #lines > 0 then table.concat(lines, "\n") else "محد للحين"
end

function RivalsService.Start()
	DataService.OnLoaded(function(player)
		refreshAll()
		task.spawn(checkInvite, player)
		player.CharacterAdded:Connect(function()
			task.wait(1)
			if player == currentWanted then
				setCrown(player, true)
			end
		end)
	end)
	Players.PlayerRemoving:Connect(function(player)
		if player == currentWanted then
			currentWanted = nil
		end
		task.defer(refreshAll)
	end)
	Net.On("Rebirth", onRebirth)
	task.spawn(function()
		while true do
			task.wait(RivalsConfig.MostWanted.Refresh)
			pcall(refreshWanted)
		end
	end)
	task.spawn(buildBoard)
	task.spawn(function()
		task.wait(10)
		while true do
			pcall(pushScores)
			readBoard(richStore, boardLabels.Rich, function(v)
				return formatMoney(v) .. " 💰"
			end)
			readBoard(rebirthStore, boardLabels.Rebirth, function(v)
				return tostring(v) .. " ♻️"
			end)
			task.wait(RivalsConfig.Leaderboard.Refresh)
		end
	end)
end

return RivalsService
