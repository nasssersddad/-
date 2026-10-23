-- اختبار قواعد القاعدة برا روبلوكس:
--   luau roblox/steal-the-habali/tests/BaseRules.test.luau

-- أو داخل Studio (Rojo يحطه في ServerStorage.Tests):
--   require(game.ServerStorage.Tests["BaseRules.test"])

-- برا روبلوكس نقرا الملفات، وداخل Studio نقرا من ReplicatedStorage.Shared
local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local BaseConfig = load("BaseConfig")
local HabaliConfig = load("HabaliConfig")
local MapConfig = load("MapConfig")
local BaseRules = load("BaseRules")

local rules = BaseRules.new(BaseConfig, HabaliConfig, MapConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- الدخل
check(rules.IncomeOf("Common", "Normal") == 1, "common income")
check(rules.IncomeOf("Legendary", "Diamond") == 500, "legendary diamond income")
check(rules.IncomeOf("Rare", "Gold") == 12, "rare gold income")
check(rules.IncomeOf("Nope", "Normal") == 0, "unknown rarity no income")
local slots = { [1] = { c = "Dalla", r = "Common", v = "Normal" }, [4] = { c = "Shawarma", r = "VeryRare", v = "Gold" } }
check(rules.TotalIncome(slots) == 1 + 45, "total income")
check(rules.FirstFreeSlot(slots) == 2, "first free slot")
local full = {}
for i = 1, BaseConfig.Slots do
	full[i] = { c = "Dalla", r = "Common", v = "Normal" }
end
check(rules.FirstFreeSlot(full) == nil, "full base")

-- الفلوس المتجمّعة لها حد
check(rules.AddPending(0, 10, 5) == 50, "pending grows")
check(rules.AddPending(5990, 10, 5) == 6000, "pending capped")

-- الدرع
check(rules.IsShielded(nil), "offline owner shielded")
check(rules.IsShielded(BaseConfig.ShieldRadius + 1), "far owner shielded")
check(not rules.IsShielded(50), "owner in Dira not shielded")

-- القفل
check(rules.IsLocked(10, 60) and not rules.IsLocked(60, 60), "lock window")
check(not rules.CanLock(100, 60), "cooldown blocks")
check(rules.CanLock(60 + BaseConfig.LockCooldown, 60), "cooldown over")
check(rules.CanLock(0, -1e9), "never locked")

-- تنظيف الهبالي المحفوظ
check(rules.SanitizeEntry({ c = "Dalla", r = "Rare", v = "Gold" }) ~= nil, "valid entry")
check(rules.SanitizeEntry({ c = "Dalla", r = "Rare" }).v == "Normal", "missing variant -> Normal")
check(rules.SanitizeEntry({ c = "Hacker", r = "Rare", v = "Gold" }) == nil, "bad character")
check(rules.SanitizeEntry({ c = "Dalla", r = "Mythic", v = "Gold" }) == nil, "bad rarity")
check(rules.SanitizeEntry({ c = "Dalla", r = "Infinity", v = "Normal" }) ~= nil, "infinity is a real rarity (phase 6)")
check(rules.IncomeOf("Infinity", "Normal") == 300, "infinity income")
check(rules.SanitizeEntry({ c = "Dalla", r = "Rare", v = "Rainbow" }) == nil, "bad variant")
check(rules.SanitizeEntry("Dalla") == nil, "not a table")

-- الترحيل
local fresh = rules.Migrate(nil)
check(fresh ~= nil and fresh.money == 0 and next(fresh.base) == nil, "new player record")
check(rules.Migrate({ version = 99 }) == nil, "future version untouched")
check(rules.Migrate("garbage") == nil, "garbage untouched")
local migrated = rules.Migrate({
	version = 1,
	money = 123.9,
	base = { ["1"] = { c = "Dalla", r = "Common", v = "Normal" }, ["11"] = { c = "Dalla", r = "Common" }, ["2"] = { c = "X", r = "Common" }, ["3.5"] = { c = "Dalla", r = "Common" } },
	session = { job = "abc", time = 100 },
})
check(migrated ~= nil and migrated.money == 123, "money floored")
check(migrated ~= nil and migrated.base["1"] ~= nil, "slot 1 kept")
check(migrated ~= nil and migrated.base["11"] == nil and migrated.base["2"] == nil and migrated.base["3.5"] == nil, "bad slots dropped")
check(migrated ~= nil and migrated.session ~= nil and migrated.session.job == "abc", "session kept")
check(rules.Migrate({ version = 1, money = 0 / 0 }).money == 0, "NaN money -> 0")
check(rules.Migrate({ version = 1, money = -50 }).money == 0, "negative money -> 0")
check(rules.Migrate({ version = 1, money = math.huge }).money == 0, "inf money -> 0")

-- المنصات من وإلى الحفظ
local back = rules.SlotsFromRecord({ version = 1, money = 0, base = rules.RecordBase(slots) })
check(back[1] ~= nil and back[4] ~= nil and back[4].v == "Gold" and back[2] == nil, "slots round trip")

-- قفل الجلسة
local stale = BaseConfig.Data.SessionStaleSeconds
check(rules.CanTakeSession({ version = 1, money = 0, base = {} }, "me", 1000), "no session -> take")
check(rules.CanTakeSession({ version = 1, money = 0, base = {}, session = { job = "me", time = 999 } }, "me", 1000), "own session -> take")
check(not rules.CanTakeSession({ version = 1, money = 0, base = {}, session = { job = "other", time = 990 } }, "me", 1000), "fresh other session -> wait")
check(rules.CanTakeSession({ version = 1, money = 0, base = {}, session = { job = "other", time = 1000 - stale - 1 } }, "me", 1000), "stale other session -> take")

-- الضربات: 3 خلال 6 ثواني تطيّحه، والقديمة تنحذف
local times, dropped = rules.RegisterHit({}, 0)
check(not dropped and #times == 1, "hit 1")
times, dropped = rules.RegisterHit(times, 1)
check(not dropped, "hit 2")
times, dropped = rules.RegisterHit(times, 2)
check(dropped and #times == 0, "hit 3 drops")
times = rules.RegisterHit({}, 0)
times = rules.RegisterHit(times, 1)
times, dropped = rules.RegisterHit(times, 10)
check(not dropped and #times == 1, "old hits expire")

-- بونص الثأر
check(rules.RevengeBonus({ c = "Dalla", r = "Rare", v = "Normal" }) == 4 * BaseConfig.Revenge.BonusSeconds, "revenge bonus")

if failures == 0 then
	print("BaseRules: all checks passed")
else
	error(string.format("BaseRules: %d failure(s)", failures))
end

return failures
