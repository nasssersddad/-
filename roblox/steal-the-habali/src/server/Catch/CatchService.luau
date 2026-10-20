-- الصيد: العقال، ومسدس التنويم، والسحب، والتحميل في السيارة.
-- اللاعب يرسل "ضربت" أو "طلقت باتجاه كذا" بس. السيرفر يختار الهدف ويتحقق من المسافة
-- والتبريد والجدار، وهو اللي يقرر الدوخة والمقاومة.

local Players = game:GetService("Players")
local PhysicsService = game:GetService("PhysicsService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local CatchConfig = require(Shared:WaitForChild("CatchConfig"))
local CatchRules = require(Shared:WaitForChild("CatchRules"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))

local CatchService = {}

local catchRules = CatchRules.new(CatchConfig)
local random = Random.new()

local HABALI_GROUP = "Habali"
local PLAYERS_GROUP = "Players"

local rarityNames: { [string]: string } = {}
for _, zone in MapConfig.Zones do
	rarityNames[zone.Id] = zone.Rarity
end

type Drag = {
	Model: Model,
	Rarity: string,
	Hitbox: BasePart,
	Welds: { Instance }, -- لحام القطع على صندوق الصيد (يبقى لو انحط في السيارة)
	Rig: { Instance }, -- الحبل وغيره، ينمسح دايم
}

local dragging: { [Player]: Drag } = {}
local lastSwing: { [Player]: number } = {}
local lastShot: { [Player]: number } = {}

local function aliveCharacter(player: Player): (Model?, BasePart?, Humanoid?)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not character or not root or not humanoid or humanoid.Health <= 0 then
		return nil, nil, nil
	end
	return character, root, humanoid
end

local function hitboxOf(model: Model): BasePart?
	return model:FindFirstChild("Hitbox") :: BasePart?
end

-- ===== الضرب والتنويم =====

local function report(player: Player, result: string?)
	if result == "Stunned" then
		Net.Notify(player, "💫 دوّخته! قرّب واضغط اسحب")
	end
end

local function onSwing(player: Player)
	local now = os.clock()
	if lastSwing[player] and now - lastSwing[player] < CatchConfig.Melee.Cooldown then
		return
	end
	local _, root, humanoid = aliveCharacter(player)
	if not root or not humanoid or humanoid.Sit or dragging[player] then
		return
	end
	lastSwing[player] = now
	local range = CatchConfig.Melee.Range
	local nearby = HabaliService.GetNearby(root.Position, range + 4)
	local index = catchRules.PickMeleeTarget(root.Position, root.CFrame.LookVector, nearby, range)
	if index then
		local target = nearby[index]
		report(player, HabaliService.Damage(target.Model, "Melee", root.Position))
	end
end

local losParams = RaycastParams.new()
losParams.FilterType = Enum.RaycastFilterType.Include

local function onShoot(player: Player, aim: any)
	if not catchRules.IsValidDirection(aim) then
		return
	end
	local now = os.clock()
	if lastShot[player] and now - lastShot[player] < CatchConfig.Gun.Cooldown then
		return
	end
	local character, _, humanoid = aliveCharacter(player)
	local head = character and character:FindFirstChild("Head") :: BasePart?
	if not character or not head or not humanoid or humanoid.Sit or dragging[player] then
		return
	end
	lastShot[player] = now
	local direction = (aim :: Vector3).Unit
	local origin = head.Position
	local range = CatchConfig.Gun.Range
	local nearby = HabaliService.GetNearby(origin, range)
	local index = catchRules.PickGunTarget(origin, direction, nearby, range, CatchConfig.Gun.AimCone)
	local hitPoint = origin + direction * range
	if index then
		local target = nearby[index]
		-- الطلقة ما تمر من الرمل أو الجدران
		local map = Workspace:FindFirstChild("Map")
		losParams.FilterDescendantsInstances = if map then { Workspace.Terrain, map } else { Workspace.Terrain }
		local toTarget = target.Position - origin
		local blocked = Workspace:Raycast(origin, toTarget, losParams)
		if blocked and (blocked.Position - origin).Magnitude < toTarget.Magnitude - 3 then
			hitPoint = blocked.Position
		else
			hitPoint = target.Position
			report(player, HabaliService.Damage(target.Model, "Gun", origin))
		end
	end
	Net.FireAll("Shot", origin, hitPoint)
end

-- ===== السحب =====

local function setWalkSpeed(player: Player, speed: number)
	local _, _, humanoid = aliveCharacter(player)
	if humanoid then
		humanoid.WalkSpeed = speed
	end
end

-- يرجّع موديل الهبالي ثابت (Anchored) بعد ما كان فيزياء
local function anchorModel(model: Model)
	for _, part in model:GetDescendants() do
		if part:IsA("BasePart") then
			part.Anchored = true
			part.CanCollide = false
			part.Massless = false
			part.CollisionGroup = "Default"
		end
	end
end

local function clearDrag(player: Player, keepWelds: boolean?): Drag?
	local drag = dragging[player]
	if not drag then
		return nil
	end
	dragging[player] = nil
	for _, instance in drag.Rig do
		instance:Destroy()
	end
	if not keepWelds then
		for _, instance in drag.Welds do
			instance:Destroy()
		end
	end
	player:SetAttribute("Dragging", nil)
	drag.Model:SetAttribute("DraggedBy", nil)
	setWalkSpeed(player, CatchConfig.Drag.NormalWalkSpeed)
	return drag
end

-- يفلت: يرجع للصحراء دايخ شوي
local function drop(player: Player, message: string?)
	local drag = clearDrag(player)
	if not drag or not drag.Model.Parent then
		return
	end
	anchorModel(drag.Model)
	HabaliService.Return(drag.Model)
	if message then
		Net.Notify(player, message)
	end
end

local function startDrag(player: Player, model: Model, rarity: string, parts: { BasePart })
	local _, root = aliveCharacter(player)
	local hitbox = hitboxOf(model)
	if not root or not hitbox then
		return
	end
	local welds = {}
	-- كل القطع تنلحم على صندوق الصيد، وهو بس اللي يصطدم بالأرض
	for _, part in parts do
		if part ~= hitbox then
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = hitbox
			weld.Part1 = part
			weld.Parent = part
			table.insert(welds, weld)
			part.Massless = true
			part.CanCollide = false
		end
	end
	hitbox.CanCollide = true
	hitbox.CollisionGroup = HABALI_GROUP
	-- خفيف مرة وبدون احتكاك: البطء يجي من سرعة المشي حسب الندرة، مو من الفيزياء
	hitbox.CustomPhysicalProperties = PhysicalProperties.new(0.01, 0, 0, 100, 1)

	-- حبل من ظهر اللاعب لصدر الهبالي
	local back = Instance.new("Attachment")
	back.Name = "DragBack"
	back.Position = Vector3.new(0, 0, 1)
	back.Parent = root
	local front = Instance.new("Attachment")
	front.Name = "DragFront"
	front.Parent = hitbox
	local rope = Instance.new("RopeConstraint")
	rope.Attachment0 = back
	rope.Attachment1 = front
	rope.Length = CatchConfig.Drag.RopeLength
	rope.Visible = true
	rope.Thickness = 0.25
	rope.Color = BrickColor.new("Brown")
	rope.Parent = hitbox

	-- ينسحب وهو طايح على جنبه (دايخ)، والصندوق ما يتدحرج
	for _, part in parts do
		part.Anchored = false
	end
	hitbox:SetNetworkOwner(player)

	dragging[player] = { Model = model, Rarity = rarity, Hitbox = hitbox, Welds = welds, Rig = { back, front, rope } }
	player:SetAttribute("Dragging", model:GetAttribute("HabaliId"))
	model:SetAttribute("DraggedBy", player.UserId)
	setWalkSpeed(player, CatchConfig.Drag.WalkSpeed[rarity] or CatchConfig.Drag.NormalWalkSpeed)
	Net.Notify(player, "🪢 اسحبه لسيارتك واضغط: حطه في السيارة")
end

local function onGrab(player: Player, model: Model)
	local _, root, humanoid = aliveCharacter(player)
	local hitbox = hitboxOf(model)
	if not root or not humanoid or not hitbox or humanoid.Sit or dragging[player] then
		return
	end
	if (hitbox.Position - root.Position).Magnitude > CatchConfig.Drag.GrabDistance then
		return
	end
	if not HabaliService.IsStunned(model) then
		return
	end
	local rarity = model:GetAttribute("Rarity") :: string

	-- النادر مرة والأسطوري ممكن يصحى وينطحك
	if catchRules.ShouldResist(rarity, random:NextNumber()) then
		HabaliService.Wake(model, CatchConfig.Resist.HealthAfter)
		local away = root.Position - hitbox.Position
		away = Vector3.new(away.X, 0, away.Z)
		away = if away.Magnitude > 0.1 then away.Unit else root.CFrame.LookVector * -1
		local push = away * CatchConfig.Resist.KnockbackSpeed + Vector3.new(0, CatchConfig.Resist.KnockbackUp, 0)
		-- جسم اللاعب يتحكم فيه جواله، فالجوال يطبّق النطحة واللقطة البطيئة
		Net.Fire("Moment", player, hitbox.Position, push)
		Net.Notify(player, "😤 صحى ونطحك! دوّخه مرة ثانية")
		return
	end

	local parts = HabaliService.Take(model)
	if not parts then
		return
	end
	startDrag(player, model, rarity, parts)
end

-- ===== السيارة =====

local REASONS = {
	TooHeavy = "الربع ما تشيل %s! تحتاج سيارة أقوى",
	Full = "سيارتك مليانة",
}

local function onLoad(player: Player, car: any)
	local drag = dragging[player]
	local _, root = aliveCharacter(player)
	if not drag or not root or car.Owner ~= player then
		return
	end
	if (car.Bed.Position - root.Position).Magnitude > CatchConfig.Car.LoadDistance + 4 then
		return
	end
	local ok, reason = catchRules.CanLoad(car.Load, drag.Rarity, CatchConfig.Car.Capacity, #car.Cargo, CatchConfig.Car.Slots)
	if not ok then
		local text = REASONS[reason or ""] or "ما يدخل السيارة"
		Net.Notify(player, string.format(text, rarityNames[drag.Rarity] or drag.Rarity))
		return
	end
	local model = drag.Model
	clearDrag(player, true)
	-- يصير جزء من السيارة: بدون اصطدام ولا وزن (الوزن نحسبه نحن)
	for _, part in model:GetDescendants() do
		if part:IsA("BasePart") then
			part.Anchored = false
			part.CanCollide = false
			part.Massless = true
			part.CollisionGroup = "Default"
		end
	end
	HabaliService.Caught(model)
	CarService.AddCargo(car, model, drag.Rarity)
	Net.Notify(player, "✅ صار في سيارتك!")
end

-- يفلت لو مات، أو بعد عنه كثير، أو جلس
local function watchDrags()
	for player, drag in dragging do
		local _, root, humanoid = aliveCharacter(player)
		if not drag.Model.Parent then
			clearDrag(player)
		elseif not root or not humanoid then
			drop(player)
		elseif humanoid.Sit then
			drop(player, "فلت منك! لازم تحطه في السيارة وأنت برا")
		elseif (drag.Hitbox.Position - root.Position).Magnitude > CatchConfig.Drag.BreakDistance then
			drop(player, "انقطع الحبل وفلت منك")
		end
	end
end

-- ===== تجهيز =====

local function setupCollisionGroups()
	for _, group in { HABALI_GROUP, PLAYERS_GROUP } do
		if not PhysicsService:IsCollisionGroupRegistered(group) then
			PhysicsService:RegisterCollisionGroup(group)
		end
	end
	-- الهبالي المسحوب ما يدفّ اللاعبين (يمشي على الأرض بس)
	PhysicsService:CollisionGroupSetCollidable(HABALI_GROUP, PLAYERS_GROUP, false)
end

local function onCharacter(character: Model)
	for _, part in character:GetDescendants() do
		if part:IsA("BasePart") then
			part.CollisionGroup = PLAYERS_GROUP
		end
	end
	character.DescendantAdded:Connect(function(part)
		if part:IsA("BasePart") then
			part.CollisionGroup = PLAYERS_GROUP
		end
	end)
end

local function onPlayer(player: Player)
	if player.Character then
		onCharacter(player.Character)
	end
	player.CharacterAdded:Connect(onCharacter)
	player.CharacterRemoving:Connect(function()
		drop(player)
	end)
end

function CatchService.Start()
	setupCollisionGroups()
	for _, player in Players:GetPlayers() do
		onPlayer(player)
	end
	Players.PlayerAdded:Connect(onPlayer)
	Players.PlayerRemoving:Connect(function(player)
		drop(player)
		lastSwing[player] = nil
		lastShot[player] = nil
	end)

	Net.On("Swing", onSwing)
	Net.On("Shoot", onShoot)
	Net.On("Release", function(player)
		drop(player, "فلّته")
	end)
	HabaliService.SetGrabHandler(onGrab)
	CarService.SetLoadHandler(onLoad)

	task.spawn(function()
		while true do
			task.wait(0.25)
			watchDrags()
		end
	end)
end

-- للاختبار في Studio
CatchService._dragging = dragging

return CatchService
