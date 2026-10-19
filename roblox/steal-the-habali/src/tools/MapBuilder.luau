--!strict
-- يبني خريطة "اسرق الهبالي" مرة وحدة داخل Studio، وبعدها تحفظ المكان.
--
-- الاستخدام (من Command Bar في Studio):
--   require(game.ServerStorage.Tools.MapBuilder).Build()
--
-- تنبيه: يمسح التضاريس الحالية ومجلد Map القديم والـ Baseplate.
-- احفظ نسخة من المكان قبل لا تشغله. Ctrl+Z ما يرجّع التضاريس.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapConfig = require(Shared:WaitForChild("MapConfig")) :: any
local DesertShape = require(Shared:WaitForChild("DesertShape")) :: any

local VOXEL = 4 -- دقة التضاريس في روبلوكس
local CHUNK = 32 -- كم voxel نكتب في كل دفعة (بكل اتجاه)
local DEEP_LAYER = 12 -- تحت السطح بهالمسافة تصير الأرض حجر رملي

local COLORS = {
	PlotFloor = Color3.fromRGB(214, 190, 150),
	PlotWall = Color3.fromRGB(196, 160, 112),
	Podium = Color3.fromRGB(240, 226, 196),
	Wood = Color3.fromRGB(140, 96, 60),
	Awning = Color3.fromRGB(200, 60, 50),
	PalmTrunk = Color3.fromRGB(120, 86, 52),
	PalmLeaf = Color3.fromRGB(70, 140, 60),
	Rust = Color3.fromRGB(150, 80, 45),
}

local MapBuilder = {}

