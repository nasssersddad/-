--!strict
-- قواعد طلوع الهبالي: وين يطلعون، ووين يمشون، ونرد الذهبي والدايموند.
-- دوال حسابية بس، ما تلمس اللعبة، فتقدر تنختبر برا روبلوكس.
-- النرد يجي من برا (rng يرجّع رقم من 0 لـ 1) عشان السيرفر يستخدم Random والاختبار رقم ثابت.

type Point = { X: number, Z: number }
export type Rng = () -> number

export type Rules = {
	IsAllowed: (x: number, z: number, zoneId: string) -> boolean,
	IsPathAllowed: (x1: number, z1: number, x2: number, z2: number, zoneId: string) -> boolean,
	SamplePoint: (zoneId: string, rng: Rng) -> (number?, number?),
	WanderTarget: (x: number, z: number, zoneId: string, rng: Rng) -> (number?, number?),
	PointNear: (zoneId: string, angle: number, radius: number) -> (number?, number?),
	RollVariant: (rng: Rng, multiplier: number?) -> string,
	PickCharacter: (rng: Rng) -> string,
}

local HabaliRules = {}

local function distanceToSegment(x: number, z: number, a: Point, b: Point): number
	local abx, abz = b.X - a.X, b.Z - a.Z
	local lengthSq = abx * abx + abz * abz
	local t = if lengthSq > 0 then math.clamp(((x - a.X) * abx + (z - a.Z) * abz) / lengthSq, 0, 1) else 0
	local dx, dz = x - a.X - abx * t, z - a.Z - abz * t
	return math.sqrt(dx * dx + dz * dz)
end

local function distanceToPath(x: number, z: number, path: { Point }): number
	local best = math.huge
	for i = 1, #path - 1 do
		best = math.min(best, distanceToSegment(x, z, path[i], path[i + 1]))
	end
	return best
end

function HabaliRules.new(mapConfig: any, habaliConfig: any): Rules
	local wander = habaliConfig.Wander
	local zonesById = {}
	for _, zone in mapConfig.Zones do
		zonesById[zone.Id] = zone
	end
	-- الندرات الخاصة تمشي بحدود طبقتها
	for _, special in mapConfig.Specials or {} do
		zonesById[special.Id] = zonesById[special.Zone]
	end

	local function isAllowed(x: number, z: number, zoneId: string): boolean
		local zone = zonesById[zoneId]
		if not zone then
			return false
		end
		local fromCenter = math.sqrt(x * x + z * z)
		if fromCenter < zone.MinRadius + wander.ZoneMargin or fromCenter > zone.MaxRadius - wander.ZoneMargin then
			return false
		end
		for _, path in mapConfig.Roads.Paths do
			if distanceToPath(x, z, path) < wander.RoadClearance then
				return false
			end
		end
		for _, landmark in mapConfig.Landmarks do
			local dx, dz = x - landmark.X, z - landmark.Z
			if math.sqrt(dx * dx + dz * dz) < landmark.Radius + wander.LandmarkMargin then
				return false
			end
		end
		if mapConfig.Tuwaiq and distanceToPath(x, z, mapConfig.Tuwaiq.Ridge) < mapConfig.Tuwaiq.Width + wander.RidgeMargin then
			return false
		end
		if mapConfig.Canyon and distanceToPath(x, z, mapConfig.Canyon.Path) < mapConfig.Canyon.Width + wander.RidgeMargin then
			return false
		end
		return true
	end

	-- نفحص كم نقطة على الخط عشان المشوار ما يقطع طريق أو يدخل معلم
	local function isPathAllowed(x1: number, z1: number, x2: number, z2: number, zoneId: string): boolean
		local checks = wander.PathChecks
		for i = 0, checks do
			local t = i / checks
			if not isAllowed(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, zoneId) then
				return false
			end
		end
		return true
	end

	-- نقطة عشوائية بالتساوي على مساحة الحلقة (مو أكثر قرب الداخل)
	local function samplePoint(zoneId: string, rng: Rng): (number?, number?)
		local zone = zonesById[zoneId]
		if not zone then
			return nil, nil
		end
		local inner, outer = zone.MinRadius + wander.ZoneMargin, zone.MaxRadius - wander.ZoneMargin
		for _ = 1, wander.SampleTries do
			local radius = math.sqrt(inner * inner + rng() * (outer * outer - inner * inner))
			local angle = rng() * 2 * math.pi
			local x, z = math.cos(angle) * radius, math.sin(angle) * radius
			if isAllowed(x, z, zoneId) then
				return x, z
			end
		end
		return nil, nil
	end

	local function wanderTarget(x: number, z: number, zoneId: string, rng: Rng): (number?, number?)
		for _ = 1, 8 do
			local distance = wander.StepMin + rng() * (wander.StepMax - wander.StepMin)
			local angle = rng() * 2 * math.pi
			local tx, tz = x + math.cos(angle) * distance, z + math.sin(angle) * distance
			if isPathAllowed(x, z, tx, tz, zoneId) then
				return tx, tz
			end
		end
		return nil, nil
	end

	-- أقرب مكان مسموح لزاوية ومسافة معينة: نلف يمين ويسار شوي شوي
	local function pointNear(zoneId: string, angle: number, radius: number): (number?, number?)
		local hook = habaliConfig.Hook
		for i = 0, hook.MaxAngleTries do
			local offset = math.rad(hook.AngleStep * math.ceil(i / 2)) * (if i % 2 == 0 then 1 else -1)
			local x, z = math.cos(angle + offset) * radius, math.sin(angle + offset) * radius
			if isAllowed(x, z, zoneId) then
				return x, z
			end
		end
		return nil, nil
	end

	-- multiplier (اختياري): العاصفة الرملية تضرب الفرص (×3)
	local function rollVariant(rng: Rng, multiplier: number?): string
		local roll = rng()
		local total = 0
		for _, variant in habaliConfig.Variants do
			total += variant.Chance * (multiplier or 1)
			if roll < total then
				return variant.Id
			end
		end
		return habaliConfig.NormalVariant
	end

	local function pickCharacter(rng: Rng): string
		local characters = habaliConfig.Characters
		local index = math.clamp(math.floor(rng() * #characters) + 1, 1, #characters)
		return characters[index].Id
	end

	return {
		IsAllowed = isAllowed,
		IsPathAllowed = isPathAllowed,
		SamplePoint = samplePoint,
		WanderTarget = wanderTarget,
		PointNear = pointNear,
		RollVariant = rollVariant,
		PickCharacter = pickCharacter,
	}
end

return HabaliRules
