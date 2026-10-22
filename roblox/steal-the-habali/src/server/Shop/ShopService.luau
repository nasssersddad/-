-- المحلات (المرحلة 5): أبو هبال يشتري الهبالي، وأبو عقيل يبيع الأسلحة، وأبو كفر يطوّر السيارة،
-- وأبو فلّة يعبّي البنزين ويبيع الجوالين.
-- الجوال يفتح شاشة المحل ويطلب بس ("أبي أشتري كذا")، والسيرفر يتحقق من المسافة والفلوس والليفل.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")
local ServerStorage = game:GetService("ServerStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ShopConfig = require(Shared:WaitForChild("ShopConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local HabaliFactory = require(Server:WaitForChild("Habali"):WaitForChild("HabaliFactory"))
local Carry = require(Server:WaitForChild("Base"):WaitForChild("Carry"))
local Gear = require(Server:WaitForChild("Catch"):WaitForChild("Gear"))
local Loadout = require(script.Parent:WaitForChild("Loadout"))

local ShopService = {}

local rules = Loadout.Rules
local spots: { [string]: Vector3 } = {} -- مكان كل بياع (للتحقق من المسافة)

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
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

-- اللاعب واقف عند هالمحل؟ (الشاشة مفتوحة وهو عند البياع)
local function nearShop(player: Player, shopId: string): boolean
	local spot = spots[shopId]
	local root = rootOf(player)
	return spot ~= nil and root ~= nil and (root.Position - spot).Magnitude <= ShopConfig.ShopDistance + 6
end

-- سيارته قريبة من المحل؟ (البيع من الحوض، والتعبئة)
local function carNear(player: Player, shopId: string): any
	local car = CarService.GetCar(player)
	local spot = spots[shopId]
	if car and spot and car.Chassis.Parent and (car.Chassis.Position - spot).Magnitude <= ShopConfig.CarDistance then
		return car
	end
	return nil
end

-- ===== الشراء والتطوير =====

local function onBuy(player: Player, key: any)
	if type(key) ~= "string" then
		return
	end
	local shopId = ShopConfig.Upgrades[key]
	if not shopId or not nearShop(player, shopId) then
		return
	end
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local gear = Loadout.Gear(player)
	local ok, price = rules.CanBuy(gear, key, profile.Record.money)
	if not ok then
		if price == "Money" then
			Net.Notify(player, "💸 فلوسك ما تكفي")
		elseif price == "Max" then
			Net.Notify(player, "✅ عندك أقوى شي")
		end
		return
	end
	if not DataService.Spend(player, price) then
		return
	end
	local level = (gear :: any)[key] + 1
	Loadout.SetLevel(player, key, level)
	local item = rules.Level(key, level)
	if key == "Melee" or key == "Gun" then
		if player.Character then
			Gear.Refresh(player.Character, Loadout.Gear(player))
		end
	elseif key == "Engine" or key == "Tank" then
		CarService.ApplyGear(player)
	elseif key == "Load" and CarService.GetCar(player) then
		Net.Notify(player, "الحوض الجديد يركب في سيارتك الجاية (طلّعها من جديد وهي فاضية)")
	end
	Net.Notify(player, "🎉 اشتريت " .. item.Name .. "!")
end

-- ===== أبو هبال =====

local function onSell(player: Player, what: any)
	if not nearShop(player, "Habal") then
		return
	end
	if what == "Carried" then
		local item = Carry.Take(player)
		if not item then
			Net.Notify(player, "ما تشيل شي")
			return
		end
		local price = rules.SellPrice(item.Entry.r, item.Entry.v)
		DataService.AddMoney(player, price)
		Net.Notify(player, "💰 بعت " .. HabaliFactory.DisplayName(item.Entry) .. " بـ " .. formatMoney(price))
	elseif what == "Cargo" then
		local car = carNear(player, "Habal")
		if not car then
			Net.Notify(player, "قرّب سيارتك من الدكان أول")
			return
		end
		if car.Seat.Occupant then
			Net.Notify(player, "انزل من السيارة أول")
			return
		end
		local total, count = 0, 0
		for i = #car.Cargo, 1, -1 do
			local model = car.Cargo[i]
			local entry = HabaliFactory.EntryOf(model)
			if entry then
				total += rules.SellPrice(entry.r, entry.v)
				count += 1
			end
			CarService.RemoveCargo(car, model)
		end
		if count == 0 then
			Net.Notify(player, "سيارتك فاضية")
			return
		end
		DataService.AddMoney(player, total)
		Net.Notify(player, "💰 بعت " .. count .. " هبالي بـ " .. formatMoney(total))
	end
end

-- ===== أبو فلّة =====

local function onFuel(player: Player)
	if not nearShop(player, "Fuel") then
		return
	end
	local car = carNear(player, "Fuel")
	if not car then
		Net.Notify(player, "جيب سيارتك عند المضخة أول")
		return
	end
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local studs, cost = rules.AffordableFuel(car.Fuel, car.Tank, profile.Record.money)
	if studs <= 0 then
		Net.Notify(player, if car.Fuel >= car.Tank then "⛽ التانكي مليان" else "💸 فلوسك ما تكفي")
		return
	end
	if DataService.Spend(player, cost) then
		CarService.AddFuel(car, studs)
		Net.Notify(player, "⛽ عبّيت بـ " .. formatMoney(cost))
	end
end

local function onJerry(player: Player)
	if not nearShop(player, "Fuel") then
		return
	end
	local jerries = Loadout.Jerries(player)
	if jerries >= ShopConfig.Fuel.MaxJerries then
		Net.Notify(player, "معك " .. jerries .. " جوالين، ما تقدر تشيل أكثر")
		return
	end
	if not DataService.Spend(player, ShopConfig.Fuel.JerryPrice) then
		Net.Notify(player, "💸 فلوسك ما تكفي")
		return
	end
	Loadout.SetJerries(player, jerries + 1)
	Net.Notify(player, "🛢️ اشتريت جالون (معك " .. (jerries + 1) .. ")")
end

-- ===== البياعين =====

local SKIN = Color3.fromRGB(198, 150, 110)
local THOBE = Color3.fromRGB(245, 245, 240)

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

local function signText(part: BasePart, text: string)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.PixelsPerStud = 40
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.Font = Enum.Font.GothamBlack
	label.TextColor3 = Color3.fromRGB(40, 25, 10)
	label.Text = text
	label.Parent = gui
end

-- بياع بثوب وشماغ وعقال. cframe = مكان الرجلين ويطالع قدام
local function buildKeeper(shop: any, cframe: CFrame, parent: Instance): Model?
	local description = Instance.new("HumanoidDescription")
	description.HeadColor = SKIN
	description.LeftArmColor = SKIN
	description.RightArmColor = SKIN
	description.TorsoColor = THOBE
	description.LeftLegColor = THOBE
	description.RightLegColor = THOBE
	local ok, rig = pcall(function()
		return Players:CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15)
	end)
	if not ok or not rig then
		warn("[Shop] ما قدرنا نسوي البياع", shop.Id, rig)
		return nil
	end
	rig.Name = "Keeper"
	local humanoid = rig:FindFirstChildOfClass("Humanoid") :: Humanoid
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	local root = rig:FindFirstChild("HumanoidRootPart") :: BasePart
	root.Anchored = true
	rig:PivotTo(cframe * CFrame.new(0, humanoid.HipHeight + root.Size.Y / 2, 0))
	-- الشماغ (أحمر) والعقال الأسود فوقه
	local head = rig:FindFirstChild("Head") :: BasePart?
	if head then
		local shemagh = newPart("Shemagh", Vector3.new(1.5, 0.5, 1.5), head.CFrame * CFrame.new(0, head.Size.Y / 2, 0), Color3.fromRGB(200, 30, 40), Enum.Material.Fabric, rig)
		shemagh.Anchored = false
		shemagh.CanCollide = false
		local cloth = newPart("ShemaghBack", Vector3.new(1.6, 1.6, 0.25), head.CFrame * CFrame.new(0, 0.1, 0.7), Color3.fromRGB(235, 235, 235), Enum.Material.Fabric, rig)
		cloth.Anchored = false
		cloth.CanCollide = false
		for _, piece in { shemagh, cloth } do
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = head
			weld.Part1 = piece
			weld.Parent = piece
		end
		local meshes = ServerStorage:FindFirstChild("GearMeshes")
		local agal = meshes and meshes:FindFirstChild("Agal")
		if agal and agal:IsA("BasePart") then
			local ring = agal:Clone()
			ring.Size = ring.Size * 0.55
			ring.Anchored = false
			ring.CFrame = head.CFrame * CFrame.new(0, head.Size.Y / 2 + 0.25, 0) * CFrame.Angles(math.rad(90), 0, 0)
			ring.Parent = rig
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = head
			weld.Part1 = ring
			weld.Parent = ring
		end
	end
	-- الاسم فوق الراس
	local board = Instance.new("BillboardGui")
	board.Name = "NameTag"
	board.Size = UDim2.fromOffset(220, 60)
	board.StudsOffsetWorldSpace = Vector3.new(0, 3.2, 0)
	board.MaxDistance = 90
	board.Adornee = root
	board.Parent = root
	for i, text in { shop.Name, shop.Title } do
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 0.5)
		label.Position = UDim2.fromScale(0, (i - 1) * 0.5)
		label.BackgroundTransparency = 1
		label.TextScaled = true
		label.Font = if i == 1 then Enum.Font.GothamBlack else Enum.Font.GothamBold
		label.TextColor3 = if i == 1 then Color3.fromRGB(255, 225, 120) else Color3.new(1, 1, 1)
		label.TextStrokeTransparency = 0.3
		label.Text = text
		label.Parent = board
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "OpenShop"
	prompt.ActionText = "افتح المحل"
	prompt.ObjectText = shop.Name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = ShopConfig.ShopDistance
	prompt.RequiresLineOfSight = false
	prompt.Parent = root
	prompt.Triggered:Connect(function(player)
		if nearShop(player, shop.Id) then
			Net.Fire("ShopOpen", player, shop.Id)
		end
	end)
	rig.Parent = parent
	return rig
