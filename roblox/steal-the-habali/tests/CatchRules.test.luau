-- اختبار قواعد الصيد برا روبلوكس:
--   luau roblox/steal-the-habali/tests/CatchRules.test.luau

local CatchConfig = require("../src/shared/CatchConfig")
local CatchRules = require("../src/shared/CatchRules")
local MapConfig = require("../src/shared/MapConfig")

local rules = CatchRules.new(CatchConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

local function v(x: number, y: number, z: number)
	return { X = x, Y = y, Z = z }
end

-- كل ندرة لها أرقام كاملة
for _, zone in MapConfig.Zones do
	local id = zone.Id
	check(CatchConfig.Melee.HitsToStun[id] ~= nil, "hits " .. id)
	check(CatchConfig.Gun.ShotsToStun[id] ~= nil, "shots " .. id)
	check(CatchConfig.StunTime[id] ~= nil, "stun " .. id)
	check(CatchConfig.Drag.WalkSpeed[id] ~= nil, "walk " .. id)
	check(CatchConfig.Weight[id] ~= nil, "weight " .. id)
end

-- العدد المضبوط من الضربات يدوّخ، وواحدة أقل ما تدوّخ
local function hitsUntilStun(kind: string, rarity: string): number
	local health, count = 1, 0
	repeat
		local stunned
		health, stunned = rules.ApplyDamage(health, rules.Damage(kind, rarity))
		count += 1
	until stunned or count > 100
	return count
end
for rarity, hits in CatchConfig.Melee.HitsToStun do
	check(hitsUntilStun("Melee", rarity) == hits, "melee hits for " .. rarity)
end
for rarity, shots in CatchConfig.Gun.ShotsToStun do
	check(hitsUntilStun("Gun", rarity) == shots, "gun shots for " .. rarity)
end
check(rules.Damage("Laser", "Common") == 0, "unknown weapon does nothing")
check(rules.Damage("Melee", "Infinity") == 0, "unknown rarity does nothing")
-- ضربة عقال + طلقة على نادر مرة: 1/8 + 1/2 = ما يدوخ، وبعدها طلقة ثانية تدوخه
local h, s = rules.ApplyDamage(1, rules.Damage("Melee", "VeryRare"))
h, s = rules.ApplyDamage(h, rules.Damage("Gun", "VeryRare"))
check(not s, "mixed damage should not stun yet")
h, s = rules.ApplyDamage(h, rules.Damage("Gun", "VeryRare"))
check(s, "mixed damage should stun")

-- الحمولة: الربع ما تشيل نادر مرة ولا أسطوري
local car = CatchConfig.Car
check(select(2, rules.CanLoad(0, "VeryRare", car.Capacity, 0, car.Slots)) == "TooHeavy", "ruba can't carry VeryRare")
check(select(2, rules.CanLoad(0, "Legendary", car.Capacity, 0, car.Slots)) == "TooHeavy", "ruba can't carry Legendary")
check(rules.CanLoad(0, "Rare", car.Capacity, 0, car.Slots), "ruba carries a Rare")
check(rules.CanLoad(2, "Common", car.Capacity, 1, car.Slots), "Rare + Common fits")
check(select(2, rules.CanLoad(2, "Rare", car.Capacity, 1, car.Slots)) == "Full", "two Rares don't fit")
check(rules.CanLoad(2, "Common", car.Capacity, 2, car.Slots), "third common fits")
check(select(2, rules.CanLoad(1, "Common", 10, 3, 3)) == "Full", "slots full")
check(select(2, rules.CanLoad(0, "Nope", 10, 0, 3)) == "Unknown", "unknown rarity")

-- السرعة تنقص مع الوزن وما تنزل تحت الحد
check(rules.CarSpeed(0) == car.MaxSpeed, "empty car full speed")
check(math.abs(rules.CarSpeed(3) - car.MaxSpeed * (1 - 3 * car.SlowPerWeight)) < 1e-9, "3 weight speed")
check(rules.CarSpeed(1000) == car.MaxSpeed * car.MinSpeedFactor, "speed floor")

-- المقاومة: الشعبي والنادر ما يقاومون أبد
check(not rules.ShouldResist("Common", 0), "common never resists")
check(not rules.ShouldResist("Rare", 0), "rare never resists")
check(rules.ShouldResist("VeryRare", 0.29), "veryrare resists under chance")
check(not rules.ShouldResist("VeryRare", 0.3), "veryrare not at chance")
check(rules.ShouldResist("Legendary", 0.49), "legendary resists under chance")

-- العقال: أقرب واحد قدامك بس
local origin, look = v(0, 0, 0), v(0, 0, -1)
local melee = {
	{ Position = v(0, 0, 5) }, -- وراك
	{ Position = v(0, 0, -6) }, -- قدامك
	{ Position = v(1, 0, -3) }, -- قدامك وأقرب
	{ Position = v(0, 0, -20) }, -- بعيد
}
check(rules.PickMeleeTarget(origin, look, melee, 8) == 3, "melee picks nearest in front")
check(rules.PickMeleeTarget(origin, look, { melee[1], melee[4] }, 8) == nil, "melee ignores behind and far")
check(rules.PickMeleeTarget(origin, look, { { Position = v(0.5, 1, 1) } }, 8) == 1, "melee hits one touching you even behind")

-- المسدس: أقرب واحد لخط التصويب داخل المخروط
local gun = {
	{ Position = v(0, 0, -100) }, -- على الخط
	{ Position = v(10, 0, -50) }, -- 11 درجة
	{ Position = v(40, 0, -50) }, -- برا المخروط
	{ Position = v(0, 0, -150) }, -- أبعد من المدى
}
check(rules.PickGunTarget(origin, look, gun, 120, 12) == 1, "gun picks the one on the line")
check(rules.PickGunTarget(origin, look, { gun[2], gun[3] }, 120, 12) == 1, "gun accepts within cone")
check(rules.PickGunTarget(origin, look, { gun[3], gun[4] }, 120, 12) == nil, "gun rejects outside cone and range")
check(rules.PickGunTarget(origin, v(0, 0, 0), gun, 120, 12) == nil, "zero aim")

-- اتجاه التصويب من اللاعب
check(rules.IsValidDirection(v(0, 0, -1)), "unit ok")
check(not rules.IsValidDirection(v(0 / 0, 0, -1)), "NaN rejected")
check(not rules.IsValidDirection(v(math.huge, 0, 0)), "inf rejected")
check(not rules.IsValidDirection(v(0, 0, 0)), "zero rejected")
check(not rules.IsValidDirection(v(0, 0, -50)), "huge rejected")
check(not rules.IsValidDirection("north"), "string rejected")
check(not rules.IsValidDirection({ X = "1", Y = 0, Z = 0 }), "string field rejected")

if failures == 0 then
	print("CatchRules: all checks passed")
else
	error(string.format("CatchRules: %d failure(s)", failures))
end
