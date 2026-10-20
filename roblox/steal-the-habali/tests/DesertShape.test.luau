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
local roads = MapConfig.Roads
local roadHalf = roads.Width / 2
local roadFlat = roadHalf + roads.Shoulder
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

-- 2) الطرق: إسفلت (وكتف فاتح) مستوي بالعرض، ميلانه خفيف للسيارات، يمشي فوق الكثبان
--    مو في خندق، وكل طريق يوصل لمعلم في الأسطوري
local legendary = MapConfig.Zones[#MapConfig.Zones]
for roadIndex, path in roads.Paths do
	local a, b = path[1], path[#path]
	local length = radiusOf(b.X - a.X, b.Z - a.Z)
	local dx, dz = (b.X - a.X) / length, (b.Z - a.Z) / length
	local px, pz = -dz, dx -- عمودي على الطريق
	local previous: number? = nil
	local sides, deep = 0, 0
	local trenchSum, trenchCount = 0, 0
	for along = 0, length, 8 do
		local x, z = a.X + dx * along, a.Z + dz * along
		local h = shape.HeightAt(x, z)
		if radiusOf(x, z) > MapConfig.Town.PlazaRadius then
			check(shape.MaterialAt(x, z, h) == "Asphalt", string.format("road %d not asphalt at (%.0f, %.0f)", roadIndex, x, z))
			local sx, sz = x + px * (roadHalf + roads.Shoulder / 2), z + pz * (roadHalf + roads.Shoulder / 2)
			check(shape.MaterialAt(sx, sz, shape.HeightAt(sx, sz)) == "Concrete", string.format("road %d has no shoulder at (%.0f, %.0f)", roadIndex, sx, sz))
		end
		for _, side in { -1, 1 } do
			local ex, ez = x + px * side * (roadFlat - 1), z + pz * side * (roadFlat - 1)
			check(math.abs(shape.RoadLevelAt(ex, ez) - shape.RoadLevelAt(x, z)) < 0.05, string.format("road %d not flat across at (%.0f, %.0f)", roadIndex, x, z))
		end
		if previous then
			check(math.abs(h - previous) / 8 < 0.3, string.format("road %d too steep at (%.0f, %.0f)", roadIndex, x, z))
		end
		previous = h
		-- خندق؟ نقارن الطريق بالأرض اللي جنبه بعد الانحدار
		if along > MapConfig.Town.Radius + MapConfig.Town.Blend and along < length - roads.EndFade then
			for _, side in { -1, 1 } do
				local reach = roadFlat + roads.FlatMargin + roads.Blend + 10
				local ox, oz = x + px * side * reach, z + pz * side * reach
				local diff = shape.HeightAt(ox, oz) - shape.RoadLevelAt(x, z)
				trenchSum += diff
				trenchCount += 1
				sides += 1
				if diff > 25 then
					deep += 1
				end
			end
		end
	end
	check(trenchSum / trenchCount < 10, string.format("road %d sits in a trench (sides %.1f studs higher on average)", roadIndex, trenchSum / trenchCount))
	check(deep / sides < 0.1, string.format("road %d has deep cuts on %.0f%% of its length", roadIndex, deep / sides * 100))
	check(radiusOf(b.X, b.Z) >= legendary.MinRadius, string.format("road ends before the legendary ring at (%d, %d)", b.X, b.Z))
	local nearest = math.huge
	for _, landmark in MapConfig.Landmarks do
		nearest = math.min(nearest, radiusOf(b.X - landmark.X, b.Z - landmark.Z) - landmark.Radius)
	end
	check(nearest < 120, string.format("road end (%d, %d) is %.0f studs from any landmark", b.X, b.Z, nearest))
end

-- 3) الواحة: الوسط تحت مستوى الموية ومعلّم كموية، وحوله عشب
local oasis = assert(MapConfig.GetLandmark("Oasis"))
check(shape.HeightAt(oasis.X, oasis.Z) < MapConfig.WaterLevel - 2, "oasis center not below water")
check(shape.IsWaterAt(oasis.X, oasis.Z), "oasis center not water")
local ringX, ringZ = oasis.X + oasis.Radius * 0.8, oasis.Z
check(shape.MaterialAt(ringX, ringZ, shape.HeightAt(ringX, ringZ)) == "LeafyGrass", "oasis ring not grass")
check(not shape.IsWaterAt(0, 0), "water in town")

-- 4) الوادي عريض وعميق، وحافته أعلى من الكثبان حوله
local canyon = MapConfig.Canyon
local canyonPoint = canyon.Path[2]
check(shape.HeightAt(canyonPoint.X, canyonPoint.Z) < base - canyon.Depth + 5, "canyon too shallow")
check(shape.HeightAt(canyonPoint.X + canyon.Width * 0.4, canyonPoint.Z) < base - canyon.Depth + 5, "canyon floor too narrow")
local rimPeak = -math.huge
for dz = -200, 200, 20 do
	rimPeak = math.max(rimPeak, shape.HeightAt(canyonPoint.X - canyon.Width, canyonPoint.Z + dz))
