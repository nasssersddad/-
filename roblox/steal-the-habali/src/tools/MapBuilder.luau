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
local CHUNKS_PER_YIELD = 6 -- كل كم دفعة نخلي Studio يتنفس
local FILL_DEPTH = 12 -- كم نعبّي تحت أوطى سطح في الدفعة (الباقي تحت فاضي عشان الذاكرة)
-- روبلوكس ترسم سطح التضاريس أعلى بنص voxel من الـ occupancy، فننزّلها عشان السطح
-- يجي بالضبط على HeightAt (والقواعد والدكان ما تندفن)
local SURFACE_OFFSET = VOXEL / 2

local COLORS = {
	PlotFloor = Color3.fromRGB(214, 190, 150),
	PlotWall = Color3.fromRGB(196, 160, 112),
	Podium = Color3.fromRGB(240, 226, 196),
	Wood = Color3.fromRGB(140, 96, 60),
	Awning = Color3.fromRGB(200, 60, 50),
	PalmTrunk = Color3.fromRGB(120, 86, 52),
	PalmLeaf = Color3.fromRGB(70, 140, 60),
	Rust = Color3.fromRGB(150, 80, 45),
	Concrete = Color3.fromRGB(180, 176, 168),
	Canopy = Color3.fromRGB(245, 245, 240),
	Pump = Color3.fromRGB(215, 40, 40),
	Kiosk = Color3.fromRGB(230, 220, 200),
	Post = Color3.fromRGB(90, 90, 96),
}

local MapBuilder = {}

local function rgb(values: { number }): Color3
	return Color3.fromRGB(values[1], values[2], values[3])
end

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

local function addSign(part: BasePart, text: string, face: Enum.NormalId?): TextLabel
	local gui = Instance.new("SurfaceGui")
	gui.Face = face or Enum.NormalId.Front
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
	return label
end

-- على لوحة فاتحة نكتب بلون غامق عشان ينقرا
local function contrastText(label: TextLabel, background: Color3)
	local brightness = 0.299 * background.R + 0.587 * background.G + 0.114 * background.B
	if brightness > 0.6 then
		label.TextColor3 = Color3.fromRGB(60, 40, 25)
		label.TextStrokeColor3 = Color3.fromRGB(255, 250, 240)
	end
end