end

-- كشك صغير (للمحلات اللي ما لها مبنى في الماب)
local function buildStall(shop: any, cframe: CFrame, parent: Instance)
	local color = if shop.Id == "Agal" then Color3.fromRGB(40, 40, 46) else Color3.fromRGB(40, 110, 200)
	newPart("Floor", Vector3.new(14, 0.6, 12), cframe * CFrame.new(0, 0.3, 0), Color3.fromRGB(150, 110, 70), Enum.Material.WoodPlanks, parent)
	for _, corner in { Vector3.new(-6.5, 0, -5.5), Vector3.new(6.5, 0, -5.5), Vector3.new(-6.5, 0, 5.5), Vector3.new(6.5, 0, 5.5) } do
		newPart("Pole", Vector3.new(0.8, 10, 0.8), cframe * CFrame.new(corner + Vector3.new(0, 5.3, 0)), Color3.fromRGB(110, 80, 50), Enum.Material.Wood, parent)
	end
	newPart("Roof", Vector3.new(16, 0.8, 14), cframe * CFrame.new(0, 10.6, 0), color, Enum.Material.Fabric, parent)
	newPart("Counter", Vector3.new(10, 3, 1.6), cframe * CFrame.new(0, 2.1, -3), Color3.fromRGB(120, 85, 55), Enum.Material.Wood, parent)
	local sign = newPart("Sign", Vector3.new(12, 2.6, 0.4), cframe * CFrame.new(0, 8.6, -6.9), Color3.fromRGB(235, 210, 150), Enum.Material.Wood, parent)
	signText(sign, shop.Title)
