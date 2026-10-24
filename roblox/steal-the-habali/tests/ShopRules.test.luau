-- اختبار قواعد المحلات برا روبلوكس:
--   luau roblox/steal-the-habali/tests/ShopRules.test.luau

-- أو داخل Studio (Rojo يحطه في ServerStorage.Tests):
--   require(game.ServerStorage.Tests["ShopRules.test"])

local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local ShopConfig = load("ShopConfig")
local BaseConfig = load("BaseConfig")
local ShopRules = load("ShopRules")

local rules = ShopRules.new(ShopConfig, BaseConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- الليفلات المحفوظة
local gear = rules.DefaultGear()
check(gear.Melee == 1 and gear.Tank == 1, "default gear is level 1")
local clean = rules.SanitizeGear({ Melee = 99, Gun = -3, Engine = 2.7, Load = "x", Tank = 0 / 0 })
check(clean.Melee == #ShopConfig.Melee, "too high clamps to max")
check(clean.Gun == 1, "negative clamps to 1")
check(clean.Engine == 2, "fraction floors")
check(clean.Load == 1 and clean.Tank == 1, "bad values default to 1")
check(rules.SanitizeGear(nil).Engine == 1, "missing gear")

-- الشراء
local ok, price = rules.CanBuy(gear, "Melee", 1_999)
check(not ok and price == "Money", "not enough money")
ok, price = rules.CanBuy(gear, "Melee", 2_000)
check(ok and price == 2_000, "agal level 2 costs 2000")
check(select(2, rules.CanBuy(gear, "Fuel", 1e9)) == "Unknown", "fuel is not an upgrade")
check(select(2, rules.CanBuy(gear, "Hack", 1e9)) == "Unknown", "unknown key")
local maxed = rules.SanitizeGear({ Melee = 99, Gun = 99, Engine = 99, Load = 99, Tank = 99 })
check(select(2, rules.CanBuy(maxed, "Engine", 1e12)) == "Max", "maxed engine")

-- القوة حسب الليفل
check(math.abs(rules.Damage(gear, "Melee", "Legendary") - 1 / 12) < 1e-9, "agal 1 legendary 12 hits")
local strong = rules.SanitizeGear({ Melee = 4, Gun = 3 })
check(math.abs(rules.Damage(strong, "Melee", "Legendary") - 1 / 4) < 1e-9, "golden agal 4 hits")
check(math.abs(rules.Damage(strong, "Gun", "Legendary") - 1 / 2) < 1e-9, "launcher 2 shots")
check(rules.Damage(gear, "Laser", "Common") == 0, "unknown weapon does nothing")
check(rules.Damage(gear, "Melee", "Nope") == 0, "unknown rarity")
local speed, capacity, tank = rules.CarStats(gear)
check(speed == 40 and capacity == 3 and tank == 5_000, "starter car stats")
speed, capacity, tank = rules.CarStats(maxed)
check(speed == 80 and capacity == 10 and tank == 14_000, "maxed car stats")

-- الحمولة تفتح المناطق: 4 للنادر مرة و 6 للأسطوري
check(ShopConfig.Load[2].Capacity >= 4 and ShopConfig.Load[3].Capacity >= 6, "load unlocks zones")
-- التانكي يوصلك ويرجّعك: 7500 للنفود (2700) و 10000 للربع الخالي (3400)
check(ShopConfig.Tank[2].Size >= 2700 * 2 * 1.15 and ShopConfig.Tank[3].Size >= 3400 * 2 * 1.15, "tank reaches zones and back")

-- الأسعار تزيد مع الليفل
for _, key in rules.Keys() do
	for i = 2, #ShopConfig[key] do
		check(ShopConfig[key][i].Price > ShopConfig[key][i - 1].Price, key .. " prices go up at level " .. i)
	end
end

-- البيع
check(rules.SellPrice("Common", "Normal") == 300, "sell common")
check(rules.SellPrice("Legendary", "Gold") == 45_000, "sell legendary gold")
check(rules.SellPrice("Nope", nil) == 0, "sell unknown")

-- البنزين
check(rules.RefillCost(0, 5_000) == 200, "full starter tank costs 200")
check(rules.RefillCost(5_000, 5_000) == 0, "full tank costs nothing")
check(rules.RefillCost(-50, 5_000) == 200, "negative fuel treated as empty")
local studs, cost = rules.AffordableFuel(0, 5_000, 100)
check(studs == 2_500 and cost == 100, "partial fill with 100 money")
studs, cost = rules.AffordableFuel(0, 5_000, 1_000, 3)
check(studs == 5_000 and cost == 600, "mechanic fuel costs 3x")
studs, cost = rules.AffordableFuel(0, 5_000, 120, 3)
check(studs == 1_000 and cost == 120, "mechanic partial fill")
check(rules.Burn(1_000, 300) == 700, "burn fuel")
check(rules.Burn(100, 300) == 0, "fuel never negative")
check(rules.Burn(500, 0 / 0) == 500, "NaN distance ignored")
check(rules.SanitizeFuel(nil, 5_000) == 5_000, "first time full tank")
check(rules.SanitizeFuel(9_999, 5_000) == 5_000, "fuel clamped to tank")
check(rules.SanitizeJerries(7) == ShopConfig.Fuel.MaxJerries, "jerries clamped")
check(rules.SanitizeJerries("2") == 0, "bad jerries")

if failures == 0 then
	print("ShopRules: all checks passed")
else
	error(string.format("ShopRules: %d failure(s)", failures))
end

return failures
