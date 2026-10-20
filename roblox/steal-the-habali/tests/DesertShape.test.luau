-- اختبار شكل الصحراء برا روبلوكس:
--   luau roblox/steal-the-habali/tests/DesertShape.test.luau

local MapConfig = require("../src/shared/MapConfig")
local DesertShape = require("../src/shared/DesertShape")

local shape = DesertShape.new(MapConfig)
local base = MapConfig.BaseHeight
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

local function radiusOf(x: number, z: number): number
	return math.sqrt(x * x + z * z)
end

local plots = MapConfig.Plots
local roadHalf = MapConfig.Roads.Width / 2
local function distanceToRoads(x: number, z: number): number
	local best = math.huge
	for _, path in MapConfig.Roads.Paths do
		for i = 1, #path - 1 do
			local a, b = path[i], path[i + 1]
			local abx, abz = b.X - a.X, b.Z - a.Z
			local t = math.clamp(((x - a.X) * abx + (z - a.Z) * abz) / (abx * abx + abz * abz), 0, 1)
			best = math.min(best, math.sqrt((x - a.X - abx * t) ^ 2 + (z - a.Z - abz * t) ^ 2))
		end
	end
	return best
end

-- محاور القاعدة: forward يطالع النص، right عمودي عليه (نفس CFrame.lookAt)
local function plotFrame(index: number)
	local angle = math.rad(plots.AngleOffset + (index - 1) * 360 / plots.Count)
	local cx, cz = math.cos(angle) * plots.Radius, math.sin(angle) * plots.Radius
	local fx, fz = -math.cos(angle), -math.sin(angle)
	return cx, cz, fx, fz, -fz, fx
end

local function insideAnyPlot(x: number, z: number, margin: number): boolean
	for index = 1, plots.Count do
		local cx, cz, fx, fz, rx, rz = plotFrame(index)
		local dx, dz = x - cx, z - cz
		local u, v = dx * rx + dz * rz, dx * fx + dz * fz
		if math.abs(u) <= plots.Size / 2 + margin and math.abs(v) <= plots.Size / 2 + margin then
			return true
		end
	end
	return false
end

-- 1) كل القواعد على أرض مستوية تماماً، وما تقطع أي طريق
for index = 1, plots.Count do
	local cx, cz, fx, fz, rx, rz = plotFrame(index)
	local halfSize = plots.Size / 2
	for u = -halfSize, halfSize, halfSize / 4 do
		for v = -halfSize, halfSize, halfSize / 4 do
			local x, z = cx + rx * u + fx * v, cz + rz * u + fz * v
			check(math.abs(shape.HeightAt(x, z) - base) < 0.01, string.format("plot %d not flat at (%.0f, %.0f)", index, x, z))
			check(distanceToRoads(x, z) > roadHalf, string.format("plot %d overlaps a road at (%.0f, %.0f)", index, x, z))
		end
	end
end

-- 2) الطرق مستوية ومادتها إسفلت (برا الساحة)، وكل طريق يوصل لمعلم في الأسطوري
local legendary = MapConfig.Zones[#MapConfig.Zones]
for _, path in MapConfig.Roads.Paths do
	for i = 1, #path - 1 do
		local a, b = path[i], path[i + 1]
		local steps = math.ceil(radiusOf(b.X - a.X, b.Z - a.Z) / 40)
		for step = 0, steps do
			local t = step / steps
			local x, z = a.X + (b.X - a.X) * t, a.Z + (b.Z - a.Z) * t
			local h = shape.HeightAt(x, z)
			check(math.abs(h - base) < 0.01, string.format("road not flat at (%.0f, %.0f): %.2f", x, z, h))
			if radiusOf(x, z) > MapConfig.Town.PlazaRadius then
				check(shape.MaterialAt(x, z, h) == "Asphalt", string.format("road not asphalt at (%.0f, %.0f)", x, z))
			end
		end
	end
	local finish = path[#path]
	check(radiusOf(finish.X, finish.Z) >= legendary.MinRadius, string.format("road ends before the legendary ring at (%d, %d)", finish.X, finish.Z))
	local nearest = math.huge
	for _, landmark in MapConfig.Landmarks do
		nearest = math.min(nearest, radiusOf(finish.X - landmark.X, finish.Z - landmark.Z) - landmark.Radius)
	end
	check(nearest < 120, string.format("road end (%d, %d) is %.0f studs from any landmark", finish.X, finish.Z, nearest))
end

-- 3) الواحة: الوسط تحت مستوى الموية ومعلّم كموية، وحوله عشب
local oasis = assert(MapConfig.GetLandmark("Oasis"))
check(shape.HeightAt(oasis.X, oasis.Z) < MapConfig.WaterLevel - 2, "oasis center not below water")
check(shape.IsWaterAt(oasis.X, oasis.Z), "oasis center not water")
local ringX, ringZ = oasis.X + oasis.Radius * 0.8, oasis.Z
check(shape.MaterialAt(ringX, ringZ, shape.HeightAt(ringX, ringZ)) == "LeafyGrass", "oasis ring not grass")
check(not shape.IsWaterAt(0, 0), "water in town")

-- 4) الوادي أعمق من الأرض بكثير
local canyonPoint = MapConfig.Canyon.Path[2]
check(shape.HeightAt(canyonPoint.X, canyonPoint.Z) < base - 25, "canyon too shallow")