end

local function setupShops()
	local map = Workspace:WaitForChild("Map")
	local old = map:FindFirstChild("Shops")
	if old then
		old:Destroy()
	end
	local folder = Instance.new("Folder")
	folder.Name = "Shops"
	folder.Parent = map
	local base = MapConfig.BaseHeight
	for _, shop in ShopConfig.Shops do
		local spot: CFrame
		if shop.Id == "Habal" and map:FindFirstChild("Shop") and map.Shop:FindFirstChild("ShopkeeperSpot", true) then
			-- ورا كاونتر الدكان اللي في النص، يطالع الجنوب
			local marker = map.Shop:FindFirstChild("ShopkeeperSpot", true) :: any
			local p = if marker:IsA("BasePart") then marker.Position else marker.WorldPosition
			spot = CFrame.lookAt(Vector3.new(p.X, base + 1, p.Z), Vector3.new(p.X, base + 1, p.Z + 1))
		elseif shop.Id == "Fuel" and map:FindFirstChild("GasStation") then
			local station = MapConfig.GasStation
			-- قدام الكشك (الكشك عند X+10، Z+4) وبعيد عن المضخات، يطالع الطريق
			local p = Vector3.new(station.X + 10, base + 0.4, station.Z - 2)
			spot = CFrame.lookAt(p, Vector3.new(station.X + 10, base + 0.4, 0))
		else
			local p = Vector3.new(shop.X, base, shop.Z)
			local front = CFrame.lookAt(p, Vector3.new(0, base, 0)) -- الكشك يطالع نص الديرة
			local model = Instance.new("Model")
			model.Name = shop.Id .. "Stall"
			model.Parent = folder
			buildStall(shop, front, model)
			spot = front * CFrame.new(0, 0.6, 1) -- البياع ورا الكاونتر
		end
		spots[shop.Id] = spot.Position
		buildKeeper(shop, spot, folder)
	end
end

function ShopService.Start()
	setupShops()
	-- الشخصية ممكن تطلع قبل ما تتحمّل البيانات: نركّب سلاحه الصح بعدها
	DataService.OnLoaded(function(player)
		if player.Character then
			Gear.Refresh(player.Character, Loadout.Gear(player))
		end
	end)
	Net.On("ShopBuy", onBuy)
	Net.On("ShopSell", onSell)
	Net.On("ShopFuel", onFuel)
	Net.On("ShopJerry", onJerry)
end

return ShopService
