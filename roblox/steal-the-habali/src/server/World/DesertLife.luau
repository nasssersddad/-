-- المرحلة 5ب: حياة في البر.
--   أبو بعير (بدوي في الدهناء) يقولك وين أندر هبالي الحين.
--   أبو كشتة (الثمامة) يفتح لك اليومية (الجوال يفتح الشاشة، والاستلام نفسه يتحقق منه HooksService).
--   راعي الغنم يتمشى في النفود ومعه غنمه، ويعطيك نصيحة.
--   أبو مصلح بالونيت (حد النفود) يعبّي بنزين غالي، والسيرفر يحسب ويتحقق.
-- ومعهم خيام وبيار وصخور وسيارات خربانة على جنب الطرق.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local DesertConfig = require(Shared:WaitForChild("DesertConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local ShopConfig = require(Shared:WaitForChild("ShopConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))
local HooksService = require(Server:WaitForChild("Hooks"):WaitForChild("HooksService"))
local Loadout = require(Server:WaitForChild("Shop"):WaitForChild("Loadout"))
local Npc = require(script.Parent:WaitForChild("Npc"))

local DesertLife = {}

local spots: { [string]: Vector3 } = {} -- مكان كل شخصية (للتحقق من المسافة)
local lastAsk: { [Player]: number } = {}

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

-- ===== الأرض والقطع =====

local groundParams = RaycastParams.new()
groundParams.FilterType = Enum.RaycastFilterType.Include
groundParams.FilterDescendantsInstances = { Workspace.Terrain }

local function groundAt(x: number, z: number): number
	local hit = Workspace:Raycast(Vector3.new(x, MapConfig.MaxY + 50, z), Vector3.new(0, -(MapConfig.MaxY - MapConfig.MinY + 100), 0), groundParams)
	return if hit then hit.Position.Y else MapConfig.BaseHeight
end

-- مكان على الأرض يطالع نقطة (بنفس الارتفاع)
local function standAt(x: number, z: number, lookX: number, lookZ: number): CFrame
	local y = groundAt(x, z)
	return CFrame.lookAt(Vector3.new(x, y, z), Vector3.new(lookX, y, lookZ))
end

