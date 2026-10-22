--!strict
-- حسابات المحلات: الليفل الجاي وسعره، وقوة السلاح والسيارة حسب الليفل، والبيع والبنزين.
-- دوال بس (بدون روبلوكس) عشان تنختبر برا. السيرفر هو اللي يناديها، والجوال يعرض بس.

local ShopRules = {}

export type Gear = { Melee: number, Gun: number, Engine: number, Load: number, Tank: number }

local KEYS = { "Melee", "Gun", "Engine", "Load", "Tank" }

local function isFinite(n: any): boolean
	return type(n) == "number" and n == n and math.abs(n) ~= math.huge
end

function ShopRules.new(shopConfig: any, baseConfig: any)
	local rules = {}

	function rules.Keys(): { string }
		return KEYS
	end

	function rules.DefaultGear(): Gear
		return { Melee = 1, Gun = 1, Engine = 1, Load = 1, Tank = 1 }
	end

	-- من أي شي محفوظ لليفلات سليمة (ناقص = 1، أكبر من الموجود = آخر ليفل)
	function rules.SanitizeGear(raw: any): Gear
		local gear = rules.DefaultGear()
		if type(raw) == "table" then
			for _, key in KEYS do
				local value = raw[key]
				if isFinite(value) then
					gear[key] = math.clamp(math.floor(value), 1, #shopConfig[key])
				end
			end
		end
		return gear
	end

	-- الليفل الجاي وسعره، أو nil لو خلّص
	function rules.Next(gear: Gear, key: string): (any?, number?)
		local ladder = shopConfig[key]
		local current = (gear :: any)[key]
		if type(ladder) ~= "table" or type(current) ~= "number" then
			return nil, nil
		end
		local nextLevel = ladder[current + 1]
		if not nextLevel then
			return nil, nil
		end
		return nextLevel, nextLevel.Price
	end

	-- يقدر يشتري؟ يرجّع (true, سعر) أو (false, السبب: "Unknown" / "Max" / "Money")
	function rules.CanBuy(gear: Gear, key: string, money: number): (boolean, any)
		if shopConfig.Upgrades[key] == nil then
			return false, "Unknown"
		end
		local nextLevel, price = rules.Next(gear, key)
		if not nextLevel then
			return false, "Max"
		end
		if money < (price :: number) then
			return false, "Money"
		end
		return true, price
	end

	function rules.Level(key: string, level: number): any
		local ladder = shopConfig[key]
		return ladder[math.clamp(level, 1, #ladder)]
	end

	-- كم تنقص الضربة من صحة الهبالي (1 = يدوخ على طول)
	function rules.Damage(gear: Gear, kind: string, rarity: string): number
		if kind == "Melee" then
			local hits = rules.Level("Melee", gear.Melee).Hits[rarity]
			return if hits then 1 / hits else 0
		elseif kind == "Gun" then
			local shots = rules.Level("Gun", gear.Gun).Shots[rarity]
			return if shots then 1 / shots else 0
		end
		return 0
	end

	function rules.CarStats(gear: Gear): (number, number, number)
		return rules.Level("Engine", gear.Engine).Speed, rules.Level("Load", gear.Load).Capacity, rules.Level("Tank", gear.Tank).Size
	end

	-- أبو هبال: دخل SellSeconds ثانية من الهبالي
	function rules.SellPrice(rarity: string, variant: string?): number
		local base = baseConfig.Income[rarity] or 0
		local multiplier = baseConfig.VariantMultiplier[variant or "Normal"] or 1
		return math.floor(base * multiplier * shopConfig.SellSeconds)
	end

	-- كم يكلف تعبّي من fuel لين tank (بالـ stud)، مقرّب لفوق
	function rules.RefillCost(fuel: number, tank: number): number
		local missing = math.max(0, tank - math.max(0, fuel))
		return math.ceil(missing * shopConfig.Fuel.PricePerStud)
	end

	-- كم تعبّي بفلوسك لو ما تكفي لفل: (كم stud، كم تدفع)
	function rules.AffordableFuel(fuel: number, tank: number, money: number): (number, number)
		local missing = math.max(0, tank - math.max(0, fuel))
		local studs = math.min(missing, math.floor(math.max(0, money) / shopConfig.Fuel.PricePerStud))
		return studs, math.ceil(studs * shopConfig.Fuel.PricePerStud)
	end

	-- البنزين بعد ما مشت السيارة مسافة
	function rules.Burn(fuel: number, distance: number): number
		if not isFinite(distance) or distance <= 0 then
			return fuel
		end
		return math.max(0, fuel - distance)
	end

	function rules.SanitizeFuel(raw: any, tank: number): number
		if isFinite(raw) then
			return math.clamp(raw, 0, tank)
		end
		return tank -- أول مرة: تانكي مليان
	end

	function rules.SanitizeJerries(raw: any): number
		if isFinite(raw) then
			return math.clamp(math.floor(raw), 0, shopConfig.Fuel.MaxJerries)
		end
		return 0
	end

	return rules
end

return ShopRules
