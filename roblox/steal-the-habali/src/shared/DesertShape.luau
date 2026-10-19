--!strict
-- شكل الصحراء: يحسب ارتفاع الأرض ونوعها لأي نقطة (X, Z).
-- دوال حسابية بس، ما تلمس اللعبة، فتقدر تنختبر برا روبلوكس.
-- MapBuilder يستخدمها عشان يكتب التضاريس.

type Point = { X: number, Z: number }

export type Shape = {
	HeightAt: (x: number, z: number) -> number,
	MaterialAt: (x: number, z: number, height: number) -> string,
	IsWaterAt: (x: number, z: number) -> boolean,
}

local DesertShape = {}

local function clamp01(t: number): number
	return math.clamp(t, 0, 1)
end

-- انتقال ناعم: 0 قبل edge0، و1 بعد edge1
local function smoothstep(edge0: number, edge1: number, x: number): number
	local t = clamp01((x - edge0) / (edge1 - edge0))
	return t * t * (3 - 2 * t)
end

local function lerp(a: number, b: number, t: number): number
	return a + (b - a) * t
end

local function distance(x: number, z: number, px: number, pz: number): number
	local dx, dz = x - px, z - pz
	return math.sqrt(dx * dx + dz * dz)
end

local function distanceToSegment(x: number, z: number, a: Point, b: Point): number
	local abx, abz = b.X - a.X, b.Z - a.Z
	local lengthSq = abx * abx + abz * abz
	if lengthSq == 0 then
		return distance(x, z, a.X, a.Z)
	end
	local t = clamp01(((x - a.X) * abx + (z - a.Z) * abz) / lengthSq)
	return distance(x, z, a.X + abx * t, a.Z + abz * t)
end

local function distanceToPath(x: number, z: number, path: { Point }): number
	local best = math.huge
	for i = 1, #path - 1 do
		best = math.min(best, distanceToSegment(x, z, path[i], path[i + 1]))
	end
	return best
end

function DesertShape.new(config: any): Shape
	local seed = config.Seed * 0.0137
	local half = config.Size / 2
	local base = config.BaseHeight
	local town = config.Town
	local roads = config.Roads
	local canyon = config.Canyon
	local oasis = config.GetLandmark("Oasis")
	local tuwaiq = config.GetLandmark("Tuwaiq")
	local junkyard = config.GetLandmark("Junkyard")

	-- كثبان: موجة كبيرة بقمم حادة + تموجات صغيرة فوقها (0 إلى 1 تقريباً)
	local function dunes(x: number, z: number): number
		local big = math.noise(x / 430 + seed, z / 430 - seed, 0.31)
		local mid = math.noise(x / 170 - seed, z / 170 + seed, 1.73)
		local ripple = math.noise(x / 46 + seed, z / 46, 2.59)
		local crest = 1 - math.abs(big * 1.6)
		return clamp01(crest * 0.65 + (mid * 0.5 + 0.5) * 0.3 + ripple * 0.06)
	end

	-- صخور طويق: قمم حادة تطلع من الرمل
	local function rockiness(x: number, z: number): number
		if not tuwaiq then
			return 0
		end
		local falloff = 1 - smoothstep(tuwaiq.Radius * 0.55, tuwaiq.Radius, distance(x, z, tuwaiq.X, tuwaiq.Z))
		if falloff <= 0 then
			return 0
		end
		local ridged = 1 - math.abs(math.noise(x / 70 + seed, z / 70 - seed, 3.11) * 2)
		return clamp01(ridged) ^ 2 * falloff
	end

	local function roadDistance(x: number, z: number): number
		local best = math.huge
		for _, path in roads.Paths do
			best = math.min(best, distanceToPath(x, z, path))
		end
		return best
	end

	local function heightAt(x: number, z: number): number
		local h = base + config.DuneHeight * dunes(x, z)

		h += rockiness(x, z) * 85

		-- الأطراف ترتفع وتقفل الخريطة
		local edge = math.max(math.abs(x), math.abs(z))
		h += smoothstep(half - config.EdgeWallWidth, half, edge) * config.EdgeWallHeight

		-- الوادي: نحفر مجرى عميق
		local canyonDist = distanceToPath(x, z, canyon.Path)
		h = lerp(base - canyon.Depth, h, smoothstep(canyon.Width * 0.35, canyon.Width, canyonDist))

		-- الواحة: حوض ينملي موية
		if oasis then
			local d = distance(x, z, oasis.X, oasis.Z)
			h = lerp(config.WaterLevel - 8, h, smoothstep(oasis.Radius * 0.45, oasis.Radius, d))
		end

		-- مقبرة السيارات: ساحة مستوية
		if junkyard then
			local d = distance(x, z, junkyard.X, junkyard.Z)
			h = lerp(base, h, smoothstep(junkyard.Radius, junkyard.Radius + 50, d))
		end

		-- الطرق: الأرض حولها مستوية
		h = lerp(base, h, smoothstep(roads.Width / 2, roads.Width / 2 + roads.Blend, roadDistance(x, z)))

		-- الديرة: مستوية تماماً
		h = lerp(base, h, smoothstep(town.Radius, town.Radius + town.Blend, distance(x, z, 0, 0)))

		return h
	end

	local function materialAt(x: number, z: number, height: number): string
		local fromCenter = distance(x, z, 0, 0)
		if fromCenter < town.PlazaRadius then
			return "Pavement"
		end
		if roadDistance(x, z) < roads.Width / 2 and height <= base + 1 then
			return "Asphalt"
		end
		if fromCenter < town.Radius then
			return "Ground"
		end
		if oasis then
			local d = distance(x, z, oasis.X, oasis.Z)
			if d < oasis.Radius * 0.6 then
				return "Mud"
			elseif d < oasis.Radius * 1.05 then
				return "LeafyGrass"
			end
		end
		local rock = rockiness(x, z)
		if rock > 0.45 then
			return "Rock"
		elseif rock > 0.15 then
			return "Sandstone"
		end
		if distanceToPath(x, z, canyon.Path) < canyon.Width then
			return "Sandstone"
		end
		return "Sand"
	end

	local function isWaterAt(x: number, z: number): boolean
		return oasis ~= nil and distance(x, z, oasis.X, oasis.Z) < oasis.Radius * 0.6
	end

	return {
		HeightAt = heightAt,
		MaterialAt = materialAt,
		IsWaterAt = isWaterAt,
	}
end

return DesertShape