local function part(model: Instance, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material
	p.Shape = shape or Enum.PartType.Block
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = model
	return p
end

local function newModel(name: string, parent: Instance): Model
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local WOOD = Color3.fromRGB(110, 80, 50)
local TENT = Color3.fromRGB(45, 38, 34) -- بيت الشعر أسود
local RUG = Color3.fromRGB(160, 40, 40)
local CAMEL = Color3.fromRGB(196, 150, 96)
local WOOL = Color3.fromRGB(240, 236, 226)

-- ===== الأشياء =====

-- بيت شعر: سقف أسود واطي على أعمدة، وجدار ورا، وزولية
local function buildTent(at: CFrame, parent: Instance): Model
	local m = newModel("Tent", parent)
	part(m, Vector3.new(20, 0.2, 14), at * CFrame.new(0, 0.1, 0), RUG, Enum.Material.Fabric)
	for _, x in { -9, 0, 9 } do
		for _, z in { -6, 6 } do
			part(m, Vector3.new(0.5, 7, 0.5), at * CFrame.new(x, 3.5, z), WOOD, Enum.Material.Wood)
		end
	end
	part(m, Vector3.new(21, 0.4, 8), at * CFrame.new(0, 7.6, -3.2) * CFrame.Angles(math.rad(-12), 0, 0), TENT, Enum.Material.Fabric)
	part(m, Vector3.new(21, 0.4, 8), at * CFrame.new(0, 7.6, 3.2) * CFrame.Angles(math.rad(12), 0, 0), TENT, Enum.Material.Fabric)
	part(m, Vector3.new(21, 6, 0.3), at * CFrame.new(0, 3.6, 6.8), TENT, Enum.Material.Fabric)
	part(m, Vector3.new(4, 1.4, 1.2), at * CFrame.new(-6, 0.9, 4.5), Color3.fromRGB(200, 160, 90), Enum.Material.Fabric) -- مساند
	part(m, Vector3.new(4, 1.4, 1.2), at * CFrame.new(5, 0.9, 4.5), Color3.fromRGB(200, 160, 90), Enum.Material.Fabric)
	return m
end

-- بير: حلقة حجر وخشبتين فوقه ودلو
local function buildWell(at: CFrame, parent: Instance): Model
	local m = newModel("Well", parent)
	for i = 0, 7 do
		local a = i * math.pi / 4
		part(m, Vector3.new(2.6, 2.6, 1.2), at * CFrame.Angles(0, a, 0) * CFrame.new(0, 1.2, 3), Color3.fromRGB(150, 130, 105), Enum.Material.Cobblestone)
	end
	part(m, Vector3.new(0.2, 5.6, 5.6), at * CFrame.new(0, 0.2, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(30, 50, 60), Enum.Material.Glass, Enum.PartType.Cylinder)
	part(m, Vector3.new(0.6, 7, 0.6), at * CFrame.new(-3, 3.5, 0), WOOD, Enum.Material.Wood)
	part(m, Vector3.new(0.6, 7, 0.6), at * CFrame.new(3, 3.5, 0), WOOD, Enum.Material.Wood)
	part(m, Vector3.new(7, 0.6, 0.6), at * CFrame.new(0, 6.8, 0), WOOD, Enum.Material.Wood)
	part(m, Vector3.new(1.1, 1.2, 1.1), at * CFrame.new(0, 4.6, 0), Color3.fromRGB(90, 90, 95), Enum.Material.Metal, Enum.PartType.Cylinder)
	return m
end

local function buildRocks(at: CFrame, rng: Random, parent: Instance): Model
	local m = newModel("Rocks", parent)
	for _ = 1, rng:NextInteger(3, 5) do
		local size = rng:NextNumber(3, 9)
		local offset = Vector3.new(rng:NextNumber(-7, 7), size * 0.25, rng:NextNumber(-7, 7))
		local spin = CFrame.Angles(rng:NextNumber(0, 6), rng:NextNumber(0, 6), rng:NextNumber(0, 6))
		part(m, Vector3.new(size, size * rng:NextNumber(0.5, 0.9), size * rng:NextNumber(0.7, 1.1)), at * CFrame.new(offset) * spin, Color3.fromRGB(150, 110, 80), Enum.Material.Sandstone)
	end
	return m
end

-- سيارة خربانة: هيكل مصدّي مايل وغارز في الرمل، وناقصة كفر
local function buildWreck(at: CFrame, rng: Random, parent: Instance): Model
	local m = newModel("Wreck", parent)
	local tilt = at * CFrame.new(0, 1.2, 0) * CFrame.Angles(math.rad(rng:NextNumber(-8, 8)), 0, math.rad(rng:NextNumber(-10, 10)))
	local rust = Color3.fromRGB(140, 75, 45)
	part(m, Vector3.new(7, 2.4, 15), tilt * CFrame.new(0, 1, 0), rust, Enum.Material.CorrodedMetal)
	part(m, Vector3.new(6.6, 2.6, 6), tilt * CFrame.new(0, 3.4, -1), Color3.fromRGB(120, 110, 100), Enum.Material.CorrodedMetal)
	part(m, Vector3.new(6, 2.2, 0.2), tilt * CFrame.new(0, 3.4, -4.1), Color3.fromRGB(40, 50, 55), Enum.Material.Glass).Transparency = 0.4
	for i, spot in { Vector3.new(-3.6, -0.2, -5), Vector3.new(3.6, -0.2, -5), Vector3.new(-3.6, -0.2, 5) } do
		local wheel = part(m, Vector3.new(1.2, 3, 3), tilt * CFrame.new(spot), Color3.fromRGB(30, 30, 30), Enum.Material.Rubber, Enum.PartType.Cylinder)
		wheel.Name = "Wheel" .. i
	end
	return m
end

local function buildCamel(at: CFrame, parent: Instance): Model
	local m = newModel("Camel", parent)
	for _, x in { -1, 1 } do
		for _, z in { -2.2, 2.2 } do
			part(m, Vector3.new(0.7, 5, 0.7), at * CFrame.new(x, 2.5, z), CAMEL, Enum.Material.Fabric)
		end
	end
	part(m, Vector3.new(3, 3, 6.5), at * CFrame.new(0, 6, 0), CAMEL, Enum.Material.Fabric)
	part(m, Vector3.new(2.4, 2.2, 2.6), at * CFrame.new(0, 8.2, 0.4), CAMEL, Enum.Material.Fabric, Enum.PartType.Ball)
	part(m, Vector3.new(1.1, 4.2, 1.1), at * CFrame.new(0, 8, -3.8) * CFrame.Angles(math.rad(-25), 0, 0), CAMEL, Enum.Material.Fabric)
	part(m, Vector3.new(1.3, 1.3, 2.6), at * CFrame.new(0, 10, -5), CAMEL, Enum.Material.Fabric)
	return m
end

local function buildSheep(parent: Instance): Model
	local m = newModel("Sheep", parent)
	local body = part(m, Vector3.new(2.4, 2, 3.2), CFrame.new(0, 2.2, 0), WOOL, Enum.Material.Fabric, Enum.PartType.Ball)
	body.Name = "Body"
	body.CanCollide = false
	part(m, Vector3.new(1, 1.1, 1.2), CFrame.new(0, 2.8, -1.9), Color3.fromRGB(50, 45, 40), Enum.Material.Fabric).CanCollide = false
	for _, x in { -0.6, 0.6 } do
		for _, z in { -0.9, 0.9 } do
			part(m, Vector3.new(0.35, 1.4, 0.35), CFrame.new(x, 0.7, z), Color3.fromRGB(50, 45, 40), Enum.Material.Fabric).CanCollide = false
		end
	end
	m.PrimaryPart = body
	body.PivotOffset = CFrame.new(0, -2.2, 0) -- المحور عند الرجلين
	return m
end

-- ونيت أبو مصلح وفي حوضه جوالين
local function buildPickup(at: CFrame, parent: Instance): Model
	local m = newModel("Pickup", parent)
	local white = Color3.fromRGB(235, 235, 235)
	part(m, Vector3.new(7, 2.2, 16), at * CFrame.new(0, 2.4, 0), white, Enum.Material.SmoothPlastic)
	part(m, Vector3.new(6.6, 2.8, 6), at * CFrame.new(0, 4.9, -2.5), white, Enum.Material.SmoothPlastic)
	part(m, Vector3.new(6.2, 2.2, 0.2), at * CFrame.new(0, 4.9, -5.6), Color3.fromRGB(40, 50, 55), Enum.Material.Glass)
	for _, x in { -3.6, 3.6 } do
		for _, z in { -5, 5 } do
			part(m, Vector3.new(1.2, 3, 3), at * CFrame.new(x, 1.5, z) * CFrame.Angles(0, 0, 0), Color3.fromRGB(30, 30, 30), Enum.Material.Rubber, Enum.PartType.Cylinder)
		end
	end
	for i = -1, 1 do
		part(m, Vector3.new(1.6, 2.4, 1), at * CFrame.new(i * 2, 4.7, 5), Color3.fromRGB(200, 40, 35), Enum.Material.Metal)
	end
	return m
end

-- كشتة: زولية وشبّة نار ودلّة
local function buildKashta(at: CFrame, parent: Instance): Model
	local m = newModel("KashtaSetup", parent)
	part(m, Vector3.new(16, 0.2, 12), at * CFrame.new(0, 0.1, 4), RUG, Enum.Material.Fabric)
	for _, x in { -6, 6 } do
		part(m, Vector3.new(4, 1.4, 1.2), at * CFrame.new(x, 0.9, 9), Color3.fromRGB(200, 160, 90), Enum.Material.Fabric)
	end
	local pit = part(m, Vector3.new(0.6, 4, 4), at * CFrame.new(0, 0.3, 4) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(60, 50, 45), Enum.Material.Slate, Enum.PartType.Cylinder)
	local fire = Instance.new("Fire")
	fire.Size = 4
	fire.Heat = 6
	fire.Parent = pit
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 160, 80)
	light.Range = 20
	light.Brightness = 2
	light.Parent = pit
	part(m, Vector3.new(1, 1.6, 1), at * CFrame.new(2.4, 1, 4), Color3.fromRGB(205, 160, 60), Enum.Material.Foil, Enum.PartType.Cylinder).CFrame = at * CFrame.new(2.4, 1, 4) * CFrame.Angles(0, 0, math.rad(90))
	return m
end

-- ===== الأشياء المتفرقة على الطرق =====

local function nearPeople(x: number, z: number): boolean
	for _, p in { DesertConfig.Bedouin, DesertConfig.Kashta, DesertConfig.Shepherd, DesertConfig.Mechanic } do
		if (Vector2.new(x, z) - Vector2.new(p.X, p.Z)).Magnitude < DesertConfig.ClearRadius + (p.Roam or 0) then
			return true
		end
	end
	return false
end

local function scatterProps(parent: Instance)
	local cfg = DesertConfig.Props
	local rng = Random.new(cfg.Seed)
	local count = 0
	for _, path in MapConfig.Roads.Paths do
		local a, b = path[1], path[#path]
		local dir = Vector2.new(b.X - a.X, b.Z - a.Z).Unit
		local side = Vector2.new(-dir.Y, dir.X)
		local along = cfg.Start
		while along <= cfg.Stop do
			local d = along + rng:NextNumber(-cfg.Jitter, cfg.Jitter)
			local off = rng:NextNumber(cfg.Offset[1], cfg.Offset[2]) * (if rng:NextNumber() < 0.5 then -1 else 1)
			local p = Vector2.new(a.X, a.Z) + dir * d + side * off
			if not nearPeople(p.X, p.Y) then
				local y = groundAt(p.X, p.Y) - 0.4
				local at = CFrame.new(p.X, y, p.Y) * CFrame.Angles(0, rng:NextNumber(0, math.pi * 2), 0)
				local kind = cfg.Kinds[rng:NextInteger(1, #cfg.Kinds)]
				if kind == "Tent" then
					buildTent(at, parent)
				elseif kind == "Well" then
					buildWell(at, parent)
				elseif kind == "Rocks" then
					buildRocks(at, rng, parent)
				else
					buildWreck(at, rng, parent)
				end
				count += 1
			end
			along += cfg.Every
		end
	end
	return count
end

-- ===== أبو بعير: وين أندر هبالي؟ =====

local function rarityName(id: string): string
	for _, r in MapConfig.AllRarities() do
		if r.Id == id then
			return r.Rarity
		end
	end
	return id
end

local function nearestLandmark(pos: Vector3): string
	local best, bestDistance = "الديرة", math.huge
	for _, landmark in MapConfig.Landmarks do
		local d = (Vector2.new(pos.X, pos.Z) - Vector2.new(landmark.X, landmark.Z)).Magnitude
		if d < bestDistance then
			best, bestDistance = landmark.DisplayName, d
		end
	end
	return best
end

local function bedouinHint(): string
	local folder = Workspace:FindFirstChild("Habali")
	if not folder then
		return "البر هادي اليوم، ما شفت شي"
	end
	local here = spots.Bedouin or Vector3.zero
	for _, rank in DesertConfig.Bedouin.Ranks do
		local best: Model?, bestDistance = nil, math.huge
		for _, model in folder:GetChildren() do
			if model:IsA("Model") and model:GetAttribute("Rarity") == rank and model:GetAttribute("Hook") ~= true and HabaliService.IsFree(model) then
				local d = (model:GetPivot().Position - here).Magnitude
				if d < bestDistance then
					best, bestDistance = model, d
				end
			end
		end
		if best then
			local pos = best:GetPivot().Position
			local zone = MapConfig.GetZoneAt(Vector2.new(pos.X, pos.Z).Magnitude)
			return string.format("شفت %s يركض في %s، جهة %s 🐪", rarityName(rank), if zone then zone.DisplayName else "البر", nearestLandmark(pos))
		end
	end
	return "ما شفت شي نادر الحين، تعال بعدين 🐪"
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

local function near(player: Player, id: string, extra: number?): boolean
	local spot = spots[id]
	local root = rootOf(player)
	return spot ~= nil and root ~= nil and (root.Position - spot).Magnitude <= ShopConfig.ShopDistance + (extra or 6)
end

local function onBedouin(player: Player)
	if not near(player, "Bedouin") then
		return
	end
	local now = os.clock()
	if lastAsk[player] and now - lastAsk[player] < DesertConfig.Bedouin.Cooldown then
		Net.Notify(player, "🐪 توني قايل لك، روح دوّر")
		return
	end
	lastAsk[player] = now
	Net.Notify(player, bedouinHint())
end

-- ===== أبو مصلح: بنزين غالي =====

local function onMechanic(player: Player)
	if not near(player, "Mechanic") then
		return
	end
	local car = CarService.GetCar(player)
	if not car or not car.Chassis.Parent or (car.Chassis.Position - spots.Mechanic).Magnitude > ShopConfig.CarDistance then
		Net.Notify(player, "جيب سيارتك عند الونيت أول")
		return
	end
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local studs, cost = Loadout.Rules.AffordableFuel(car.Fuel, car.Tank, profile.Record.money, DesertConfig.Mechanic.PriceMultiplier)
	if studs <= 0 then
		Net.Notify(player, if car.Fuel >= car.Tank then "⛽ التانكي مليان" else "💸 فلوسك ما تكفي")
		return
	end
	if DataService.Spend(player, cost) then
		CarService.AddFuel(car, studs)
		Net.Notify(player, "⛽ أبو مصلح عبّاك بـ " .. formatMoney(cost) .. " (غالي بس أنقذك)")
		HooksService.Event(player, "Refuel")
	end
end

-- ===== راعي الغنم =====

local WALK_ANIMATION = "rbxassetid://507777826"

local function runShepherd(rig: Model, root: BasePart, folder: Instance)
	local cfg = DesertConfig.Shepherd
	local humanoid = rig:FindFirstChildOfClass("Humanoid") :: Humanoid
	humanoid.WalkSpeed = cfg.WalkSpeed
	pcall(function()
		root:SetNetworkOwner(nil)
	end)
	local walk: AnimationTrack? = nil
	pcall(function()
		local animator = humanoid:FindFirstChildOfClass("Animator") or Instance.new("Animator")
		animator.Parent = humanoid
		local animation = Instance.new("Animation")
		animation.AnimationId = WALK_ANIMATION
		walk = animator:LoadAnimation(animation)
	end)

	-- الغنم وراه
	local sheep = {}
	local rng = Random.new(77)
	for i = 1, cfg.Sheep do
		local m = buildSheep(folder)
		local offset = Vector3.new(rng:NextNumber(-5, 5), 0, 5 + i * 2.2)
		local start = root.Position + offset
		m:PivotTo(CFrame.new(start.X, groundAt(start.X, start.Z), start.Z))
		table.insert(sheep, { Model = m, Offset = offset })
	end
	task.spawn(function()
		while rig.Parent do
			local facing = root.CFrame
			for _, s in sheep do
				local target = (facing * CFrame.new(s.Offset)).Position
				local current = s.Model:GetPivot().Position
				local flat = Vector3.new(target.X - current.X, 0, target.Z - current.Z)
				if flat.Magnitude > 1.5 then
					local step = flat.Unit * math.min(flat.Magnitude, cfg.WalkSpeed * 1.3 * 0.15)
					local nx, nz = current.X + step.X, current.Z + step.Z
					local y = groundAt(nx, nz)
					s.Model:PivotTo(CFrame.lookAt(Vector3.new(nx, y, nz), Vector3.new(nx + step.X, y, nz + step.Z)))
				end
			end
			task.wait(0.15)
		end
	end)

	-- يتمشى بين نقاط عشوائية حول مكانه
	task.spawn(function()
		local home = Vector3.new(cfg.X, 0, cfg.Z)
		while rig.Parent do
			local flatPos = Vector3.new(root.Position.X, 0, root.Position.Z)
			if (flatPos - home).Magnitude > cfg.Roam * 2 or root.Position.Y < MapConfig.MinY then
				rig:PivotTo(standAt(cfg.X, cfg.Z, 0, cfg.Z) * CFrame.new(0, 4, 0)) -- طاح أو علق: يرجع مكانه
			end
			local angle = rng:NextNumber(0, math.pi * 2)
			local radius = rng:NextNumber(10, cfg.Roam)
			local x, z = cfg.X + math.cos(angle) * radius, cfg.Z + math.sin(angle) * radius
			humanoid:MoveTo(Vector3.new(x, groundAt(x, z), z))
			if walk then
				walk:Play()
			end
			local done = false
			local connection = humanoid.MoveToFinished:Connect(function()
				done = true
			end)
			local started = os.clock()
			while not done and os.clock() - started < 15 and rig.Parent do
				task.wait(0.25)
			end
			connection:Disconnect()
			if walk then
				walk:Stop()
			end
			task.wait(rng:NextNumber(3, 7))
		end
	end)
end

-- ===== البناء =====

local function setup()
	local map = Workspace:WaitForChild("Map")
	local old = map:FindFirstChild("DesertLife")
	if old then
		old:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = "DesertLife"
	folder.Parent = map

	-- أبو بعير: يطالع الطريق، وخيمته وبعارينه وراه
	local b = DesertConfig.Bedouin
	local bedouinAt = standAt(b.X, b.Z, 0, b.Z)
	spots.Bedouin = bedouinAt.Position
	local camp = newModel("BedouinCamp", folder)
	buildTent(standAt(b.X + 12, b.Z, 0, b.Z) * CFrame.new(0, -0.3, 0), camp) -- فتحتها جهة الطريق
	for i = 1, b.Camels do
		local cx, cz = b.X + 34 + (i % 2) * 8, b.Z - 18 + i * 9
		buildCamel(standAt(cx, cz, cx + 10, cz + 4) * CFrame.new(0, -0.3, 0), camp)
	end
	local _, bedouinRoot = Npc.Build({ Name = b.Name, Title = b.Title, Thobe = Color3.fromRGB(150, 120, 90) }, bedouinAt, camp)
	if bedouinRoot then
		Npc.Prompt(bedouinRoot, "AskBedouin", "سولف معه", b.Name, ShopConfig.ShopDistance).Triggered:Connect(onBedouin)
	end

	-- أبو كشتة
	local k = DesertConfig.Kashta
	local kashtaAt = standAt(k.X, k.Z, 0, k.Z)
	spots.Kashta = kashtaAt.Position
	local kashta = newModel("Kashta", folder)
	buildKashta(kashtaAt, kashta) -- الزولية والنار وراه
	local _, kashtaRoot = Npc.Build({ Name = k.Name, Title = k.Title }, kashtaAt, kashta)
	if kashtaRoot then
		-- الجوال يفتح شاشة اليومية لما ينضغط (HooksClient)
		Npc.Prompt(kashtaRoot, "KashtaDaily", "تقهوى", k.Name, ShopConfig.ShopDistance)
	end

	-- أبو مصلح وونيته
	local m = DesertConfig.Mechanic
	local mechanicAt = standAt(m.X, m.Z, m.X, 0)
	spots.Mechanic = mechanicAt.Position
	local garage = newModel("Mechanic", folder)
	buildPickup(standAt(m.X + 12, m.Z + 8, m.X + 100, m.Z + 8) * CFrame.new(0, -0.3, 0), garage) -- موازي للطريق
	local _, mechanicRoot = Npc.Build({ Name = m.Name, Title = m.Title, Thobe = Color3.fromRGB(70, 90, 120), Shemagh = Color3.fromRGB(235, 235, 235) }, mechanicAt, garage)
	if mechanicRoot then
		Npc.Prompt(mechanicRoot, "MechanicFuel", "عبّي بنزين", m.Name, ShopConfig.ShopDistance).Triggered:Connect(onMechanic)
	end

	-- راعي الغنم
	local s = DesertConfig.Shepherd
	local flock = newModel("Shepherd", folder)
	local shepherd, shepherdRoot = Npc.Build({ Name = s.Name, Title = s.Title, Thobe = Color3.fromRGB(200, 185, 150), Anchored = false }, standAt(s.X, s.Z, 0, s.Z) * CFrame.new(0, 1, 0), flock)
	if shepherd and shepherdRoot then
		Npc.Prompt(shepherdRoot, "GreetShepherd", "سلّم عليه", s.Name, ShopConfig.ShopDistance).Triggered:Connect(function(player)
			local root = rootOf(player)
			if root and (root.Position - shepherdRoot.Position).Magnitude <= ShopConfig.ShopDistance + 8 then
				Net.Notify(player, "🐑 " .. s.Lines[math.random(1, #s.Lines)])
			end
		end)
		runShepherd(shepherd, shepherdRoot, flock)
	end

	local props = newModel("Props", folder)
	scatterProps(props)
end

function DesertLife.Start()
	Players.PlayerRemoving:Connect(function(player)
		lastAsk[player] = nil
	end)
	task.spawn(setup)
end

return DesertLife
