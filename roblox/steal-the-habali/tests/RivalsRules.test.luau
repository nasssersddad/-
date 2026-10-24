-- اختبار قواعد المرحلة 7ب برا روبلوكس:
--   luau roblox/steal-the-habali/tests/RivalsRules.test.luau

-- أو داخل Studio (Rojo يحطه في ServerStorage.Tests):
--   require(game.ServerStorage.Tests["RivalsRules.test"])

local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local RivalsConfig = load("RivalsConfig")
local RivalsRules = load("RivalsRules")

local rules = RivalsRules.new(RivalsConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- إعادة البداية
check(rules.RebirthPrice(0) == 10_000_000, "first rebirth 10M")
check(rules.RebirthPrice(1) == 25_000_000, "second 25M")
check(rules.RebirthPrice(2) == 62_500_000, "third 62.5M")
check(rules.RebirthPrice(-3) == 10_000_000, "negative treated as 0")

-- مضاعف الدخل
check(rules.IncomeMultiplier(0, 0) == 1, "no bonus")
check(math.abs(rules.IncomeMultiplier(2, 0) - 1.5) < 1e-9, "two rebirths +50%")
check(math.abs(rules.IncomeMultiplier(0, 1) - 1.1) < 1e-9, "one friend +10%")
check(math.abs(rules.IncomeMultiplier(0, 7) - 1.3) < 1e-9, "friends capped at +30%")
check(math.abs(rules.IncomeMultiplier(1, 2) - 1.25 * 1.2) < 1e-9, "rebirth and gang multiply")

-- المطلوب الأول
check(rules.MostWanted({ { id = 1, worth = 500 } }) == nil, "alone: nobody")
check(rules.MostWanted({ { id = 1, worth = 500 }, { id = 2, worth = 900 } }) == 2, "richest wins")
check(rules.MostWanted({ { id = 5, worth = 900 }, { id = 2, worth = 900 } }) == 2, "tie goes to smaller id")
check(rules.MostWanted({ { id = 1, worth = 0 }, { id = 2, worth = 0 } }) == nil, "everyone broke: nobody")
check(rules.MostWantedBonus(15_000) == 3_000, "20% bonus")

if failures == 0 then
	print("RivalsRules: all checks passed")
else
	error(string.format("RivalsRules: %d failure(s)", failures))
end

return failures