local function newPart(name: string, size: Vector3, cframe: CFrame, material: Enum.Material, color: Color3, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Anchored = true
	part.Size = size
	part.CFrame = cframe
	part.Material = material
	part.Color = color
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

-- علامة مخفية (للمعالم ومواقع النظام) ما تصطدم ولا تنشاف
local function newMarker(name: string, position: Vector3, parent: Instance): Part
	local marker = newPart(name, Vector3.new(2, 2, 2), CFrame.new(position), Enum.Material.SmoothPlastic, Color3.new(1, 1, 1), parent)
	marker.Transparency = 1
	marker.CanCollide = false
	marker.CanQuery = false
	marker.CanTouch = false
	return marker
end

local function addSign(part: BasePart, text: string)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.Parent = part

	local label = Instance.new("TextLabel")
	label.Name = "Text"
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.GothamBlack
	label.TextColor3 = Color3.fromRGB(255, 245, 220)
	label.TextStrokeTransparency = 0.2
	label.Parent = gui
end

local function buildTerrain(shape: any)
	local terrain = Workspace.Terrain
	terrain:Clear()
	terrain.Decoration = false -- العشب المتحرك يثقل على الجوال
	terrain.WaterColor = Color3.fromRGB(40, 150, 140)
	terrain.WaterTransparency = 0.6
	terrain.WaterWaveSize = 0.05

	local half = MapConfig.Size / 2
	local minY = MapConfig.MinY
	local layers = (MapConfig.MaxY - minY) // VOXEL
	local columns = MapConfig.Size // VOXEL
	local chunks = math.ceil(columns / CHUNK)
	local waterLevel = MapConfig.WaterLevel

	local materialCache: { [string]: Enum.Material } = {}
	local function toMaterial(name: string): Enum.Material
		local material = materialCache[name]
		if not material then
			material = (Enum.Material :: any)[name]
			materialCache[name] = material
		end
		return material
	end

	local written = 0
	for cx = 0, chunks - 1 do
		for cz = 0, chunks - 1 do
			local sizeX = math.min(CHUNK, columns - cx * CHUNK)
			local sizeZ = math.min(CHUNK, columns - cz * CHUNK)
			local materials = table.create(sizeX)
			local occupancy = table.create(sizeX)

			for ix = 1, sizeX do
				local materialColumn = table.create(layers)
				local occupancyColumn = table.create(layers)
				for iy = 1, layers do
					materialColumn[iy] = table.create(sizeZ)
					occupancyColumn[iy] = table.create(sizeZ)
				end
				materials[ix] = materialColumn
				occupancy[ix] = occupancyColumn

				local x = -half + (cx * CHUNK + ix - 0.5) * VOXEL
				for iz = 1, sizeZ do
					local z = -half + (cz * CHUNK + iz - 0.5) * VOXEL
					local height = shape.HeightAt(x, z)
					local surface = toMaterial(shape.MaterialAt(x, z, height))
					local wet = shape.IsWaterAt(x, z)

					for iy = 1, layers do
						local bottom = minY + (iy - 1) * VOXEL
						local fill = math.clamp((height - bottom) / VOXEL, 0, 1)
						if fill > 0 then
							materialColumn[iy][iz] = if height - bottom > DEEP_LAYER then Enum.Material.Sandstone else surface
							occupancyColumn[iy][iz] = fill
						elseif wet and bottom < waterLevel then
							materialColumn[iy][iz] = Enum.Material.Water
							occupancyColumn[iy][iz] = math.clamp((waterLevel - bottom) / VOXEL, 0, 1)
						else
							materialColumn[iy][iz] = Enum.Material.Air
							occupancyColumn[iy][iz] = 0
						end
					end
				end
			end

			local regionMin = Vector3.new(-half + cx * CHUNK * VOXEL, minY, -half + cz * CHUNK * VOXEL)
			local regionMax = regionMin + Vector3.new(sizeX * VOXEL, layers * VOXEL, sizeZ * VOXEL)
			terrain:WriteVoxels(Region3.new(regionMin, regionMax), VOXEL, materials, occupancy)

			written += 1
			if written % 16 == 0 then
				print(string.format("[MapBuilder] التضاريس %d%%", math.floor(written / (chunks * chunks) * 100)))
				task.wait() -- نخلي Studio يتنفس
			end
		end
	end
end

local function buildPlot(index: number, parent: Instance)
	local config = MapConfig.Plots
	local base = MapConfig.BaseHeight
	local angle = math.rad(config.AngleOffset + (index - 1) * 360 / config.Count)
	local position = Vector3.new(math.cos(angle) * config.Radius, base, math.sin(angle) * config.Radius)
	-- -Z المحلي (الواجهة) يطالع الدكان في النص
	local pivot = CFrame.lookAt(position, Vector3.new(0, base, 0))

	local size = config.Size
	local wallHeight = config.WallHeight
	local thickness = 1.5
	local wallY = 1 + wallHeight / 2

	local plot = Instance.new("Model")
	plot.Name = "Plot" .. index
	plot:SetAttribute("PlotId", index)

	local floor = newPart("Floor", Vector3.new(size, 1, size), pivot * CFrame.new(0, 0.5, 0), Enum.Material.Sandstone, COLORS.PlotFloor, plot)
	plot.PrimaryPart = floor

	local function wall(name: string, wallSize: Vector3, offset: Vector3)
		newPart(name, wallSize, pivot * CFrame.new(offset), Enum.Material.Brick, COLORS.PlotWall, plot)
	end
	wall("WallBack", Vector3.new(size, wallHeight, thickness), Vector3.new(0, wallY, size / 2 - thickness / 2))
	wall("WallLeft", Vector3.new(thickness, wallHeight, size), Vector3.new(-size / 2 + thickness / 2, wallY, 0))
	wall("WallRight", Vector3.new(thickness, wallHeight, size), Vector3.new(size / 2 - thickness / 2, wallY, 0))

	-- الواجهة فيها فتحة للمدخل
	local entrance = config.EntranceWidth
	local side = (size - entrance) / 2
	local frontZ = -size / 2 + thickness / 2
	wall("WallFrontLeft", Vector3.new(side, wallHeight, thickness), Vector3.new(-(entrance / 2 + side / 2), wallY, frontZ))
	wall("WallFrontRight", Vector3.new(side, wallHeight, thickness), Vector3.new(entrance / 2 + side / 2, wallY, frontZ))

	-- لوحة فوق المدخل: نظام القواعد بيكتب فيها اسم صاحبها
	local sign = newPart("Sign", Vector3.new(entrance + 4, 3, 0.5), pivot * CFrame.new(0, 1 + wallHeight + 1.5, -size / 2), Enum.Material.Wood, COLORS.Wood, plot)
	addSign(sign, "قاعدة فاضية")

	-- منصات عرض الهبالي: صفين × 5 في النص الخلفي
	local slots = Instance.new("Folder")
	slots.Name = "Slots"
	slots.Parent = plot
	local slotIndex = 0
	for row = 0, 1 do
		for column = -2, 2 do
			slotIndex += 1
			local podium = newPart(
				"Slot" .. slotIndex,
				Vector3.new(6, 1, 6),
				pivot * CFrame.new(column * 9.5, 1.5, 6 + row * 11),
				Enum.Material.Marble,
				COLORS.Podium,
				slots
			)
			podium:SetAttribute("SlotIndex", slotIndex)
		end
	end

	-- مكان طلوع صاحب القاعدة، ومنطقة التسليم (توصل الهبالي هنا)
	newMarker("OwnerSpawn", (pivot * CFrame.new(0, 4, -12)).Position, plot)
	local dropZone = newPart("DropZone", Vector3.new(entrance, 6, 8), pivot * CFrame.new(0, 4, -size / 2 + 6), Enum.Material.ForceField, Color3.fromRGB(80, 200, 255), plot)
	dropZone.Transparency = 0.7
	dropZone.CanCollide = false
	dropZone.CanQuery = false

	plot.Parent = parent
end

local function buildShop(parent: Instance)
	local base = MapConfig.BaseHeight
	local shop = Instance.new("Model")
	shop.Name = "Shop"
	-- الواجهة تطالع الجنوب (+Z) جهة مكان الطلوع
	local pivot = CFrame.lookAt(Vector3.new(0, base, 0), Vector3.new(0, base, 1))

	local floor = newPart("Floor", Vector3.new(24, 1, 24), pivot * CFrame.new(0, 0.5, 0), Enum.Material.WoodPlanks, COLORS.Wood, shop)
	shop.PrimaryPart = floor
	for _, corner in { Vector3.new(-11, 0, -11), Vector3.new(11, 0, -11), Vector3.new(-11, 0, 11), Vector3.new(11, 0, 11) } do
		newPart("Pole", Vector3.new(1, 12, 1), pivot * CFrame.new(corner + Vector3.new(0, 7, 0)), Enum.Material.Wood, COLORS.Wood, shop)
	end
	newPart("Roof", Vector3.new(28, 1, 28), pivot * CFrame.new(0, 13.5, 0), Enum.Material.Fabric, COLORS.Awning, shop)
	newPart("Counter", Vector3.new(14, 3.5, 2), pivot * CFrame.new(0, 2.75, -6), Enum.Material.Wood, COLORS.Wood, shop)
	local sign = newPart("Sign", Vector3.new(18, 4, 0.5), pivot * CFrame.new(0, 11, -12.5), Enum.Material.Wood, COLORS.Wood, shop)
	addSign(sign, "دكان أبو هبال 💰")

	-- مكان البياع (الـ NPC ينضاف في مرحلة البيع)
	newMarker("ShopkeeperSpot", (pivot * CFrame.new(0, 3, 0)).Position, shop)
	shop.Parent = parent
end

local function buildLobbySpawn(parent: Instance)
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "LobbySpawn"
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Size = Vector3.new(12, 1, 12)
	spawn.CFrame = CFrame.new(0, MapConfig.BaseHeight + 0.5, 30)
	spawn.Material = Enum.Material.Pavement
	spawn.Color = Color3.fromRGB(230, 210, 170)
	spawn.Duration = 0 -- بدون درع الحماية عند الطلوع
	spawn.Parent = parent
end

local function buildLandmarks(shape: any, parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "Landmarks"
	for _, landmark in MapConfig.Landmarks do
		local y = shape.HeightAt(landmark.X, landmark.Z) + 4
		local marker = newMarker(landmark.Id, Vector3.new(landmark.X, y, landmark.Z), folder)
		marker:SetAttribute("DisplayName", landmark.DisplayName)
		marker:SetAttribute("Radius", landmark.Radius)
	end
	folder.Parent = parent
end

local function buildPalm(position: Vector3, random: Random, parent: Instance)
	local palm = Instance.new("Model")
	palm.Name = "Palm"
	local height = random:NextNumber(14, 20)
	local lean = CFrame.Angles(math.rad(random:NextNumber(-8, 8)), random:NextNumber(0, math.pi * 2), 0)
	local root = CFrame.new(position) * lean

	-- الأسطوانة في روبلوكس محورها X، فنلفها تصير واقفة
	local trunk = newPart("Trunk", Vector3.new(height, 1.6, 1.6), root * CFrame.new(0, height / 2, 0) * CFrame.Angles(0, 0, math.rad(90)), Enum.Material.Wood, COLORS.PalmTrunk, palm)
	trunk.Shape = Enum.PartType.Cylinder
	local crown = root * CFrame.new(0, height, 0)
	for i = 1, 6 do
		local spin = CFrame.Angles(0, math.rad(i * 60), 0)
		-- كل سعفة تطلع لبرا وتنزل شوي لتحت
		newPart("Leaf", Vector3.new(2.4, 0.4, 9), crown * spin * CFrame.Angles(math.rad(-25), 0, 0) * CFrame.new(0, 0, -4.5), Enum.Material.Grass, COLORS.PalmLeaf, palm)
	end
	for _, part in palm:GetChildren() do
		(part :: BasePart).CanCollide = false
	end
	palm.Parent = parent
end

local function buildOasisPalms(shape: any, random: Random, parent: Instance)
	local oasis = MapConfig.GetLandmark("Oasis")
	if not oasis then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "OasisPalms"
	for i = 1, 12 do
		local angle = (i / 12) * math.pi * 2 + random:NextNumber(-0.15, 0.15)
		local distance = oasis.Radius * random:NextNumber(0.68, 0.95)
		local x = oasis.X + math.cos(angle) * distance
		local z = oasis.Z + math.sin(angle) * distance
		buildPalm(Vector3.new(x, shape.HeightAt(x, z) - 0.5, z), random, folder)
	end
	folder.Parent = parent
end

local function buildJunkyard(shape: any, random: Random, parent: Instance)
	local junkyard = MapConfig.GetLandmark("Junkyard")
	if not junkyard then
		return
	end
	local folder = Instance.new("Folder")
	folder.Name = "Junk"
	for i = 1, 14 do
		local angle = random:NextNumber(0, math.pi * 2)
		local distance = junkyard.Radius * math.sqrt(random:NextNumber(0.05, 0.9))
		local x = junkyard.X + math.cos(angle) * distance
		local z = junkyard.Z + math.sin(angle) * distance
		local y = shape.HeightAt(x, z)
		-- سيارة خربانة: جسم + كابينة، مايلة شوي
		local tilt = CFrame.Angles(math.rad(random:NextNumber(-12, 12)), random:NextNumber(0, math.pi * 2), math.rad(random:NextNumber(-20, 20)))
		local root = CFrame.new(x, y + 1.6, z) * tilt
		local car = Instance.new("Model")
		car.Name = "Wreck" .. i
		newPart("Body", Vector3.new(7, 3, 14), root, Enum.Material.CorrodedMetal, COLORS.Rust, car)
		newPart("Cabin", Vector3.new(6, 2.5, 6), root * CFrame.new(0, 2.6, 1), Enum.Material.CorrodedMetal, COLORS.Rust:Lerp(Color3.new(0.3, 0.3, 0.3), 0.4), car)
		car.Parent = folder
	end
	folder.Parent = parent
end

-- جدران مخفية على حدود الخريطة عشان محد يطلع برا
local function buildBoundary(parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "Boundary"
	local half = MapConfig.Size / 2
	local height = 800
	local y = MapConfig.MinY + height / 2
	local walls = {
		{ Vector3.new(MapConfig.Size, height, 4), Vector3.new(0, y, -half - 2) },
		{ Vector3.new(MapConfig.Size, height, 4), Vector3.new(0, y, half + 2) },
		{ Vector3.new(4, height, MapConfig.Size), Vector3.new(-half - 2, y, 0) },
		{ Vector3.new(4, height, MapConfig.Size), Vector3.new(half + 2, y, 0) },
	}
	for i, spec in walls do
		local wall = newPart("Wall" .. i, spec[1], CFrame.new(spec[2]), Enum.Material.SmoothPlastic, Color3.new(1, 1, 1), folder)
		wall.Transparency = 1
		wall.CastShadow = false
		wall.CanQuery = false -- ما نبي الأشعة (raycasts) تصطدم فيها
	end
	folder.Parent = parent
end

local function setupLighting()
	Lighting.ClockTime = 14.5
	Lighting.Brightness = 3
	Lighting.Ambient = Color3.fromRGB(110, 90, 70)
	Lighting.OutdoorAmbient = Color3.fromRGB(190, 160, 120)
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.4
	Lighting.GlobalShadows = true

	-- غبار الصحراء: الأفق يصير ضبابي ودافي
	local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmosphere.Density = 0.32
	atmosphere.Offset = 0.15
	atmosphere.Color = Color3.fromRGB(235, 205, 160)
	atmosphere.Decay = Color3.fromRGB(200, 140, 90)
	atmosphere.Glare = 0.4
	atmosphere.Haze = 1.8
	atmosphere.Parent = Lighting

	local grade = Lighting:FindFirstChild("DesertGrade") :: ColorCorrectionEffect?
	if not grade then
		local created = Instance.new("ColorCorrectionEffect")
		created.Name = "DesertGrade"
		created.Parent = Lighting
		grade = created
	end
	assert(grade)
	grade.Saturation = 0.12
	grade.Contrast = 0.05
	grade.TintColor = Color3.fromRGB(255, 245, 230)

	local rays = Lighting:FindFirstChildOfClass("SunRaysEffect") or Instance.new("SunRaysEffect")
	rays.Intensity = 0.04
	rays.Spread = 0.8
	rays.Parent = Lighting
end

function MapBuilder.Build()
	local started = os.clock()
	local shape = DesertShape.new(MapConfig)
	local random = Random.new(MapConfig.Seed)

	local oldMap = Workspace:FindFirstChild("Map")
	if oldMap then
		oldMap:Destroy()
	end
	local baseplate = Workspace:FindFirstChild("Baseplate")
	if baseplate then
		baseplate:Destroy()
	end

	print("[MapBuilder] أبني الصحراء... (تاخذ شوي)")
	buildTerrain(shape)

	local map = Instance.new("Folder")
	map.Name = "Map"

	local plots = Instance.new("Folder")
	plots.Name = "Plots"
	for index = 1, MapConfig.Plots.Count do
		buildPlot(index, plots)
	end
	plots.Parent = map

	buildShop(map)
	buildLobbySpawn(map)
	buildLandmarks(shape, map)
	buildOasisPalms(shape, random, map)
	buildJunkyard(shape, random, map)
	buildBoundary(map)
	map.Parent = Workspace

	setupLighting()
	print(string.format("[MapBuilder] خلصت في %.1f ثانية. احفظ المكان (Ctrl+S).", os.clock() - started))
end

return MapBuilder
