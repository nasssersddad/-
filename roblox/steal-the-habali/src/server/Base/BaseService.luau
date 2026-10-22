-- القواعد: كل لاعب ياخذ قاعدة، ويحط هباليه على المنصات، وتجيب له دخل يجمعه من القاعدة.
-- القاعدة عليها درع لو صاحبها برا الديرة، وصاحبها يقدر يقفلها شوي. والحرامي يشيل من قاعدة
-- غيره (لو مفتوحة) أو من حوض سيارة واقفة، ولازم يحط المسروق في سيارته. والثأر 60 ثانية.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local BaseRules = require(Shared:WaitForChild("BaseRules"))
local CatchConfig = require(Shared:WaitForChild("CatchConfig"))
local CatchRules = require(Shared:WaitForChild("CatchRules"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local HabaliFactory = require(Server:WaitForChild("Habali"):WaitForChild("HabaliFactory"))
local HabaliModel = require(Server:WaitForChild("Habali"):WaitForChild("HabaliModel"))
local Carry = require(script.Parent:WaitForChild("Carry"))

local BaseService = {}

local rules = BaseRules.new(BaseConfig, HabaliConfig, MapConfig)
local catchRules = CatchRules.new(CatchConfig)

type Entry = BaseRules.Entry
type Plot = {
	Id: number,
	Model: Model,
	Floor: BasePart,
	Slots: { BasePart },
	Sign: TextLabel?,
	Owner: Player?,
	Entries: { [number]: Entry? },
	Displays: { [number]: Model },
	Pending: number,
	LockedUntil: number,
	PendingLabel: TextLabel,
	Shield: BasePart,
}

local plots: { Plot } = {}
local plotOf: { [Player]: Plot } = {}

local function now(): number
	return Workspace:GetServerTimeNow()
end

local function rootOf(player: Player): BasePart?
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root and humanoid and humanoid.Health > 0 then
		return root
	end
	return nil
end

local function isBusy(player: Player): boolean
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	return player:GetAttribute("Dragging") ~= nil or Carry.IsCarrying(player) or (humanoid ~= nil and humanoid.Sit)
end

-- ===== شكل القاعدة =====

local function newPart(name: string, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Material = material
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function newPrompt(parent: Instance, name: string, action: string, hold: number, distance: number): ProximityPrompt
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = name
	prompt.ActionText = action
	prompt.HoldDuration = hold
	prompt.MaxActivationDistance = distance
	prompt.RequiresLineOfSight = false
	prompt.Enabled = false -- الجوال يشغّله للي يحق له (والسيرفر يتحقق)
	prompt.Parent = parent
	return prompt
end

local function setSign(plot: Plot, text: string)
	if plot.Sign then
		plot.Sign.Text = text
	end
end

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

-- ===== المنصات =====

local function clearDisplay(plot: Plot, index: number)
	local display = plot.Displays[index]
	plot.Displays[index] = nil
	if display then
		display:Destroy()
	end
end

local stealFromBase: (Player, Plot, number) -> ()

local function showDisplay(plot: Plot, index: number)
	clearDisplay(plot, index)
	local entry = plot.Entries[index]
	local slot = plot.Slots[index]
	if not entry or not slot then
		return
	end
	local model = HabaliFactory.Build(entry)
	model.Name = "Display" .. index
	model:SetAttribute("PlotId", plot.Id)
	model:SetAttribute("SlotIndex", index)
	model:SetAttribute("Income", rules.IncomeOf(entry.r, entry.v))
	local top = slot.CFrame * CFrame.new(0, slot.Size.Y / 2, 0)
	model:PivotTo(top * CFrame.new(0, HabaliModel.RootHeight, 0))
	local hitbox = model:FindFirstChild("Hitbox") :: BasePart
	local prompt = newPrompt(hitbox, "StealPrompt", "اسرق 🦹", BaseConfig.Steal.BaseHold, BaseConfig.Steal.PromptDistance)
	prompt.ObjectText = HabaliFactory.DisplayName(entry)
	prompt.Triggered:Connect(function(player)
		stealFromBase(player, plot, index)
	end)
	-- الدخل تحت الاسم
	local label = model.PrimaryPart and model.PrimaryPart:FindFirstChild("Label")
	local status = label and label:FindFirstChild("Status") :: TextLabel?
	if status then
		status.Text = "+" .. formatMoney(rules.IncomeOf(entry.r, entry.v)) .. " 💰/ث"
	end
	model.Parent = plot.Model:FindFirstChild("Display") or plot.Model
	plot.Displays[index] = model
end

local function saveSlots(plot: Plot)
	local owner = plot.Owner
	local profile = owner and DataService.Get(owner)
	if profile then
		profile.Record.base = rules.RecordBase(plot.Entries)
		profile.Dirty = true
	end
end

-- يحط هبالي في أول منصة فاضية. يرجّع رقم المنصة أو nil لو مليانة
local function placeEntry(plot: Plot, entry: Entry): number?
	local index = rules.FirstFreeSlot(plot.Entries)
	if not index then
		return nil
	end
	plot.Entries[index] = entry
	showDisplay(plot, index)
	saveSlots(plot)
	return index
end

-- ===== الثأر =====

local function markRevenge(victimUserId: number, thief: Player)
	local victim = Players:GetPlayerByUserId(victimUserId)
	if victim and victim ~= thief then
		victim:SetAttribute("RevengeTarget", thief.UserId)
		victim:SetAttribute("RevengeUntil", now() + BaseConfig.Revenge.Time)
	end
end

-- آخر مرة أخذ فيها هاللاعب بونص ثأر من هالحرامي. بدونه اثنين ربع يسرقون من بعض
-- رايح جاي وياخذون البونص كل مرة (فلوس بلا نهاية)
local lastRevengeBonus: { [string]: number } = {}

-- لو هذا رجّع شي من اللي سرقه خلال الوقت: بونص (مرة وحدة لكل حرامي كل PairCooldown)
local function checkRevenge(player: Player, fromUserId: number, entry: Entry)
	if player:GetAttribute("RevengeTarget") == fromUserId and now() < (player:GetAttribute("RevengeUntil") or 0) then
		player:SetAttribute("RevengeTarget", nil)
		player:SetAttribute("RevengeUntil", nil)
		local pair = player.UserId .. ":" .. fromUserId
		local last = lastRevengeBonus[pair]
		if last and now() - last < BaseConfig.Revenge.PairCooldown then
			Net.Notify(player, "🎯 أخذت ثأرك!")
			return
		end
		lastRevengeBonus[pair] = now()
		local bonus = rules.RevengeBonus(entry)
		DataService.AddMoney(player, bonus)
		Net.Notify(player, "🎯 أخذت ثأرك! بونص +" .. formatMoney(bonus) .. " 💰")
	end
end

-- ===== السرقة =====

local function shieldedNow(plot: Plot): boolean
	local owner = plot.Owner
	local root = owner and rootOf(owner)
	local distance = if root then Vector2.new(root.Position.X, root.Position.Z).Magnitude else nil
	return rules.IsShielded(distance)
end

function stealFromBase(thief: Player, plot: Plot, index: number)
	local owner = plot.Owner
	local entry = plot.Entries[index]
	local display = plot.Displays[index]
	local root = rootOf(thief)
	if not owner or owner == thief or not entry or not display or not root or isBusy(thief) then
		return
	end
	if shieldedNow(plot) then
		Net.Notify(thief, "🛡️ القاعدة محمية، صاحبها برا الديرة")
		return
	end
	if rules.IsLocked(now(), plot.LockedUntil) then
		Net.Notify(thief, "🔒 القاعدة مقفلة")
		return
	end
	local hitbox = display:FindFirstChild("Hitbox") :: BasePart
	if (hitbox.Position - root.Position).Magnitude > BaseConfig.Steal.PromptDistance + 4 then
		return
	end
	if not Carry.Start(thief, entry, owner.UserId) then
		return
	end
	plot.Entries[index] = nil
	clearDisplay(plot, index)
	saveSlots(plot)
	markRevenge(owner.UserId, thief)
	local name = HabaliFactory.DisplayName(entry)
	Net.Notify(thief, "🦹 سرقت " .. name .. "! حطه في سيارتك وهرّب")
	Net.Notify(owner, "🚨 " .. thief.DisplayName .. " سرق " .. name .. " من قاعدتك! الحقه 🎯")
	checkRevenge(thief, owner.UserId, entry)
end

-- من حوض سيارة واقفة (محد سايقها)
local function stealFromCar(thief: Player, car: any)
	local root = rootOf(thief)
	if not root or car.Owner == thief or isBusy(thief) or car.Seat.Occupant ~= nil then
		return
	end
	if (car.Bed.Position - root.Position).Magnitude > CatchConfig.Car.LoadDistance + 4 then
		return
	end
	local model = car.Cargo[#car.Cargo]
	local entry = model and HabaliFactory.EntryOf(model)
	if not model or not entry then
		return
	end
	if not Carry.Start(thief, entry, car.Owner.UserId) then
		return
	end
	CarService.RemoveCargo(car, model)
	markRevenge(car.Owner.UserId, thief)
	local name = HabaliFactory.DisplayName(entry)
	Net.Notify(thief, "🦹 سرقت " .. name .. " من سيارة " .. car.Owner.DisplayName .. "!")
	Net.Notify(car.Owner, "🚨 " .. thief.DisplayName .. " سرق " .. name .. " من سيارتك! الحقه 🎯")
	checkRevenge(thief, car.Owner.UserId, entry)
end

-- اللي شايل مسروق انضرب لين طاح: الضارب ياخذه (ولو هو صاحبه الأصلي يرجع لقاعدته على طول)
function BaseService.CarrierKnockedOut(victim: Player, attacker: Player)
	local item = Carry.Take(victim)
	if not item then
		return
	end
	local name = HabaliFactory.DisplayName(item.Entry)
	local attackerPlot = plotOf[attacker]
	if attacker.UserId == item.FromUserId and attackerPlot and placeEntry(attackerPlot, item.Entry) then
		Net.Notify(attacker, "💪 رجّعت " .. name .. " لقاعدتك!")
		checkRevenge(attacker, victim.UserId, item.Entry)
	elseif not isBusy(attacker) and Carry.Start(attacker, item.Entry, victim.UserId) then
		Net.Notify(attacker, "🦹 أخذت " .. name .. " منه! حطه في سيارتك")
		markRevenge(victim.UserId, attacker)
		checkRevenge(attacker, victim.UserId, item.Entry)
	else
		-- الضارب مشغول: يرجع لصاحبه الأصلي لو يقدر، وإلا يرجع للي كان شايله
		local owner = Players:GetPlayerByUserId(item.FromUserId)
		local ownerPlot = owner and plotOf[owner]
		if not (ownerPlot and placeEntry(ownerPlot, item.Entry)) then
			Carry.Start(victim, item.Entry, item.FromUserId)
			return
		end
	end
	Net.Notify(victim, "😵 طيّحوه منك!")
end

-- اللي شايل مسروق يحطه في سيارته (من زر "حطه في السيارة")
function BaseService.LoadCarried(player: Player, car: any): boolean
	local item = Carry.Get(player)
	if not item then
		return false
	end
	local ok, reason = catchRules.CanLoad(car.Load, item.Entry.r, car.Capacity, #car.Cargo, #car.Slots)
	if not ok then
		Net.Notify(player, if reason == "TooHeavy" then "سيارتك ما تشيله! تحتاج سيارة أقوى" else "سيارتك مليانة")
		return true
	end
	Carry.Take(player)
	CarService.AddCargoEntry(car, item.Entry)
	Net.Notify(player, "✅ صار في سيارتك! نزّله في قاعدتك")
	return true
end

-- ===== أزرار صاحب القاعدة =====

local function onUnload(player: Player, plot: Plot)
	if plot.Owner ~= player then
		return
	end
	local car = CarService.GetCar(player)
	if not car or #car.Cargo == 0 then
		Net.Notify(player, "سيارتك فاضية")
		return
	end
	-- السيارة لازم تكون داخل القاعدة
	local localPos = plot.Floor.CFrame:PointToObjectSpace(car.Chassis.Position)
	local half = plot.Floor.Size.X / 2
	if math.abs(localPos.X) > half or math.abs(localPos.Z) > half then
		Net.Notify(player, "دخّل سيارتك داخل القاعدة أول")
		return
	end
	local placed = 0
	for i = #car.Cargo, 1, -1 do
		local model = car.Cargo[i]
		local entry = HabaliFactory.EntryOf(model)
		if entry and placeEntry(plot, entry) then
			CarService.RemoveCargo(car, model)
			placed += 1
		end
	end
	if placed == 0 then
		Net.Notify(player, "منصاتك مليانة!")
	else
		Net.Notify(player, "🏠 نزّلت " .. placed .. " هبالي في قاعدتك")
	end
end

local function onCollect(player: Player, plot: Plot)
	if plot.Owner ~= player then
		return
	end
	local amount = math.floor(plot.Pending)
	if amount <= 0 then
		return
	end
	if DataService.AddMoney(player, amount) then
		plot.Pending -= amount
		Net.Notify(player, "💰 +" .. formatMoney(amount))
	end
end

local function onLock(player: Player, plot: Plot)
	if plot.Owner ~= player then
		return
	end
	local t = now()
	if not rules.CanLock(t, plot.LockedUntil) then
		local wait = math.ceil(plot.LockedUntil + BaseConfig.LockCooldown - t)
		Net.Notify(player, "🔒 تقدر تقفلها بعد " .. wait .. " ثانية")
		return
	end
	plot.LockedUntil = t + BaseConfig.LockTime
	plot.Model:SetAttribute("LockedUntil", plot.LockedUntil)
	Net.Notify(player, "🔒 قفلت قاعدتك " .. BaseConfig.LockTime .. " ثانية")
end

-- ===== تجهيز القواعد =====

local function setupPlot(model: Model): Plot?
	local floor = model:FindFirstChild("Floor") :: BasePart?
	local slotFolder = model:FindFirstChild("Slots")
	local dropZone = model:FindFirstChild("DropZone") :: BasePart?
	if not floor or not slotFolder or not dropZone then
		return nil
	end
	local slots = {}
	for _, slot in slotFolder:GetChildren() do
		local index = slot:GetAttribute("SlotIndex")
		if slot:IsA("BasePart") and type(index) == "number" then
			slots[index] = slot
		end
	end
	local signPart = model:FindFirstChild("Sign")
	local signGui = signPart and signPart:FindFirstChildOfClass("SurfaceGui")
	local sign = signGui and signGui:FindFirstChildOfClass("TextLabel")

	local old = model:FindFirstChild("BaseKit")
	if old then
		old:Destroy()
	end
	local kit = Instance.new("Folder")
	kit.Name = "BaseKit"
	kit.Parent = model
	local display = model:FindFirstChild("Display") or Instance.new("Folder")
	display.Name = "Display"
	display.Parent = model

	local pivot = floor.CFrame
	local half = floor.Size.X / 2
	-- زر الجمع (يسار المدخل من جوا) وعليه الفلوس المتجمّعة
	local collectPad = newPart("CollectPad", Vector3.new(6, 0.4, 6), pivot * CFrame.new(-half + 7, 0.7, -half + 7), Color3.fromRGB(90, 220, 120), Enum.Material.Neon, kit)
	collectPad.CanCollide = false
	local board = Instance.new("BillboardGui")
	board.Name = "PendingBoard"
	board.Size = UDim2.fromOffset(160, 40)
	board.StudsOffsetWorldSpace = Vector3.new(0, 4, 0)
	board.MaxDistance = 120
	board.Adornee = collectPad
	board.Parent = collectPad
	local pendingLabel = Instance.new("TextLabel")
	pendingLabel.Size = UDim2.fromScale(1, 1)
	pendingLabel.BackgroundTransparency = 1
	pendingLabel.TextScaled = true
	pendingLabel.Font = Enum.Font.GothamBlack
	pendingLabel.TextColor3 = Color3.fromRGB(150, 255, 160)
	pendingLabel.TextStrokeTransparency = 0.2
	pendingLabel.Text = ""
	pendingLabel.Parent = board

	-- زر القفل (يمين المدخل من جوا)
	local lockButton = newPart("LockButton", Vector3.new(3, 3, 1), pivot * CFrame.new(half - 7, 2, -half + 4), Color3.fromRGB(220, 60, 60), Enum.Material.Neon, kit)
	lockButton.CanCollide = false

	-- الدرع على المدخل (شكل بس، والسرقة يمنعها السيرفر)
	local shield = newPart("Shield", Vector3.new(MapConfig.Plots.EntranceWidth, MapConfig.Plots.WallHeight + 2, 0.4), pivot * CFrame.new(0, 1 + MapConfig.Plots.WallHeight / 2, -half + 0.75), Color3.fromRGB(80, 180, 255), Enum.Material.ForceField, kit)
	shield.CanCollide = false
	shield.CanQuery = false
	shield.Transparency = 1

	local plot: Plot = {
		Id = model:GetAttribute("PlotId") or 0,
		Model = model,
		Floor = floor,
		Slots = slots,
		Sign = sign,
		Owner = nil,
		Entries = {},
		Displays = {},
		Pending = 0,
		LockedUntil = -1e9,
		PendingLabel = pendingLabel,
		Shield = shield,
	}

	newPrompt(dropZone, "UnloadPrompt", "نزّلهم في القاعدة 🏠", 0.3, 18).Triggered:Connect(function(player)
		onUnload(player, plot)
	end)
	newPrompt(collectPad, "CollectPrompt", "اجمع الفلوس 💰", 0, 10).Triggered:Connect(function(player)
		onCollect(player, plot)
	end)
	newPrompt(lockButton, "LockPrompt", "اقفل القاعدة 🔒", 0.5, 10).Triggered:Connect(function(player)
		onLock(player, plot)
	end)
	return plot
end

-- ===== اللاعبين =====

local function assignPlot(player: Player, profile: DataService.Profile)
	if plotOf[player] then
		return
	end
	local free: Plot? = nil
	for _, plot in plots do
		if plot.Owner == nil then
			free = plot
			break
		end
	end
	if not free then
		warn("[Base] ما فيه قاعدة فاضية لـ", player.Name)
		return
	end
	free.Owner = player
	free.Pending = 0
	free.LockedUntil = -1e9
	free.Entries = rules.SlotsFromRecord(profile.Record)
	free.Model:SetAttribute("OwnerUserId", player.UserId)
	free.Model:SetAttribute("LockedUntil", free.LockedUntil)
	setSign(free, "قاعدة " .. player.DisplayName)
	for index in free.Entries do
		showDisplay(free, index)
	end
	plotOf[player] = free
	player:SetAttribute("PlotId", free.Id)

	-- لوحة النتائج (فوق يمين في الكمبيوتر)
	local stats = player:FindFirstChild("leaderstats") or Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player
	local money = stats:FindFirstChild("فلوس") or Instance.new("IntValue")
	money.Name = "فلوس"
	money.Value = profile.Record.money
	money.Parent = stats
	player:GetAttributeChangedSignal("Money"):Connect(function()
		money.Value = player:GetAttribute("Money") or 0
	end)
	if DataService.IsMemoryOnly() then
		Net.Notify(player, "⚠️ الحفظ متوقف في هالتجربة (Studio بدون API)")
	end
end

-- قبل ما يطلع: الحمولة اللي في سيارته تنزل في قاعدته، والمسروق اللي شايله يرجع لصاحبه
local function beforeLeave(player: Player, profile: DataService.Profile)
	local plot = plotOf[player]
	local car = CarService.GetCar(player)
	if plot and car then
		-- ننقلها من السيارة للقاعدة (مو ننسخها)، عشان محد يسرقها من الحوض بعدين وتتكرر
		for i = #car.Cargo, 1, -1 do
			local model = car.Cargo[i]
			local entry = HabaliFactory.EntryOf(model)
			local index = rules.FirstFreeSlot(plot.Entries)
			if entry and index then
				plot.Entries[index] = entry
			end
			CarService.RemoveCargo(car, model)
		end
	end
	local item = Carry.Take(player)
	if item then
		local owner = Players:GetPlayerByUserId(item.FromUserId)
		local ownerPlot = owner and plotOf[owner]
		if ownerPlot then
			placeEntry(ownerPlot, item.Entry)
		elseif plot then
			-- صاحبه طلع: يبقى مع اللي سرقه
			local index = rules.FirstFreeSlot(plot.Entries)
			if index then
				plot.Entries[index] = item.Entry
			end
		end
	end
	if plot then
		profile.Record.base = rules.RecordBase(plot.Entries)
	end
end

local function freePlot(player: Player)
	local plot = plotOf[player]
	plotOf[player] = nil
	if not plot then
		return
	end
	for index in plot.Displays do
		clearDisplay(plot, index)
	end
	plot.Owner = nil
	plot.Entries = {}
	plot.Pending = 0
	plot.Model:SetAttribute("OwnerUserId", nil)
	plot.Shield.Transparency = 1
	plot.PendingLabel.Text = ""
	setSign(plot, "قاعدة فاضية")
end

-- كل ثانية: الدخل، والدرع، والقفل، وانتهاء الثأر
local function tick()
	local t = now()
	for _, plot in plots do
		local owner = plot.Owner
		if owner then
			plot.Pending = rules.AddPending(plot.Pending, rules.TotalIncome(plot.Entries), 1)
			plot.PendingLabel.Text = if plot.Pending >= 1 then "💰 " .. formatMoney(plot.Pending) else ""
			local shielded = shieldedNow(plot)
			local locked = rules.IsLocked(t, plot.LockedUntil)
			plot.Model:SetAttribute("Shielded", shielded)
			plot.Shield.Transparency = if shielded or locked then 0.35 else 1
			plot.Shield.Color = if locked then Color3.fromRGB(255, 70, 70) else Color3.fromRGB(80, 180, 255)
		end
	end
	for _, player in Players:GetPlayers() do
		local untilTime = player:GetAttribute("RevengeUntil")
		if untilTime and t >= untilTime then
			player:SetAttribute("RevengeTarget", nil)
			player:SetAttribute("RevengeUntil", nil)
		end
	end
end

function BaseService.GetPlot(player: Player): Plot?
	return plotOf[player]
end

function BaseService.Start()
	local map = Workspace:WaitForChild("Map")
	local plotFolder = map:WaitForChild("Plots")
	local models = plotFolder:GetChildren()
	table.sort(models, function(a, b)
		return (a:GetAttribute("PlotId") or 0) < (b:GetAttribute("PlotId") or 0)
	end)
	for _, model in models do
		if model:IsA("Model") then
			local plot = setupPlot(model)
			if plot then
				table.insert(plots, plot)
			end
		end
	end

	DataService.OnLoaded(assignPlot)
	DataService.BeforeRelease(beforeLeave)
	Players.PlayerRemoving:Connect(function(player)
		task.defer(freePlot, player) -- بعد ما ينحفظ
	end)
	-- لو مات وهو شايل: يرجع المسروق لصاحبه
	local function watchCharacter(player: Player)
		player.CharacterRemoving:Connect(function()
			local item = Carry.Take(player)
			if item then
				local owner = Players:GetPlayerByUserId(item.FromUserId)
				local ownerPlot = owner and plotOf[owner]
				if ownerPlot then
					placeEntry(ownerPlot, item.Entry)
				end
			end
		end)
	end
	Players.PlayerAdded:Connect(watchCharacter)
	for _, player in Players:GetPlayers() do
		watchCharacter(player)
	end

	CarService.SetStealHandler(stealFromCar)

	task.spawn(function()
		while true do
			task.wait(1)
			tick()
		end
	end)
end

return BaseService