-- 5) طويق أعلى من الكثبان العادية في المتوسط
local tuwaiq = assert(MapConfig.GetLandmark("Tuwaiq"))
local peak = -math.huge
for dx = -150, 150, 8 do
	for dz = -150, 150, 8 do
		peak = math.max(peak, shape.HeightAt(tuwaiq.X + dx, tuwaiq.Z + dz))
	end
end
check(peak > MapConfig.DuneHeight + 20, string.format("tuwaiq peak too low: %.1f", peak))

-- 6) الطبقات ورا بعض بدون فراغ، كل وحدة مادتها غير، وآخر وحدة تخلص عند الحافة
local zones = MapConfig.Zones
check(zones[1].MinRadius > MapConfig.Town.Radius, "first zone starts inside the town")
check(zones[#zones].MaxRadius == MapConfig.Edge.Start, "last zone does not end at the edge belt")
local seenMaterials = { [MapConfig.Town.Material] = true }
for i, zone in zones do
	check(zone.MinRadius < zone.MaxRadius, zone.Id .. " has no width")
	if i > 1 then
		check(zones[i - 1].MaxRadius == zone.MinRadius, "gap or overlap before " .. zone.Id)
	end
	check(not seenMaterials[zone.Material], zone.Id .. " reuses material " .. zone.Material)
	seenMaterials[zone.Material] = true
	-- وسط الطبقة على الأقطار (بعيد عن الطرق والمعالم) لازم يكون رمل الطبقة
	local mid = (zone.MinRadius + zone.MaxRadius) / 2
	for k = 0, 3 do
		local angle = math.rad(45 + k * 90)
		local x, z = math.cos(angle) * mid, math.sin(angle) * mid
		local material = shape.MaterialAt(x, z, shape.HeightAt(x, z))
		check(material == zone.Material, string.format("%s ring at (%.0f, %.0f) is %s", zone.Id, x, z, material))
	end
	check(MapConfig.GetZoneAt(mid) == zone, "GetZoneAt wrong for " .. zone.Id)
end
check(MapConfig.GetZoneAt(100) == nil, "town counted as a zone")

-- 7) المعالم كلها داخل طبقة الأسطوري وما تلمس الحافة
for _, landmark in MapConfig.Landmarks do
	local r = radiusOf(landmark.X, landmark.Z)
	check(MapConfig.GetZoneAt(r) == legendary, landmark.Id .. " is not in the legendary ring")
	check(r + landmark.Radius < MapConfig.Edge.Start, landmark.Id .. " touches the edge belt")
end

-- 8) الحافة: حزام عالي يقفل الماب، وقبله آخر طبقة عادية
for k = 0, 7 do
	local angle = math.rad(22.5 + k * 45)
	local c, s = math.cos(angle), math.sin(angle)
	local crest = MapConfig.Edge.Crest
	check(shape.HeightAt(c * crest, s * crest) > base + 90, string.format("edge too low at angle %d", 22.5 + k * 45))
	local inside = MapConfig.Edge.Start - 20
	check(shape.HeightAt(c * inside, s * inside) < base + MapConfig.DuneHeight + 2, string.format("edge rises too early at angle %d", 22.5 + k * 45))
end

-- 9) محطة البنزين: داخل الديرة، مستوية، ما تقطع الطريق ولا القواعد ولا الساحة
local station = MapConfig.GasStation
for dx = -station.Width / 2, station.Width / 2, station.Width / 8 do
	for dz = -station.Depth / 2, station.Depth / 2, station.Depth / 6 do
		local x, z = station.X + dx, station.Z + dz
		check(math.abs(shape.HeightAt(x, z) - base) < 0.01, string.format("gas station not flat at (%.0f, %.0f)", x, z))
		check(distanceToRoads(x, z) > roadHalf + 2, string.format("gas station on a road at (%.0f, %.0f)", x, z))
		check(not insideAnyPlot(x, z, 2), string.format("gas station inside a plot at (%.0f, %.0f)", x, z))
		check(radiusOf(x, z) > MapConfig.Town.PlazaRadius and radiusOf(x, z) < MapConfig.Town.Radius, "gas station outside the town ring")
	end
end
check(distanceToRoads(station.X, station.Z) < station.Depth / 2 + roadHalf + 12, "gas station too far from a road")

-- 10) كل الخريطة داخل حدود الطبقات، وكل المواد معروفة
local validMaterials = {
	Ground = true, Pavement = true, Asphalt = true, Mud = true, LeafyGrass = true,
	Rock = true, Basalt = true, Slate = true,
}
for _, zone in zones do
	validMaterials[zone.Material] = true
end
local outer = MapConfig.Edge.TerrainRadius
local minH, maxH = math.huge, -math.huge
for x = -outer, outer, 24 do
	for z = -outer, outer, 24 do
		if radiusOf(x, z) <= outer then
			local h = shape.HeightAt(x, z)
			minH = math.min(minH, h)
			maxH = math.max(maxH, h)
			check(h > MapConfig.MinY + 4 and h < MapConfig.MaxY - 4, string.format("height out of range at (%d, %d): %.1f", x, z, h))
			local material = shape.MaterialAt(x, z, h)
			check(validMaterials[material] == true, "unknown material " .. tostring(material))
		end
	end
end

-- 11) نفس الـ Seed = نفس الخريطة
local again = DesertShape.new(MapConfig)
check(again.HeightAt(333, -444) == shape.HeightAt(333, -444), "not deterministic")

print(string.format("heights %.1f .. %.1f", minH, maxH))
if failures > 0 then
	print(string.format("%d check(s) failed", failures))
	os.exit(1)
end
print("all DesertShape checks passed")
