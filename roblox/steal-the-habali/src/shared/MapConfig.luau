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

MapConfig.BaseHeight = 0 -- ارتفاع الأرض المستوية (الديرة والطرق)
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
MapConfig.MinY = -64
MapConfig.MaxY = 224

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
	{ Id = "Common", DisplayName = "الشعبي", MinRadius = 260, MaxRadius = 1000, Material = "Sand", Color = { 232, 214, 172 } },
	{ Id = "Rare", DisplayName = "النادر", MinRadius = 1000, MaxRadius = 1900, Material = "Limestone", Color = { 226, 178, 96 } },
	{ Id = "VeryRare", DisplayName = "النادر مرة", MinRadius = 1900, MaxRadius = 2700, Material = "Salt", Color = { 214, 132, 70 } },
	{ Id = "Legendary", DisplayName = "الأسطوري", MinRadius = 2700, MaxRadius = 3400, Material = "Sandstone", Color = { 176, 78, 48 } },
} :: { Zone }

-- المعالم الأربعة كلها داخل طبقة الأسطوري
MapConfig.Landmarks = {
	{ Id = "Oasis", DisplayName = "الواحة", X = 0, Z = -3050, Radius = 140 },
	{ Id = "Canyon", DisplayName = "الوادي", X = 3050, Z = 0, Radius = 80 },
	{ Id = "Tuwaiq", DisplayName = "جبال طويق", X = -3050, Z = 0, Radius = 260 },
	{ Id = "Junkyard", DisplayName = "مقبرة السيارات", X = 0, Z = 3050, Radius = 110 },
} :: { Landmark }

-- مجرى الوادي: خط متكسّر شرق الخريطة (من الشمال للجنوب)، عرضه وعمقه تحت
MapConfig.Canyon = {
	Path = {
		{ X = 3000, Z = -760 },
		{ X = 3090, Z = -380 },
		{ X = 3050, Z = 0 },
		{ X = 2990, Z = 380 },
		{ X = 3080, Z = 760 },
	} :: { Point },
	Width = 80,
	Depth = 40,
}

-- الطرق: إسفلت من الديرة لكل معلم، خط مستقيم (شمال/شرق/جنوب/غرب) يمر بين القواعد.
-- الأرض حولها مستوية عشان السيارات، وتنحدر بهدوء للكثبان (Blend).
MapConfig.Roads = {
	Width = 24,
	Blend = 70,
	SignOffset = 6, -- بعد اللوحة عن حافة الإسفلت
	Paths = {
		{ { X = 0, Z = 0 }, { X = 0, Z = -2890 } }, -- الواحة (يوقف عند طرف العشب)
		{ { X = 0, Z = 0 }, { X = 2950, Z = 0 } }, -- الوادي (يوقف على الحافة)
		{ { X = 0, Z = 0 }, { X = -2780, Z = 0 } }, -- طويق
		{ { X = 0, Z = 0 }, { X = 0, Z = 2930 } }, -- مقبرة السيارات
	} :: { { Point } },
}

-- ألوان باقي المواد (جدران الوادي، صخور طويق، الطرق). ألوان الطبقات والديرة فوق
MapConfig.MaterialColors = {
	Slate = { 150, 96, 70 },
	Basalt = { 96, 74, 64 },
	Rock = { 120, 104, 96 },
	Asphalt = { 70, 70, 74 },
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
