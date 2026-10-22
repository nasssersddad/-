--!strict
-- إعدادات طلوع الهبالي في الصحراء (المرحلة 2).
-- أرقام بس (بدون Vector3 ولا Color3) عشان نقدر نختبرها برا روبلوكس.
-- مفاتيح الجداول هي Id الطبقة من MapConfig.Zones: Common / Rare / VeryRare / Legendary.

export type Character = { Id: string, DisplayName: string }

export type Variant = {
	Id: string,
	DisplayName: string,
	Chance: number, -- من 0 إلى 1
	Color: { number },
	Material: string,
}

local HabaliConfig = {}

-- كم هبالي عايشين بنفس الوقت في كل طبقة (لكل سيرفر)
-- الأسطوري واحد بس في السيرفر، والكل يتسابق عليه (اتفقنا 2026-10-22، docs/ECONOMY.md)
HabaliConfig.Caps = { Common = 14, Rare = 8, VeryRare = 3, Legendary = 1 } :: { [string]: number }

-- لما واحد ينشال (ينصاد)، بعد كم ثانية يطلع بداله
HabaliConfig.RespawnDelay = { Common = 10, Rare = 30, VeryRare = 180, Legendary = 600 } :: { [string]: number }

-- سرعة المشي بالـ stud في الثانية (الأندر أسرع شوي)
HabaliConfig.WalkSpeed = { Common = 5, Rare = 6, VeryRare = 7, Legendary = 8 } :: { [string]: number }

-- لون كل ندرة: الشعبي ما يلمع، والباقي يلمع بلونه
HabaliConfig.RarityColors = {
	Common = { 225, 225, 225 },
	Rare = { 70, 150, 255 },
	VeryRare = { 185, 85, 255 },
	Legendary = { 255, 165, 40 },
} :: { [string]: { number } }

-- من وين ينقرا اسم الهبالي (بالـ stud)، كل ما أندر ينشاف من أبعد
HabaliConfig.LabelDistance = { Common = 120, Rare = 250, VeryRare = 350, Legendary = 500 } :: { [string]: number }

-- نسخ خاصة فوق أي ندرة. السيرفر بس يرمي النرد.
-- الترتيب مهم: الأندر أول (0.5% دايموند، وبعدها 3% ذهبي، والباقي عادي)
HabaliConfig.Variants = {
	{ Id = "Diamond", DisplayName = "دايموند", Chance = 0.005, Color = { 140, 235, 255 }, Material = "Glass" },
	{ Id = "Gold", DisplayName = "ذهبي", Chance = 0.03, Color = { 255, 200, 45 }, Material = "Foil" },
} :: { Variant }
HabaliConfig.NormalVariant = "Normal"

-- الشخصيات (أشكال مؤقتة، المجسمات الحقيقية بعدين)
HabaliConfig.Characters = {
	{ Id = "Jamaloni", DisplayName = "جملوني فريزيني" },
	{ Id = "Dalla", DisplayName = "دلّة تاكتيكو" },
	{ Id = "Shawarma", DisplayName = "شاورمانيو بومبارديو" },
} :: { Character }

-- وين يمشون: داخل طبقتهم بس، بعيد عن الطرق والمعالم
HabaliConfig.Wander = {
	Tick = 0.1, -- كل كم ثانية يتحركون (كلهم بدفعة وحدة)
	StepMin = 12, -- أقصر مشوار
	StepMax = 40, -- أطول مشوار
	IdleMin = 2, -- يوقف بين المشاوير
	IdleMax = 6,
	ZoneMargin = 30, -- بعدهم عن حد الطبقة
	RoadClearance = 60, -- بعدهم عن خط نص الطريق (الطريق + الكتف + الأرض المستوية + زيادة)
	LandmarkMargin = 40, -- زيادة على نص قطر المعلم
	RidgeMargin = 40, -- زيادة على عرض جبال طويق ومجرى الوادي
	MinGroundNormalY = 0.75, -- ما يوقفون على منحدر أقوى من كذا
	SampleTries = 40,
	PathChecks = 5, -- كم نقطة نفحص على خط المشوار
}

-- هوك أول دقيقة: شعبي قريب من طرف الديرة، ونادر يلمع بعيد بنفس الاتجاه
HabaliConfig.Hook = {
	CommonRadius = 300, -- بعده عن نص الديرة (الديرة تخلص عند 210)
	RareRadius = 1080, -- أول الدهناء
	Lifetime = 300, -- ثواني، بعدها يختفون لو محد صادهم
	BeamHeight = 400, -- عمود النور فوق النادر عشان ينشاف من بعيد (أعلى من الكثبان)
	BeamWidth = 8,
	AngleStep = 3, -- بالدرجات: لو المكان على طريق نلف شوي لين نلقى مكان
	MaxAngleTries = 40,
}

return HabaliConfig
