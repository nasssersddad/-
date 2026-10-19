--!strict
-- إعدادات خريطة "اسرق الهبالي".
-- كل المقاسات بالـ studs، ومركز الخريطة (الديرة) عند X = 0, Z = 0.
-- الملف أرقام بس (بدون Vector3) عشان نقدر نختبره برا روبلوكس، ونظام طلوع
-- الهبالي في المرحلة الجاية بيقرا منه المناطق والمعالم.

export type Point = { X: number, Z: number }

export type Zone = {
	Id: string,
	DisplayName: string,
	MinRadius: number,
	MaxRadius: number,
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

MapConfig.Size = 2048 -- طول ضلع الصحراء (مربع)
MapConfig.BaseHeight = 0 -- ارتفاع الأرض المستوية (الديرة والطرق)
MapConfig.DuneHeight = 55 -- أعلى ارتفاع للكثبان العادية
MapConfig.EdgeWallHeight = 70 -- كثبان عالية على أطراف الخريطة تقفلها
MapConfig.EdgeWallWidth = 160
MapConfig.WaterLevel = -6

-- حدود الطبقات اللي تنكتب فيها الأرض (لازم تغطي أوطى وأعلى نقطة)
MapConfig.MinY = -48
MapConfig.MaxY = 224

-- الديرة: أرض مستوية في النص فيها القواعد والدكان
MapConfig.Town = {
	Radius = 210,
	Blend = 90, -- مسافة الانتقال من المستوي للكثبان
	PlazaRadius = 40,
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

-- مناطق الصيد حسب البعد عن الديرة: كل ما بعدت، الهبالي أندر،
-- والرجعة أطول وأخطر. هذا اللي يخلي تطوير السيارة له داعي.
MapConfig.Zones = {
	{ Id = "Common", DisplayName = "شعبي", MinRadius = 260, MaxRadius = 520 },
	{ Id = "Rare", DisplayName = "نادر", MinRadius = 480, MaxRadius = 740 },
	{ Id = "VeryRare", DisplayName = "نادر مرة", MinRadius = 700, MaxRadius = 900 },
} :: { Zone }

-- المعالم: الأسطوري يطلع حولها بس
MapConfig.Landmarks = {
	{ Id = "Oasis", DisplayName = "الواحة", X = 0, Z = -800, Radius = 110 },
	{ Id = "Canyon", DisplayName = "الوادي", X = 780, Z = 60, Radius = 60 },
	{ Id = "Tuwaiq", DisplayName = "جبال طويق", X = -790, Z = 120, Radius = 200 },
	{ Id = "Junkyard", DisplayName = "مقبرة السيارات", X = 140, Z = 800, Radius = 80 },
} :: { Landmark }

-- مجرى الوادي: خط متكسّر شرق الخريطة، عرضه وعمقه تحت
MapConfig.Canyon = {
	Path = {
		{ X = 640, Z = -520 },
		{ X = 760, Z = -200 },
		{ X = 780, Z = 60 },
		{ X = 720, Z = 360 },
		{ X = 820, Z = 640 },
	} :: { Point },
	Width = 70,
	Depth = 38,
}

-- الطرق: إسفلت من الديرة لكل معلم، الأرض حولها مستوية عشان السيارات
MapConfig.Roads = {
	Width = 18,
	Blend = 36,
	-- كل طريق يطلع من النص بخط مستقيم (شمال/شرق/جنوب/غرب) عشان يمر
	-- بين القواعد، وبعد الديرة يلف للمعلم.
	Paths = {
		{ { X = 0, Z = 0 }, { X = 0, Z = -690 } }, -- الواحة
		{ { X = 0, Z = 0 }, { X = 300, Z = 0 }, { X = 690, Z = 60 } }, -- الوادي (يوقف على الحافة)
		{ { X = 0, Z = 0 }, { X = -300, Z = 0 }, { X = -590, Z = 120 } }, -- طويق
		{ { X = 0, Z = 0 }, { X = 0, Z = 300 }, { X = 140, Z = 720 } }, -- مقبرة السيارات
	} :: { { Point } },
}

function MapConfig.GetLandmark(id: string): Landmark?
	for _, landmark in MapConfig.Landmarks do
		if landmark.Id == id then
			return landmark
		end
	end
	return nil
end

return MapConfig
