--!strict
-- شكل الصحراء: يحسب ارتفاع الأرض ونوعها لأي نقطة (X, Z).
-- دوال حسابية بس، ما تلمس اللعبة، فتقدر تنختبر برا روبلوكس.
-- MapBuilder يستخدمها عشان يكتب التضاريس.

type Point = { X: number, Z: number }
type RoadHit = { X: number, Z: number, DirX: number, DirZ: number, Along: number, Length: number }

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

-- أقرب نقطة على الخط: المسافة لها، ونسبتها على القطعة (0 إلى 1)
local function nearestOnSegment(x: number, z: number, a: Point, b: Point): (number, number)
	local abx, abz = b.X - a.X, b.Z - a.Z
	local lengthSq = abx * abx + abz * abz
	if lengthSq == 0 then
		return distance(x, z, a.X, a.Z), 0
	end
	local t = clamp01(((x - a.X) * abx + (z - a.Z) * abz) / lengthSq)
	return distance(x, z, a.X + abx * t, a.Z + abz * t), t
end

local function distanceToPath(x: number, z: number, path: { Point }): number
	local best = math.huge
	for i = 1, #path - 1 do
		best = math.min(best, (nearestOnSegment(x, z, path[i], path[i + 1])))
	end
	return best
end

function DesertShape.new(config: any): Shape
	local seed = config.Seed * 0.0137
	local base = config.BaseHeight
	local edge = config.Edge
	local town = config.Town
	local roads = config.Roads
	local canyon = config.Canyon
	local tuwaiqConfig = config.Tuwaiq
	local oasis = config.GetLandmark("Oasis")
	local junkyard = config.GetLandmark("Junkyard")
	local zones = config.Zones
	local outerZone = zones[#zones]
	local roadFlat = roads.Width / 2 + roads.Shoulder

	-- طول كل طريق (عشان نعرف وين ينزل لمستوى الأرض عند آخره)
	local roadLengths = {}
	for index, path in roads.Paths do
		local length = 0
		for i = 1, #path - 1 do
			length += distance(path[i].X, path[i].Z, path[i + 1].X, path[i + 1].Z)
		end
		roadLengths[index] = length
	end

	-- الشكل العام للكثبان: موجة كبيرة بقمم حادة + موجة متوسطة (0 إلى 1 تقريباً)
	local function broadDunes(x: number, z: number): number
		local big = math.noise(x / 430 + seed, z / 430 - seed, 0.31)
		local mid = math.noise(x / 170 - seed, z / 170 + seed, 1.73)
		local crest = 1 - math.abs(big * 1.6)
		return crest * 0.65 + (mid * 0.5 + 0.5) * 0.3
	end

	-- الكثبان كاملة: الشكل العام + تموجات صغيرة
	local function dunes(x: number, z: number): number
		local ripple = math.noise(x / 46 + seed, z / 46, 2.59)
		return clamp01(broadDunes(x, z) + ripple * 0.06)
	end

	-- جبال طويق: سلسلة على طول خط القمة، قممها حادة ومتفاوتة (0 إلى 1)
	local function ridge(x: number, z: number): number
		local d = distanceToPath(x, z, tuwaiqConfig.Ridge)
		if d >= tuwaiqConfig.Width then
			return 0
		end
		local profile = 1 - smoothstep(tuwaiqConfig.Width * 0.12, tuwaiqConfig.Width, d)
		local crag = 1 - math.abs(math.noise(x / 60 + seed, z / 60 - seed, 3.11) * 2)
		local peaks = 0.75 + 0.25 * math.noise(x / 260 - seed, z / 260 + seed, 4.21)
		return profile * (0.6 + 0.4 * clamp01(crag)) * peaks
	end

	-- أقرب طريق: المسافة له، ومكان أقرب نقطة عليه (عشان نحسب ارتفاعه بس لو احتجناه)
	local function nearestRoad(x: number, z: number): (number, RoadHit)
		local bestDistance = math.huge
		local hit: RoadHit = { X = 0, Z = 0, DirX = 1, DirZ = 0, Along = 0, Length = 1 }
		for index, path in roads.Paths do
			local travelled = 0
			for i = 1, #path - 1 do
				local a, b = path[i], path[i + 1]
				local d, t = nearestOnSegment(x, z, a, b)
				local segment = distance(a.X, a.Z, b.X, b.Z)
				if d < bestDistance then
					bestDistance = d
					hit.X, hit.Z = a.X + (b.X - a.X) * t, a.Z + (b.Z - a.Z) * t
					hit.DirX, hit.DirZ = (b.X - a.X) / segment, (b.Z - a.Z) / segment
					hit.Along, hit.Length = travelled + segment * t, roadLengths[index]
				end
				travelled += segment
			end
		end
		return bestDistance, hit
	end

	-- ارتفاع الطريق: يتبع الشكل العام للكثبان (فوقها مو في خندق)، متوسط على 120 stud عشان
	-- القمم الحادة ما تخلي الطلعة قوية، ومستوي في الديرة وعند آخره
	local ROAD_SMOOTHING = { { -60, 1 }, { -30, 2 }, { 0, 3 }, { 30, 2 }, { 60, 1 } }
	local function roadHeight(hit: RoadHit): number
		local fade = smoothstep(town.Radius, town.Radius + roads.Ramp, hit.Along)
			* (1 - smoothstep(hit.Length - roads.EndFade, hit.Length, hit.Along))
		if fade <= 0 then
			return base
		end
		local sum = 0
		for _, sample in ROAD_SMOOTHING do
			sum += clamp01(broadDunes(hit.X + hit.DirX * sample[1], hit.Z + hit.DirZ * sample[1])) * sample[2]
		end
		return base + config.DuneHeight * roads.Elevation * (sum / 9) * fade
	end

	local function heightAt(x: number, z: number): number
		local fromCenter = distance(x, z, 0, 0)
		local h = base + config.DuneHeight * dunes(x, z)

		h += ridge(x, z) * tuwaiqConfig.Peak

		-- حزام الكثبان على الحافة يرتفع ويقفل الخريطة
		h += smoothstep(edge.Start, edge.Crest, fromCenter) * edge.Height

		-- الوادي: حافة مرتفعة شوي، وبعدها مجرى عريض وعميق
		local canyonDist = distanceToPath(x, z, canyon.Path)
		if canyonDist < canyon.Width + canyon.RimWidth then
			local rim = smoothstep(canyon.Width * 0.8, canyon.Width, canyonDist)
				* (1 - smoothstep(canyon.Width, canyon.Width + canyon.RimWidth, canyonDist))
			h += rim * canyon.RimHeight
			if canyonDist < canyon.Width then
				h = lerp(base - canyon.Depth, h, smoothstep(canyon.Width * 0.45, canyon.Width * 0.9, canyonDist))
			end
		end

		-- الواحة: حوض ينملي موية
		if oasis then
			local d = distance(x, z, oasis.X, oasis.Z)
			if d < oasis.Radius then
				h = lerp(config.WaterLevel - 8, h, smoothstep(oasis.Radius * 0.45, oasis.Radius, d))
			end
		end

		-- مقبرة السيارات: ساحة مستوية
		if junkyard then
			local d = distance(x, z, junkyard.X, junkyard.Z)
			h = lerp(base, h, smoothstep(junkyard.Radius, junkyard.Radius + 50, d))
		end

		-- الديرة: مستوية تماماً
		h = lerp(base, h, smoothstep(town.Radius, town.Radius + town.Blend, fromCenter))

		-- الطرق آخر شي: الإسفلت والكتف مستويين على ارتفاع الطريق، وبعدها تنحدر للأرض حولها
		-- (داخل الديرة ارتفاع الطريق = الأرض، فما يتغير شي)
		local roadDistance, hit = nearestRoad(x, z)
		if roadDistance < roadFlat + roads.Blend then
			h = lerp(roadHeight(hit), h, smoothstep(roadFlat, roadFlat + roads.Blend, roadDistance))
		end

		return h
	end

	-- رمل الطبقات: عند الحد يتداخل رمل الطبقتين بشكل منقّط بدل خط حاد
	local function zoneMaterial(x: number, z: number, fromCenter: number): string
		local speckle = math.noise(x / 18 + seed, z / 18 - seed, 7.7) * 0.6 + math.noise(x / 90 - seed, z / 90 + seed, 8.8) * 0.4
		local wave = math.noise(x / 380 + seed, z / 380 - seed, 9.9)
		local blended = fromCenter + math.clamp(speckle * 1.4, -1, 1) * config.ZoneBlend / 2 + math.clamp(wave * 1.6, -1, 1) * config.ZoneWave
		local zone = config.GetZoneAt(blended)
		if zone then
			return zone.Material
		elseif blended < zones[1].MinRadius then
			return zones[1].Material
		end
		return outerZone.Material
	end

	local function materialAt(x: number, z: number, height: number): string
		local fromCenter = distance(x, z, 0, 0)
		if fromCenter < town.PlazaRadius then
			return "Pavement"
		end
		local roadDistance = nearestRoad(x, z)
		if roadDistance < roads.Width / 2 then
			return "Asphalt"
		elseif roadDistance < roadFlat then
			return "Concrete"
		end
		if fromCenter < town.Radius then
			return town.Material
		end
		if oasis then
			local d = distance(x, z, oasis.X, oasis.Z)
			if d < oasis.Radius * 0.6 then
				return "Mud"
			elseif d < oasis.Radius * 1.05 then
				return "LeafyGrass"
			end
		end
		local rock = ridge(x, z)
		if rock > 0.45 then
			return "Rock"
		elseif rock > 0.12 then
			return "Basalt"
		end
		if distanceToPath(x, z, canyon.Path) < canyon.Width * 0.95 then
			return "Slate"
		end
		return zoneMaterial(x, z, fromCenter)
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
