--!strict
-- إعدادات خريطة "اسرق الهبالي".
-- كل المقاسات بالـ studs، ومركز الخريطة (الديرة) عند X = 0, Z = 0.
-- الخريطة دائرية: طبقات حسب البعد عن النص، كل ما بعدت تلقى أندر.
-- الملف أرقام بس (بدون Vector3 ولا Color3) عشان نقدر نختبره برا روبلوكس، ونظام طلوع
-- الهبالي في المرحلة الجاية بيقرا منه الطبقات.

export type Point = { X: number, Z: number }

export type Zone = {
	Id: string,
	DisplayName: string,
	MinRadius: number,
	MaxRadius: number,
	Material: string, -- مادة الرمل في هالطبقة (كل طبقة مادة مختلفة عشان يتغير لونها)
	Color: { number }, -- لون الرمل { R, G, B }
}

export type Landmark = {
	Id: string,
	DisplayName: string,
	X: number,
	Z: number,
	Radius: number,
}

local MapConfig = {}

-- نفس الرقم = نفس الصحراء بالضبط كل ما تبنيها. غيّره لو تبي شكل ثاني.
MapConfig.Seed = 6767

MapConfig.BaseHeight = 0 -- ارتفاع الأرض المستوية (الديرة)
MapConfig.DuneHeight = 55 -- أعلى ارتفاع للكثبان العادية
MapConfig.WaterLevel = -6

-- حزام الكثبان العالي اللي يقفل الماب من برا
MapConfig.Edge = {
	Start = 3400, -- يبدأ يرتفع بعد آخر طبقة
	Crest = 3650, -- هنا أعلى نقطة، وفيه جدار مخفي
	Height = 110, -- كم يرتفع فوق الكثبان العادية
	TerrainRadius = 3800, -- التضاريس تنتهي هنا
}

-- حدود الطبقات اللي تنكتب فيها الأرض (لازم تغطي أوطى وأعلى نقطة)
MapConfig.MinY = -96
MapConfig.MaxY = 320

-- الديرة: أرض مستوية في النص فيها القواعد والدكان ومحطة البنزين
MapConfig.Town = {
	Radius = 210,
	Blend = 90, -- مسافة الانتقال من المستوي للكثبان
	PlazaRadius = 40,
	Material = "Ground",
	Color = { 176, 140, 100 },
}

-- قواعد اللاعبين: دائرة حول الدكان، كل قاعدة مدخلها يطالع النص
MapConfig.Plots = {
	Count = 8,
	Radius = 140,
	AngleOffset = 22.5, -- بالدرجات، عشان القواعد تجي بين الطرق الأربعة
	Size = 56,
	WallHeight = 6,
	EntranceWidth = 16,
}

-- محطة البنزين: جنب طريق الشرق داخل الديرة. هنا الشكل بس، نظام البنزين يجي مع السيارات
MapConfig.GasStation = {
	X = 72,
	Z = 32,
	Width = 28, -- على امتداد الطريق
	Depth = 18,
	Pumps = 2,
}

-- طبقات الصيد حسب البعد عن الديرة: كل ما بعدت، الهبالي أندر،
-- والرجعة أطول وأخطر وتحتاج بنزين أكثر. كل طبقة رملها بلون.
MapConfig.Zones = {
	{ Id = "Common", DisplayName = "الشعبي", MinRadius = 260, MaxRadius = 1000, Material = "Sand", Color = { 226, 212, 180 } },
	{ Id = "Rare", DisplayName = "النادر", MinRadius = 1000, MaxRadius = 1900, Material = "Limestone", Color = { 218, 186, 124 } },
	{ Id = "VeryRare", DisplayName = "النادر مرة", MinRadius = 1900, MaxRadius = 2700, Material = "Salt", Color = { 204, 152, 104 } },
	{ Id = "Legendary", DisplayName = "الأسطوري", MinRadius = 2700, MaxRadius = 3400, Material = "Sandstone", Color = { 176, 106, 76 } },
} :: { Zone }

-- عرض المنطقة اللي يتداخل فيها رمل طبقتين عند الحد (عشان ما يصير خط حاد).
-- اللوحات على الطرق هي الحد الدقيق.
MapConfig.ZoneBlend = 110
-- وفوقها تموج كبير بطيء عشان الحدود ما تطلع دواير كاملة (شكل هدف) من فوق
MapConfig.ZoneWave = 90

-- المعالم الأربعة كلها داخل طبقة الأسطوري. Radius = حجم المعلم تقريباً
MapConfig.Landmarks = {
	{ Id = "Oasis", DisplayName = "الواحة", X = 0, Z = -3050, Radius = 260 },
	{ Id = "Canyon", DisplayName = "الوادي", X = 3000, Z = 0, Radius = 200 },
	{ Id = "Tuwaiq", DisplayName = "جبال طويق", X = -3040, Z = 0, Radius = 300 },
	{ Id = "Junkyard", DisplayName = "مقبرة السيارات", X = 0, Z = 3050, Radius = 220 },
} :: { Landmark }