local function buildTerrain(shape: any)
	local terrain = Workspace.Terrain
	terrain:Clear()
	-- العشب المتحرك يثقل على الجوال. بعض نسخ Studio ما تسمح للسكربت يغيّره، فنتجاهل الخطأ
	pcall(function()
		(terrain :: any).Decoration = false
	end)
	terrain.WaterColor = Color3.fromRGB(40, 150, 140)
	terrain.WaterTransparency = 0.6
	terrain.WaterWaveSize = 0.05

	local materialCache: { [string]: Enum.Material } = {}
	local function toMaterial(name: string): Enum.Material
		local material = materialCache[name]
		if not material then
			material = (Enum.Material :: any)[name]
			materialCache[name] = material
		end
		return material
	end

	-- لون رمل كل طبقة (ألوان المواد في روبلوكس عامة لكل التضاريس)
	terrain:SetMaterialColor(toMaterial(MapConfig.Town.Material), rgb(MapConfig.Town.Color))
	for _, zone in MapConfig.Zones do
		terrain:SetMaterialColor(toMaterial(zone.Material), rgb(zone.Color))
	end
	for name, color in MapConfig.MaterialColors do
		terrain:SetMaterialColor(toMaterial(name), rgb(color))
	end

	local outer = MapConfig.Edge.TerrainRadius
	local chunkStuds = CHUNK * VOXEL
	local chunksPerSide = math.ceil(outer / chunkStuds) * 2
	local origin = -chunksPerSide / 2 * chunkStuds
	local waterLevel = MapConfig.WaterLevel
	local minY, maxY = MapConfig.MinY, MapConfig.MaxY

	-- نكتب بس الدفعات اللي تلمس الدائرة
	local todo = {}
	for cx = 0, chunksPerSide - 1 do
		for cz = 0, chunksPerSide - 1 do
			local x0, z0 = origin + cx * chunkStuds, origin + cz * chunkStuds
			local nearX = math.clamp(0, x0, x0 + chunkStuds)
			local nearZ = math.clamp(0, z0, z0 + chunkStuds)
			if nearX * nearX + nearZ * nearZ <= outer * outer then
				table.insert(todo, Vector2.new(x0, z0))
			end
		end
	end

	local side = CHUNK + 2 -- نحسب عمود زيادة من كل جهة عشان ما يطلع فراغ بين الدفعات
	local heights = table.create(side * side)
	local lastPercent = -1
	for index, corner in todo do
		local x0, z0 = corner.X, corner.Y

		-- 1) الارتفاعات (مع الإطار) وأوطى وأعلى نقطة
		local lowest, highest = math.huge, -math.huge
		local wetChunk = false
		for ix = 0, CHUNK + 1 do
			local x = x0 + (ix - 0.5) * VOXEL
			for iz = 0, CHUNK + 1 do
				local z = z0 + (iz - 0.5) * VOXEL
				local h = -math.huge
				if x * x + z * z <= outer * outer then
					h = shape.HeightAt(x, z)
					lowest = math.min(lowest, h)
					if ix >= 1 and ix <= CHUNK and iz >= 1 and iz <= CHUNK then
						highest = math.max(highest, h)
						if not wetChunk and shape.IsWaterAt(x, z) then
							wetChunk = true
						end
					end
				end
				heights[ix * side + iz + 1] = h
			end
		end

		if highest > -math.huge then
			if wetChunk then
				highest = math.max(highest, waterLevel)
			end
			local bottomY = math.max(minY, math.floor((lowest - SURFACE_OFFSET - FILL_DEPTH) / VOXEL) * VOXEL)
			local topY = math.min(maxY, math.ceil((highest - SURFACE_OFFSET) / VOXEL) * VOXEL + VOXEL)
			local layers = (topY - bottomY) // VOXEL

			-- 2) المواد والتعبئة لكل voxel
			local materials = table.create(CHUNK)
			local occupancy = table.create(CHUNK)
			for ix = 1, CHUNK do
				local materialColumn = table.create(layers)
				local occupancyColumn = table.create(layers)
				for iy = 1, layers do
					materialColumn[iy] = table.create(CHUNK)
					occupancyColumn[iy] = table.create(CHUNK)
				end
				materials[ix] = materialColumn
				occupancy[ix] = occupancyColumn

				local x = x0 + (ix - 0.5) * VOXEL
				for iz = 1, CHUNK do
					local z = z0 + (iz - 0.5) * VOXEL
					local height = heights[ix * side + iz + 1]
					local inside = height > -math.huge
					local surface = if inside then toMaterial(shape.MaterialAt(x, z, height)) else Enum.Material.Air
					local wet = inside and wetChunk and shape.IsWaterAt(x, z)
					local surfaceY = height - SURFACE_OFFSET

					for iy = 1, layers do
						local bottom = bottomY + (iy - 1) * VOXEL
						local fill = if inside then math.clamp((surfaceY - bottom) / VOXEL, 0, 1) else 0
						if fill > 0 then
							materialColumn[iy][iz] = surface
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

			local regionMin = Vector3.new(x0, bottomY, z0)
			local regionMax = regionMin + Vector3.new(chunkStuds, layers * VOXEL, chunkStuds)
			terrain:WriteVoxels(Region3.new(regionMin, regionMax), VOXEL, materials, occupancy)
		end

		local percent = math.floor(index / #todo * 10) * 10
		if percent ~= lastPercent then
			lastPercent = percent
			print(string.format("[MapBuilder] التضاريس %d%%", percent))
		end
		if index % CHUNKS_PER_YIELD == 0 then
			task.wait() -- نخلي Studio يتنفس
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

-- محطة البنزين: مظلة ومضخات وكشك. FuelZone منطقة مخفية بيستخدمها نظام البنزين بعدين
local function buildGasStation(parent: Instance)
	local config = MapConfig.GasStation
	local base = MapConfig.BaseHeight
	local width, depth = config.Width, config.Depth
	-- -Z المحلي يطالع الطريق (Z = 0)
	local pivot = CFrame.lookAt(Vector3.new(config.X, base, config.Z), Vector3.new(config.X, base, config.Z - 1))

	local station = Instance.new("Model")
	station.Name = "GasStation"

	local slab = newPart("Slab", Vector3.new(width, 0.4, depth), pivot * CFrame.new(0, 0.2, 0), Enum.Material.Concrete, COLORS.Concrete, station)
	station.PrimaryPart = slab

	-- المظلة فوق المضخات
	local canopyWidth = width - 8
	for _, offset in { Vector3.new(-canopyWidth / 2 + 1, 0, -depth / 2 + 3), Vector3.new(canopyWidth / 2 - 1, 0, -depth / 2 + 3), Vector3.new(-canopyWidth / 2 + 1, 0, depth / 2 - 5), Vector3.new(canopyWidth / 2 - 1, 0, depth / 2 - 5) } do
		newPart("Pillar", Vector3.new(1.2, 12, 1.2), pivot * CFrame.new(offset + Vector3.new(-4, 6.4, 0)), Enum.Material.Metal, COLORS.Canopy, station)
	end
	newPart("Canopy", Vector3.new(canopyWidth + 2, 1.2, depth - 4), pivot * CFrame.new(-4, 13, -1), Enum.Material.SmoothPlastic, COLORS.Canopy, station)
	newPart("CanopyStripe", Vector3.new(canopyWidth + 2.2, 0.6, depth - 3.8), pivot * CFrame.new(-4, 12.2, -1), Enum.Material.SmoothPlastic, COLORS.Pump, station)

	-- جزيرة المضخات
	local island = canopyWidth - 6
	newPart("Island", Vector3.new(island, 0.6, 3), pivot * CFrame.new(-4, 0.7, -1), Enum.Material.Concrete, COLORS.Canopy, station)
	local pumps = Instance.new("Folder")
	pumps.Name = "Pumps"
	pumps.Parent = station
	for i = 1, config.Pumps do
		local x = -4 - island / 2 + island * (i - 0.5) / config.Pumps
		local pump = newPart("Pump" .. i, Vector3.new(2, 5, 1.6), pivot * CFrame.new(x, 3.5, -1), Enum.Material.SmoothPlastic, COLORS.Pump, pumps)
		pump:SetAttribute("PumpIndex", i)
		newPart("Display", Vector3.new(1.6, 1, 1.7), pivot * CFrame.new(x, 4.8, -1), Enum.Material.Neon, Color3.fromRGB(255, 220, 120), pump)
	end

	-- الكشك على طرف المحطة
	local kiosk = newPart("Kiosk", Vector3.new(7, 8, 8), pivot * CFrame.new(width / 2 - 4, 4.4, depth / 2 - 5), Enum.Material.Plaster, COLORS.Kiosk, station)
	addSign(kiosk, "⛽", Enum.NormalId.Front)

	-- لوحة عالية تنشاف من الطريق
	local post = newPart("SignPost", Vector3.new(1, 18, 1), pivot * CFrame.new(-width / 2 + 1, 9, -depth / 2 + 1), Enum.Material.Metal, COLORS.Post, station)
	local board = newPart("Sign", Vector3.new(11, 4, 0.5), post.CFrame * CFrame.new(0, 7, -0.75), Enum.Material.SmoothPlastic, COLORS.Pump, station)
	addSign(board, "محطة بنزين ⛽", Enum.NormalId.Front)
	addSign(board, "محطة بنزين ⛽", Enum.NormalId.Back)

	local fuelZone = newPart("FuelZone", Vector3.new(width, 8, depth), pivot * CFrame.new(0, 4.4, 0), Enum.Material.SmoothPlastic, Color3.new(1, 1, 1), station)
	fuelZone.Transparency = 1
	fuelZone.CanCollide = false
	fuelZone.CanQuery = false
	fuelZone:SetAttribute("FuelStation", true)

	station.Parent = parent
end

-- لوحة على كل طريق عند بداية كل طبقة: الوجه اللي يطالع الديرة للي طالع،
-- والوجه الثاني للي راجع (يقول وش الطبقة اللي داخلها)
local function buildZoneSigns(shape: any, parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "ZoneSigns"
	local roads = MapConfig.Roads
	local offset = roads.Width / 2 + roads.SignOffset
	for roadIndex, path in MapConfig.Roads.Paths do
		local finish = path[#path]
		local direction = Vector3.new(finish.X, 0, finish.Z).Unit
		local right = Vector3.new(-direction.Z, 0, direction.X)
		for zoneIndex, zone in MapConfig.Zones do
			local previous = MapConfig.Zones[zoneIndex - 1]
			local along = direction * zone.MinRadius + right * offset
			local ground = shape.HeightAt(along.X, along.Z)
			local root = CFrame.lookAt(Vector3.new(along.X, ground, along.Z), Vector3.new(along.X, ground, along.Z) - direction)

			local sign = Instance.new("Model")
			sign.Name = string.format("Road%d_%s", roadIndex, zone.Id)
			sign:SetAttribute("ZoneId", zone.Id)
			for _, x in { -6, 6 } do
				newPart("Post", Vector3.new(0.8, 9, 0.8), root * CFrame.new(x, 4.5, 0), Enum.Material.Metal, COLORS.Post, sign)
			end
			local board = newPart("Board", Vector3.new(16, 5, 0.6), root * CFrame.new(0, 8.5, 0), Enum.Material.SmoothPlastic, rgb(zone.Color), sign)
			contrastText(addSign(board, "بداية " .. zone.DisplayName, Enum.NormalId.Front), board.Color)
			contrastText(addSign(board, if previous then "بداية " .. previous.DisplayName else "الديرة 🏠", Enum.NormalId.Back), board.Color)
			sign.Parent = folder
		end
	end
	folder.Parent = parent
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
	for i = 1, 16 do
		local angle = (i / 16) * math.pi * 2 + random:NextNumber(-0.12, 0.12)
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
	local placed: { Vector2 } = {}
	local tries = 0
	while #placed < 18 and tries < 300 do
		tries += 1
		local angle = random:NextNumber(0, math.pi * 2)
		local distance = junkyard.Radius * math.sqrt(random:NextNumber(0.03, 0.9))
		local spot = Vector2.new(junkyard.X + math.cos(angle) * distance, junkyard.Z + math.sin(angle) * distance)
		-- ما نبي السيارات فوق بعض
		local clear = true
		for _, other in placed do
			if (other - spot).Magnitude < 17 then
				clear = false
				break
			end
		end
		if clear then
			table.insert(placed, spot)
			local y = shape.HeightAt(spot.X, spot.Y)
			-- سيارة خربانة: جسم + كابينة، مايلة شوي
			local tilt = CFrame.Angles(math.rad(random:NextNumber(-12, 12)), random:NextNumber(0, math.pi * 2), math.rad(random:NextNumber(-20, 20)))
			local root = CFrame.new(spot.X, y + 1.6, spot.Y) * tilt
			local car = Instance.new("Model")
			car.Name = "Wreck" .. #placed
			newPart("Body", Vector3.new(7, 3, 14), root, Enum.Material.CorrodedMetal, COLORS.Rust, car)
			newPart("Cabin", Vector3.new(6, 2.5, 6), root * CFrame.new(0, 2.6, 1), Enum.Material.CorrodedMetal, COLORS.Rust:Lerp(Color3.new(0.3, 0.3, 0.3), 0.4), car)
			car.Parent = folder
		end
	end
	folder.Parent = parent
end

-- جدار مخفي دائري على قمة حزام الكثبان عشان محد يطلع برا
local function buildBoundary(parent: Instance)
	local folder = Instance.new("Folder")
	folder.Name = "Boundary"
	local radius = MapConfig.Edge.Crest
	local segments = 96
	local width = 2 * math.pi * radius / segments + 6
	local height = 800
	local y = MapConfig.MinY + height / 2
	for i = 1, segments do
		local angle = (i / segments) * math.pi * 2
		local position = Vector3.new(math.cos(angle) * radius, y, math.sin(angle) * radius)
		local wall = newPart("Wall" .. i, Vector3.new(width, height, 6), CFrame.lookAt(position, Vector3.new(0, y, 0)), Enum.Material.SmoothPlastic, Color3.new(1, 1, 1), folder)
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
	-- مكان الطلوع اللي يجي مع قالب Baseplate (في نص الدكان). عندنا LobbySpawn بداله
	local templateSpawn = Workspace:FindFirstChild("SpawnLocation")
	if templateSpawn and templateSpawn:IsA("SpawnLocation") then
		templateSpawn:Destroy()
	end

	-- الماب كبير: الجوال يحمّل اللي حوله بس
	local streamingOk = pcall(function()
		Workspace.StreamingEnabled = true
	end)
	if not streamingOk then
		warn("[MapBuilder] ما قدرت أشغّل StreamingEnabled، شغّله يدوياً من Workspace")
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
	buildGasStation(map)
	buildLobbySpawn(map)
	buildZoneSigns(shape, map)
	buildLandmarks(shape, map)
	buildOasisPalms(shape, random, map)
	buildJunkyard(shape, random, map)
	buildBoundary(map)
	map.Parent = Workspace

	setupLighting()
	print(string.format("[MapBuilder] خلصت في %.1f ثانية. احفظ المكان (Ctrl+S).", os.clock() - started))
end

return MapBuilder
