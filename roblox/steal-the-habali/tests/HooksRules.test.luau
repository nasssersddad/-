-- اختبار قواعد الهوكات برا روبلوكس:
--   luau roblox/steal-the-habali/tests/HooksRules.test.luau

-- أو داخل Studio (Rojo يحطه في ServerStorage.Tests):
--   require(game.ServerStorage.Tests["HooksRules.test"])

local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local HooksConfig = load("HooksConfig")
local HooksRules = load("HooksRules")

local rules = HooksRules.new(HooksConfig)
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- اليوم يبدأ 12 الليل بتوقيت السعودية = 21:00 UTC
local base = 20749 * 86400 -- 2026-10-23 00:00 UTC
check(rules.Day(base + 20 * 3600) == rules.Day(base), "20:00 UTC still same Saudi day")
check(rules.Day(base + 21 * 3600) == rules.Day(base) + 1, "21:00 UTC is midnight in Saudi")

-- اليومية
local today = 1000
local can, streak, reward = rules.DailyStatus(nil, today)
check(can and streak == 1 and reward == 500, "first ever claim")
can = rules.DailyStatus({ day = today, streak = 3 }, today)
check(not can, "already claimed today")
can, streak = rules.DailyStatus({ day = today - 1, streak = 3 }, today)
check(can and streak == 4, "next day continues")
can, streak = rules.DailyStatus({ day = today - 2, streak = 3 }, today)
check(can and streak == 4, "missing one day keeps the streak")
can, streak = rules.DailyStatus({ day = today - 3, streak = 3 }, today)
check(can and streak == 1, "missing two days resets")
can, streak, reward = rules.DailyStatus({ day = today - 1, streak = 7 }, today)
check(can and streak == 1 and reward == 500, "after day 7 it loops")
can, streak = rules.DailyStatus({ day = today + 5, streak = 2 }, today)
check(can and streak == 1, "a save from the future resets instead of continuing")
check(rules.SanitizeDaily({ day = 5, streak = 99 }).streak == 7, "streak clamped")
check(rules.SanitizeDaily({ day = "x" }) == nil, "bad daily")

-- المهمات
local a = rules.PickQuests(today, 12345)
local b = rules.PickQuests(today, 12345)
check(#a == 3 and a[1] == b[1] and a[2] == b[2] and a[3] == b[3], "same day same quests")
check(a[1] ~= a[2] and a[2] ~= a[3] and a[1] ~= a[3], "three different quests")
local differs = false
for d = 1, 5 do
	local c = rules.PickQuests(today + d, 12345)
	if c[1] ~= a[1] or c[2] ~= a[2] or c[3] ~= a[3] then
		differs = true
	end
end
check(differs, "quests change across days")

local q = rules.QuestsFor(nil, today, 1)
q.ids = { "CatchRare", "CatchShiny", "Sell" }
q.progress = { 0, 0, 0 }
q.done = { false, false, false }
local done = rules.Advance(q, "Catch", { Zone = "Common", Variant = "Normal" })
check(#done == 0 and q.progress[1] == 0, "common catch doesn't count for rare quest")
for _ = 1, 5 do
	done = rules.Advance(q, "Catch", { Zone = "Rare", Variant = "Normal" })
end
check(q.done[1] and q.progress[1] == 5 and #done == 1, "rare quest done at 5")
done = rules.Advance(q, "Catch", { Zone = "Rare", Variant = "Normal" })
check(#done == 0 and q.progress[1] == 5, "done quest doesn't count again")
done = rules.Advance(q, "Catch", { Zone = "Common", Variant = "Gold" })
check(q.done[2] and #done == 1, "gold catch finishes shiny quest")
done = rules.Advance(q, "Sell", { Count = 3 })
check(q.done[3], "selling 3 at once finishes sell quest")
local stale = rules.QuestsFor({ day = today - 1, ids = { "Steal" }, progress = { 1 }, done = { true } }, today, 1)
check(stale.day == today and not stale.done[1], "yesterday's quests replaced")
local kept = rules.QuestsFor({ day = today, ids = { "Steal", "Hack" }, progress = { 0, 9 }, done = { false, true } }, today, 1)
check(#kept.ids == 1 and kept.ids[1] == "Steal", "unknown quest ids dropped")
check(rules.QuestReward(0) == 300, "minimum quest reward")
check(rules.QuestReward(50) == 30_000, "ten minutes of income")

-- الموسوعة
local dex = rules.SanitizeDex({ ["Jamaloni:Common"] = true, ["Dalla:Common"] = true, [5] = true, ["x"] = "yes" })
check(dex["Jamaloni:Common"] and not dex["x"], "dex sanitize")
check(rules.DexMissing(dex, "Common", { "Jamaloni", "Dalla", "Shawarma" }) == 1, "one left in common")
dex[rules.DexKey("Shawarma", "Common")] = true
check(rules.DexMissing(dex, "Common", { "Jamaloni", "Dalla", "Shawarma" }) == 0, "common complete")

if failures == 0 then
	print("HooksRules: all checks passed")
else
	error(string.format("HooksRules: %d failure(s)", failures))
end

return failures
