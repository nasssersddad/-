--!strict
-- المرحلة 7أ: المكافأة اليومية، والمهمات اليومية، والموسوعة (اتفقنا 2026-10-23). أرقام ونصوص بس.

local HooksConfig = {}

-- اليوم يبدأ 12 الليل بتوقيت السعودية (UTC+3)
HooksConfig.DayOffsetSeconds = 3 * 3600

-- المكافأة اليومية: 7 أيام وتعيد. لو فوّت يوم واحد ما تنقطع، ولو فوّت يومين ترجع لليوم 1
HooksConfig.Daily = {
	Rewards = { 500, 800, 1_200, 1_800, 2_500, 3_500, 6_000 },
	JerryOnDay = 7, -- اليوم السابع معه جالون
	GraceDays = 1, -- كم يوم تقدر تفوّت بدون ما تنقطع
}

-- المهمات: 3 كل يوم من هالقائمة. Kind: Catch (Zone/Variant اختياري)، Steal، Sell، Refuel
HooksConfig.Quests = {
	{ Id = "CatchCommon", Kind = "Catch", Zone = "Common", Target = 8, Text = "صيد 8 من الثمامة" },
	{ Id = "CatchRare", Kind = "Catch", Zone = "Rare", Target = 5, Text = "صيد 5 من الدهناء" },
	{ Id = "CatchVeryRare", Kind = "Catch", Zone = "VeryRare", Target = 2, Text = "صيد 2 من النفود" },
	{ Id = "CatchAny", Kind = "Catch", Target = 10, Text = "صيد 10 هبالي" },
	{ Id = "CatchShiny", Kind = "Catch", Variant = true, Target = 1, Text = "صيد ذهبي أو دايموند" },
	{ Id = "Steal", Kind = "Steal", Target = 1, Text = "اسرق مرة وحدة 🦹" },
	{ Id = "Sell", Kind = "Sell", Target = 3, Text = "بيع 3 هبالي عند أبو هبال" },
	{ Id = "Refuel", Kind = "Refuel", Target = 2, Text = "عبّي بنزين مرتين عند أبو فلّة" },
}
HooksConfig.QuestsPerDay = 3
HooksConfig.QuestRewardSeconds = 600 -- جائزة المهمة = دخل قاعدتك لعشر دقايق
HooksConfig.QuestRewardMin = 300

-- الموسوعة: تكمّل ندرة كاملة (كل الشخصيات فيها) = جائزة
HooksConfig.DexRewards = { Common = 1_000, Rare = 5_000, VeryRare = 25_000, Legendary = 100_000, Infinity = 250_000 } :: { [string]: number }

return HooksConfig
