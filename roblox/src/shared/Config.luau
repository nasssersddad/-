-- إعدادات أوبي المقلوب: العوالم، المراحل، والأرقام

local Config = {}

Config.SaveKey = "FlippedObby_v1"
Config.AutosaveSeconds = 120
Config.JumpPower = 50
Config.LowGravity = 60 -- الجاذبية العادية 196.2
Config.DefaultGravity = 196.2

-- كل عالم له حركة (twist) تتغير فيها اللعبة
Config.Worlds = {
	{
		name = "البداية",
		icon = "🟢",
		desc = "سخّن! نطّ وانتبه من الحمم",
		twist = "none",
		colors = { Color3.fromRGB(110, 205, 120), Color3.fromRGB(80, 170, 235) },
	},
	{
		name = "القمر",
		icon = "🌙",
		desc = "الجاذبية خفيفة… نطّتك صارت طويلة!",
		twist = "lowGravity",
		gapScale = 2.6, -- الفراغات أوسع لأن النطّة أبعد
		colors = { Color3.fromRGB(160, 160, 185), Color3.fromRGB(120, 105, 185) },
	},
	{
		name = "المعكوس",
		icon = "🔄",
		desc = "التحكم معكوس! قدّام يوديك ورا ويمين يوديك يسار",
		twist = "invert",
		colors = { Color3.fromRGB(80, 220, 230), Color3.fromRGB(240, 110, 200) },
	},
	{
		name = "الدنيا مقلوبة",
		icon = "🙃",
		desc = "الكاميرا مقلوبة راس على عقب!",
		twist = "flipCamera",
		colors = { Color3.fromRGB(250, 170, 60), Color3.fromRGB(250, 220, 80) },
	},
	{
		name = "الوقت المعكوس",
		icon = "⏪",
		desc = "المنصات تختفي وترجع… انتبه للتوقيت!",
		twist = "rewind",
		colors = { Color3.fromRGB(195, 155, 105), Color3.fromRGB(150, 115, 85) },
	},
}

-- المراحل: كل مرحلة تبدأ بنقطة حفظ وبعدها عقبات
-- أنواع العقبات: jumps, lava, beam, zigzag, mover, spinner, truss, vanish, pad
Config.Stages = {
	-- 🟢 البداية
	{ world = 1, segments = { { type = "jumps", count = 4, gap = 4 }, { type = "lava", stones = 4 } } },
	{ world = 1, segments = { { type = "beam", length = 14, width = 2 }, { type = "jumps", count = 4, gap = 5, rise = 1 } } },
	{ world = 1, segments = { { type = "mover", span = 18 }, { type = "zigzag", count = 5 } } },
	{ world = 1, segments = { { type = "spinner", radius = 9, speed = 1.4 }, { type = "truss", height = 12 } } },
	-- 🌙 القمر
	{ world = 2, segments = { { type = "jumps", count = 4, gap = 5 }, { type = "jumps", count = 3, gap = 5, rise = 4 } } },
	{ world = 2, segments = { { type = "zigzag", count = 5, gap = 3 }, { type = "beam", length = 20, width = 1.4 } } },
	{ world = 2, segments = { { type = "mover", span = 22, period = 5 }, { type = "lava", stones = 5, gap = 4 } } },
	{ world = 2, segments = { { type = "spinner", radius = 10, speed = 2, bars = 2 }, { type = "jumps", count = 5, gap = 5, size = 4 } } },
	-- 🔄 المعكوس
	{ world = 3, segments = { { type = "jumps", count = 5, gap = 3 }, { type = "beam", length = 12, width = 2.5 } } },
	{ world = 3, segments = { { type = "zigzag", count = 5, gap = 2 }, { type = "lava", stones = 4, gap = 3 } } },
	{ world = 3, segments = { { type = "mover", span = 16 }, { type = "spinner", radius = 9, speed = 1.2 } } },
	{ world = 3, segments = { { type = "beam", length = 18, width = 1.6 }, { type = "truss", height = 14 } } },
	-- 🙃 الدنيا مقلوبة
	{ world = 4, segments = { { type = "jumps", count = 5, gap = 4 }, { type = "lava", stones = 4, gap = 3 } } },
	{ world = 4, segments = { { type = "zigzag", count = 6, gap = 2.5 }, { type = "beam", length = 16, width = 1.8 } } },
	{ world = 4, segments = { { type = "spinner", radius = 9, speed = 1.6 }, { type = "mover", span = 18 } } },
	{ world = 4, segments = { { type = "truss", height = 14 }, { type = "jumps", count = 5, gap = 4, rise = 1 } } },
	-- ⏪ الوقت المعكوس
	{ world = 5, segments = { { type = "vanish", count = 5 }, { type = "jumps", count = 3, gap = 5 } } },
	{ world = 5, segments = { { type = "pad", height = 16 }, { type = "vanish", count = 6 } } },
	{ world = 5, segments = { { type = "mover", span = 18, period = 4 }, { type = "vanish", count = 5 }, { type = "spinner", radius = 9, speed = 2 } } },
	{ world = 5, segments = { { type = "vanish", count = 8, period = 2.8 }, { type = "pad", height = 18 } } },
}