end
check(rimPeak > MapConfig.DuneHeight, string.format("canyon rim too low: %.1f", rimPeak))

-- 5) طويق: سلسلة جبال عالية على طول خط القمة (مو صخرة وحدة)
local tuwaiq = MapConfig.Tuwaiq
local highPoints = 0
for i = 1, #tuwaiq.Ridge - 1 do
	local a, b = tuwaiq.Ridge[i], tuwaiq.Ridge[i + 1]
	local segmentPeak = -math.huge
	for t = 0, 1, 0.05 do
		segmentPeak = math.max(segmentPeak, shape.HeightAt(a.X + (b.X - a.X) * t, a.Z + (b.Z - a.Z) * t))
	end
	check(segmentPeak > 150, string.format("tuwaiq segment %d peak too low: %.1f", i, segmentPeak))
	if segmentPeak > 150 then
		highPoints += 1
	end
end
check(highPoints == #tuwaiq.Ridge - 1, "tuwaiq is not a continuous range")

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

-- 6ب) الحد بين طبقتين متداخل (فيه رمل الثنتين)، وبرا منطقة التداخل رمل وحدة بس
local blend = MapConfig.ZoneBlend
for i = 2, #zones do
	local border = zones[i].MinRadius
	local inner, outer, mixedSamples = 0, 0, 0
	for k = 0, 359, 3 do
		local angle = math.rad(k + 1.5)
		local c, s = math.cos(angle), math.sin(angle)
		if math.abs(c) > 0.1 and math.abs(s) > 0.1 then -- بعيد عن الطرق
			local x, z = c * border, s * border
			local material = shape.MaterialAt(x, z, shape.HeightAt(x, z))
			mixedSamples += 1
			if material == zones[i - 1].Material then
				inner += 1
			elseif material == zones[i].Material then
				outer += 1
			end
			local reach = blend / 2 + MapConfig.ZoneWave + 15
			for _, offset in { -reach, reach } do
				local rx, rz = c * (border + offset), s * (border + offset)
				local want = if offset < 0 then zones[i - 1] else zones[i]
				local got = shape.MaterialAt(rx, rz, shape.HeightAt(rx, rz))
				if got ~= "Slate" and got ~= "Basalt" and got ~= "Rock" and got ~= "Mud" and got ~= "LeafyGrass" then
					check(got == want.Material, string.format("%s border not clean at %.0f: %s", zones[i].Id, border + offset, got))
				end
			end
		end
	end
	check(inner > mixedSamples * 0.15 and outer > mixedSamples * 0.15, string.format("%s border is not blended (%d inner, %d outer of %d)", zones[i].Id, inner, outer, mixedSamples))
end

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
		check(distanceToRoads(x, z) > roadFlat + 2, string.format("gas station on a road at (%.0f, %.0f)", x, z))
		check(not insideAnyPlot(x, z, 2), string.format("gas station inside a plot at (%.0f, %.0f)", x, z))
		check(radiusOf(x, z) > MapConfig.Town.PlazaRadius and radiusOf(x, z) < MapConfig.Town.Radius, "gas station outside the town ring")
	end
end
check(distanceToRoads(station.X, station.Z) < station.Depth / 2 + roadFlat + 12, "gas station too far from a road")

-- 10) كل الخريطة داخل حدود الطبقات، وكل المواد معروفة
local validMaterials = {
	Ground = true, Pavement = true, Asphalt = true, Mud = true, LeafyGrass = true,
	Rock = true, Basalt = true, Slate = true, Concrete = true,
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