-- جبال طويق: سلسلة طويلة من الشمال للجنوب (مو صخرة وحدة)، تنشاف من بعيد
MapConfig.Tuwaiq = {
	Ridge = {
		{ X = -3000, Z = -650 },
		{ X = -3070, Z = -250 },
		{ X = -3010, Z = 150 },
		{ X = -3080, Z = 600 },
	} :: { Point },
	Width = 220, -- من خط القمة لأسفل الجبل
	Peak = 210, -- أعلى ارتفاع فوق الكثبان
}

-- الواحة: بحيرة في النص، عشب حولها، ونخل طويل ينشاف من بعيد
MapConfig.Oasis = {
	Palms = 36,
	PalmHeight = { 26, 40 },
}

-- مجرى الوادي: خط متكسّر شرق الخريطة (من الشمال للجنوب)، عريض وعميق، وحوافه مرتفعة شوي
MapConfig.Canyon = {
	Path = {
		{ X = 2940, Z = -900 },
		{ X = 3040, Z = -450 },
		{ X = 3000, Z = 0 },
		{ X = 2930, Z = 450 },
		{ X = 3020, Z = 900 },
	} :: { Point },
	Width = 200, -- من النص لبداية الحفر
	Depth = 60,
	RimHeight = 45, -- الحافة ترتفع فوق الكثبان عشان الوادي ينشاف
	RimWidth = 120,
}

-- مقبرة السيارات: أكوام سيارات كبيرة فوق بعض، ورافعة طويلة تنشاف من بعيد
MapConfig.Junkyard = {
	Stacks = 14,
	MaxStack = 4, -- أعلى كومة كم سيارة فوق بعض
	WreckScale = 3.4,
	CraneHeight = 150,
}

-- الطرق: إسفلت غامق من الديرة لكل معلم، خط مستقيم (شمال/شرق/جنوب/غرب) يمر بين القواعد.
-- على جنبه كتف فاتح عشان ينشاف، والطريق يمشي فوق الكثبان (مو في خندق).
MapConfig.Roads = {
	Width = 24,
	Shoulder = 8, -- عرض الكتف الفاتح على كل جنب
	FlatMargin = 16, -- أرض مستوية زيادة برا الكتف (عشان التضاريس البعيدة ما تغطي الطريق)
	Blend = 90, -- انحدار الأرض من الطرف المستوي للكثبان
	Elevation = 1.0, -- الطريق يتبع شكل الكثبان العام (بدون التموجات الصغيرة)
	Ramp = 320, -- بعد الديرة، كم stud ياخذ الطريق عشان يطلع لمستوى الكثبان (طلعة هادية)
	EndFade = 320, -- آخر كم stud ينزل الطريق لمستوى الأرض عند المعلم
	SignOffset = 6, -- بعد اللوحة عن حافة الإسفلت
	-- سطح الطريق قطع (Parts) فوق التضاريس عشان ينشاف متصل من أي بعد (التضاريس البعيدة
	-- تنرسم بدقة أقل وتقطّع الطريق). كل قطعة خط مستقيم يمشي مع ميلان الأرض.
	PartSegment = 48, -- أطول قطعة
	PartTolerance = 0.3, -- أكبر فرق مسموح بين القطعة والأرض تحتها
	PartThickness = 1.2,
	PartLift = 0.4, -- كم يطلع سطح الإسفلت فوق مستوى الطريق
	Bed = 0.5, -- التضاريس تحت الطريق أوطى بهالمقدار عشان ما تطلع من بين قطع الإسفلت
	Paths = {
		{ { X = 0, Z = 0 }, { X = 0, Z = -2770 } }, -- الواحة (يوقف عند طرف العشب)
		{ { X = 0, Z = 0 }, { X = 2790, Z = 0 } }, -- الوادي (يوقف على الحافة)
		{ { X = 0, Z = 0 }, { X = -2790, Z = 0 } }, -- طويق (يوقف عند سفح الجبل)
		{ { X = 0, Z = 0 }, { X = 0, Z = 2830 } }, -- مقبرة السيارات
	} :: { { Point } },
}

-- ألوان باقي المواد (جدران الوادي، صخور طويق، الطرق). ألوان الطبقات والديرة فوق
MapConfig.MaterialColors = {
	Slate = { 150, 96, 70 },
	Basalt = { 96, 74, 64 },
	Rock = { 120, 104, 96 },
	Asphalt = { 38, 38, 42 },
	Concrete = { 196, 190, 178 },
} :: { [string]: { number } }

function MapConfig.GetLandmark(id: string): Landmark?
	for _, landmark in MapConfig.Landmarks do
		if landmark.Id == id then
			return landmark
		end
	end
	return nil
end

-- الطبقة اللي فيها هالمسافة عن النص (nil داخل الديرة أو ورا آخر طبقة)
function MapConfig.GetZoneAt(radius: number): Zone?
	for _, zone in MapConfig.Zones do
		if radius >= zone.MinRadius and radius < zone.MaxRadius then
			return zone
		end
	end
	return nil
end

return MapConfig