Config.FinalStage = #Config.Stages
Config.FinishedStage = #Config.Stages + 1 -- يعني خلّص الأوبي

-- 🪢 الوضع التعاوني: لاعبين مربوطين بحبل في مسار خاص
Config.Coop = {
	name = "درب الحبل",
	icon = "🪢",
	desc = "انتو مربوطين! لو واحد طاح الثنين يرجعون",
	colors = { Color3.fromRGB(255, 150, 90), Color3.fromRGB(255, 205, 120) },
	courseZ = 320, -- مكان المسار التعاوني (بعيد عن المسار العادي)
	ropeLength = 16, -- طول الحبل العادي
	minRopeLength = 6, -- أقصر طول لما تسحب
	reelSpeed = 10, -- كم ستد بالثانية يقصر لما تسحب
	releaseSpeed = 4, -- كم ستد بالثانية يرجع لطوله
	pullStrength = 10, -- قوة السحب لكل ستد زيادة عن طول الحبل
	maxPull = 45, -- أقصى سرعة سحب
	snapDistance = 60, -- لو أبعد من كذا (مثلاً واحد رسبن) ما نسحب
	pairSeconds = 3, -- كم ثانية توقفون على الدوائر قبل ما تنربطون
	bridgeGap = 10, -- فراغ الجسر (أبعد من النطّة عشان لازم الزر)
	stages = {
		{ segments = { { type = "jumps", count = 4, gap = 4, size = 7 } } },
		{ segments = { { type = "bridge" } } },
		{ segments = { { type = "lanes", length = 36 }, { type = "jumps", count = 3, gap = 4, size = 6 } } },
		{ segments = { { type = "mover", span = 20, size = 9 }, { type = "lava", stones = 4 } } },
		{ segments = { { type = "bridge" }, { type = "spinner", radius = 10, speed = 1.3 } } },
		{ segments = { { type = "lanes", length = 44 }, { type = "jumps", count = 4, gap = 4, size = 6, rise = 1 } } },
		{ segments = { { type = "truss", height = 12, width = 4 }, { type = "bridge" } } },
		{ segments = { { type = "vanish", count = 5, size = 7 }, { type = "jumps", count = 3, gap = 4, size = 7 } } },
	},
}
Config.Coop.FinalStage = #Config.Coop.stages
Config.Coop.FinishedStage = #Config.Coop.stages + 1

function Config.worldIndexForStage(stage: number): number?
	local def = Config.Stages[stage]
	return if def then def.world else nil
end

-- هل هذي المرحلة أول مرحلة في عالمها؟
function Config.isWorldStart(stage: number): boolean
	local def = Config.Stages[stage]
	if not def then
		return false
	end
	local prev = Config.Stages[stage - 1]
	return prev == nil or prev.world ~= def.world
end

return Config
