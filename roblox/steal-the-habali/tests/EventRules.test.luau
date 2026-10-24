-- اختبار أوقات الأحداث برا روبلوكس:
--   luau roblox/steal-the-habali/tests/EventRules.test.luau

-- أو داخل Studio (Rojo يحطه في ServerStorage.Tests):
--   require(game.ServerStorage.Tests["EventRules.test"])

local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local EventsConfig = load("EventsConfig")
local EventRules = load("EventRules")

local rules = EventRules.new(EventsConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- 2026-10-23 كان جمعة. نحسبه: الأيام من 1970 = 20749
local friday = 20749 * 86400
check(rules.Weekday(friday) == 5, "2026-10-23 is a Friday")
check(rules.Weekday(0) == 4, "1970-01-01 is a Thursday")

-- العاصفة
local hour = friday + 10 * 3600 -- 10:00 UTC
local active, start, finish = rules.Sandstorm(hour + 29 * 60)
check(not active and start == hour + 30 * 60 and finish == start + 300, "storm at :30 not yet")
active = rules.Sandstorm(hour + 30 * 60)
check(active, "storm active at :30")
active = rules.Sandstorm(hour + 34 * 60 + 59)
check(active, "storm active at :34:59")
active, start = rules.Sandstorm(hour + 35 * 60)
check(not active and start == hour + 3600 + 30 * 60, "storm over at :35, next one next hour")

-- الإنفنتي: الجمعة 18:00 UTC
local infStart = friday + 18 * 3600
active, start, finish = rules.Infinity(friday + 3600)
check(not active and start == infStart and finish == infStart + 3600, "friday morning: later today")
active = rules.Infinity(infStart + 10)
check(active, "active right after start")
active, start = rules.Infinity(infStart + 3600)
check(not active and start == infStart + 7 * 86400, "after it ends: next friday")
active, start = rules.Infinity(friday - 86400) -- الخميس
check(not active and start == infStart, "thursday: tomorrow")
active, start = rules.Infinity(friday + 86400) -- السبت
check(not active and start == infStart + 7 * 86400, "saturday: next week")

-- التنبيهات
check(rules.ShouldAlert("Legendary", "Normal"), "legendary alerts")
check(rules.ShouldAlert("Infinity", nil), "infinity alerts")
check(rules.ShouldAlert("Common", "Gold"), "gold alerts")
check(not rules.ShouldAlert("Rare", "Normal"), "plain rare does not alert")
check(not rules.ShouldAlert("Common", nil), "common does not alert")

-- العدّاد
check(rules.FormatIn(45) == "45 ثانية", "seconds")
check(rules.FormatIn(600) == "10 دقيقة", "minutes")
check(rules.FormatIn(2 * 86400 + 4 * 3600 + 5) == "2 يوم 4 ساعة", "days")
check(rules.FormatIn(-5) == "0 ثانية", "negative")

if failures == 0 then
	print("EventRules: all checks passed")
else
	error(string.format("EventRules: %d failure(s)", failures))
end

return failures
