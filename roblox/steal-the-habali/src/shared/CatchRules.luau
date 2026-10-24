--!strict
-- قواعد الصيد: كم تنقص الضربة، مين الهدف، والحمولة وسرعة السيارة.
-- دوال حسابية بس، تقبل Vector3 أو جدول { X, Y, Z }، فتقدر تنختبر برا روبلوكس.

type Vec = { X: number, Y: number, Z: number }
export type Candidate = { Position: Vec }

local CatchRules = {}

local function isFinite(n: number): boolean
	return n == n and math.abs(n) ~= math.huge
end

local function length(x: number, y: number, z: number): number
	return math.sqrt(x * x + y * y + z * z)
end

function CatchRules.new(config: any)
	local rules = {}

	-- كم تنقص الضربة من صحة الهبالي (الصحة من 1 لـ 0، وعند 0 يدوخ)
	function rules.Damage(kind: string, rarity: string): number
		if kind == "Melee" then
			local hits = config.Melee.HitsToStun[rarity]
			return if hits then 1 / hits else 0
		elseif kind == "Gun" then
			local shots = config.Gun.ShotsToStun[rarity]
			return if shots then 1 / shots else 0
		end
		return 0
	end

	-- يرجّع الصحة الجديدة، وهل دوّخ. الفرق الصغير عشان 1/3 × 3 ما يطلع 0.0000001
	function rules.ApplyDamage(health: number, damage: number): (number, boolean)
		local after = health - damage
		if after <= 1e-6 then
			return 0, true
		end
		return after, false
	end

	-- تقدر تحطه في السيارة؟ ("TooHeavy" = السيارة ما تشيله أبد، "Full" = فيها غيره)
	function rules.CanLoad(load: number, rarity: string, capacity: number, usedSlots: number, slots: number): (boolean, string?)
		local weight = config.Weight[rarity]
		if not weight then
			return false, "Unknown"
		end
		if weight > capacity then
			return false, "TooHeavy"
		end
		if load + weight > capacity or usedSlots >= slots then
			return false, "Full"
		end
		return true, nil
	end

	-- maxSpeed (اختياري): سرعة المحرك بعد التطوير
	function rules.CarSpeed(load: number, maxSpeed: number?): number
		local car = config.Car
		return (maxSpeed or car.MaxSpeed) * math.max(car.MinSpeedFactor, 1 - car.SlowPerWeight * load)
	end

	function rules.ShouldResist(rarity: string, roll: number): boolean
		local chance = config.Resist.Chance[rarity]
		return chance ~= nil and roll < chance
	end

	-- العقال: أقرب واحد قدامك داخل المدى (لو لاصق فيك ما يهم الاتجاه)
	function rules.PickMeleeTarget(origin: Vec, look: Vec, candidates: { Candidate }, range: number): number?
		local best, bestDistance = nil, math.huge
		local lookLength = length(look.X, 0, look.Z)
		for index, candidate in candidates do
			local p = candidate.Position
			local dx, dy, dz = p.X - origin.X, p.Y - origin.Y, p.Z - origin.Z
			local distance = length(dx, dy, dz)
			if distance <= range and distance < bestDistance then
				local flat = length(dx, 0, dz)
				local inFront = flat < 2 or lookLength == 0 or (dx * look.X + dz * look.Z) / (flat * lookLength) >= 0
				if inFront then
					best, bestDistance = index, distance
				end
			end
		end
		return best
	end

	-- المسدس: أقرب واحد لخط التصويب داخل المخروط والمدى
	function rules.PickGunTarget(origin: Vec, aim: Vec, candidates: { Candidate }, range: number, coneDegrees: number): number?
		local aimLength = length(aim.X, aim.Y, aim.Z)
		if aimLength == 0 then
			return nil
		end
		local minDot = math.cos(math.rad(coneDegrees))
		local best, bestDot = nil, -math.huge
		for index, candidate in candidates do
			local p = candidate.Position
			local dx, dy, dz = p.X - origin.X, p.Y - origin.Y, p.Z - origin.Z
			local distance = length(dx, dy, dz)
			if distance > 0 and distance <= range then
				local dot = (dx * aim.X + dy * aim.Y + dz * aim.Z) / (distance * aimLength)
				if dot >= minDot and dot > bestDot then
					best, bestDot = index, dot
				end
			end
		end
		return best
	end

	-- اتجاه التصويب جاي من اللاعب: لازم يكون رقم حقيقي ومو صفر
	function rules.IsValidDirection(v: any): boolean
		if typeof(v) ~= "Vector3" and type(v) ~= "table" then
			return false
		end
		local x, y, z = v.X, v.Y, v.Z
		if type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number" then
			return false
		end
		if not (isFinite(x) and isFinite(y) and isFinite(z)) then
			return false
		end
		local l = length(x, y, z)
		return l > 0.5 and l < 1.5
	end

	return rules
end

return CatchRules
