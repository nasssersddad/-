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

-- 1) كل القواعد على أرض مستوية تماماً، وما تقطع أي طريق
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

for index = 1, plots.Count do
	local angle = math.rad(plots.AngleOffset + (index - 1) * 360 / plots.Count)
	local cx, cz = math.cos(angle) * plots.Radius, math.sin(angle) * plots.Radius
	-- محاور القاعدة: forward يطالع النص، right عمودي عليه (نفس CFrame.lookAt)
	local fx, fz = -math.cos(angle), -math.sin(angle)
	local rx, rz = -fz, fx
	local halfSize = plots.Size / 2
	for u = -halfSize, halfSize, halfSize / 4 do
		for v = -halfSize, halfSize, halfSize / 4 do
			local x, z = cx + rx * u + fx * v, cz + rz * u + fz * v
			check(math.abs(shape.HeightAt(x, z) - base) < 0.01, string.format("plot %d not flat at (%.0f, %.0f)", index, x, z))
			check(distanceToRoads(x, z) > roadHalf, string.format("plot %d overlaps a road at (%.0f, %.0f)", index, x, z))
		end
	end
end

-- 2) الطرق مستوية ومادتها إسفلت (برا الساحة)
for _, path in MapConfig.Roads.Paths do
	for i = 1, #path - 1 do
		local a, b = path[i], path[i + 1]
		for step = 0, 10 do
			local t = step / 10
			local x, z = a.X + (b.X - a.X) * t, a.Z + (b.Z - a.Z) * t
			local h = shape.HeightAt(x, z)
			check(math.abs(h - base) < 0.01, string.format("road not flat at (%.0f, %.0f): %.2f", x, z, h))
			if math.sqrt(x * x + z * z) > MapConfig.Town.PlazaRadius then
				check(shape.MaterialAt(x, z, h) == "Asphalt", string.format("road not asphalt at (%.0f, %.0f)", x, z))
			end
		end
	end
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
for dx = -100, 100, 8 do
	for dz = -100, 100, 8 do
		peak = math.max(peak, shape.HeightAt(tuwaiq.X + dx, tuwaiq.Z + dz))
	end
end
check(peak > MapConfig.DuneHeight + 20, string.format("tuwaiq peak too low: %.1f", peak))

-- 6) كل الخريطة داخل حدود الطبقات، والأطراف عالية
local validMaterials = {
	Sand = true, Sandstone = true, Rock = true, Ground = true, Pavement = true,
	Asphalt = true, Mud = true, LeafyGrass = true,
}
local half = MapConfig.Size / 2
local minH, maxH = math.huge, -math.huge
for x = -half + 2, half - 2, 16 do
	for z = -half + 2, half - 2, 16 do
		local h = shape.HeightAt(x, z)
		minH = math.min(minH, h)
		maxH = math.max(maxH, h)
		check(h > MapConfig.MinY + 4 and h < MapConfig.MaxY - 4, string.format("height out of range at (%d, %d): %.1f", x, z, h))
		local material = shape.MaterialAt(x, z, h)
		check(validMaterials[material] == true, "unknown material " .. tostring(material))
	end
end
for _, p in { { half - 6, 0 }, { -half + 6, 0 }, { 0, half - 6 }, { 0, -half + 6 } } do
	check(shape.HeightAt(p[1], p[2]) > base + 50, string.format("edge too low at (%d, %d)", p[1], p[2]))
end

-- 7) نفس الـ Seed = نفس الخريطة
local again = DesertShape.new(MapConfig)
check(again.HeightAt(333, -444) == shape.HeightAt(333, -444), "not deterministic")

print(string.format("heights %.1f .. %.1f", minH, maxH))
if failures > 0 then
	print(string.format("%d check(s) failed", failures))
	os.exit(1)
end
print("all DesertShape checks passed")
