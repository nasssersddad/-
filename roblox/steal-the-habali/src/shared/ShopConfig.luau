--!strict
-- المحلات (المرحلة 5): الأسلحة، وتطوير السيارة، والبنزين، والبيع عند أبو هبال.
-- الأرقام من docs/ECONOMY.md (وافق عليها صاحب اللعبة 2026-10-22). أرقام بس عشان تنختبر برا روبلوكس.
-- كل جدول: الليفل 1 مجاني ومعك من البداية. Price = سعر الوصول لهالليفل.

local ShopConfig = {}

export type Level = { [string]: any }

-- الضرب: Hits = كم ضربة لين يدوخ (شعبي / نادر / نادر مرة / أسطوري)
ShopConfig.Melee = {
	{ Name = "عقال", Price = 0, Mesh = "Agal", Hits = { Common = 3, Rare = 5, VeryRare = 8, Legendary = 12, Infinity = 20 } },
	{ Name = "عقال مقصّب", Price = 2_000, Mesh = "Agal2", Hits = { Common = 2, Rare = 4, VeryRare = 6, Legendary = 8, Infinity = 14 } },
	{ Name = "شبشب أم فهد", Price = 60_000, Mesh = "Slipper", Hits = { Common = 2, Rare = 3, VeryRare = 4, Legendary = 6, Infinity = 10 } },
	{ Name = "العقال الذهبي", Price = 2_500_000, Mesh = "Agal4", Hits = { Common = 1, Rare = 2, VeryRare = 3, Legendary = 4, Infinity = 7 } },
} :: { Level }

-- التنويم: Shots = كم طلقة لين ينام. Cloud = نص قطر الغيمة (تنوّم كل اللي فيها)
ShopConfig.Gun = {
	{ Name = "مسدس تنويم", Price = 0, Mesh = "DartGun", Range = 120, Cooldown = 2.5, Cloud = 0, Shots = { Common = 1, Rare = 1, VeryRare = 2, Legendary = 3, Infinity = 5 } },
	{ Name = "بندقية تنويم", Price = 15_000, Mesh = "DartRifle", Range = 200, Cooldown = 2.0, Cloud = 0, Shots = { Common = 1, Rare = 1, VeryRare = 2, Legendary = 2, Infinity = 4 } },
	{ Name = "قاذف النعاس", Price = 900_000, Mesh = "SleepLauncher", Range = 150, Cooldown = 3.5, Cloud = 12, Shots = { Common = 1, Rare = 1, VeryRare = 1, Legendary = 2, Infinity = 3 } },
} :: { Level }

-- ورشة أبو كفر
ShopConfig.Engine = {
	{ Name = "محرك الربع", Price = 0, Speed = 40 },
	{ Name = "محرك 2", Price = 3_000, Speed = 48 },
	{ Name = "محرك 3", Price = 40_000, Speed = 56 },
	{ Name = "محرك 4", Price = 500_000, Speed = 66 },
	{ Name = "محرك تيربو", Price = 4_000_000, Speed = 80 },
} :: { Level }

ShopConfig.Load = {
	{ Name = "حوض الربع", Price = 0, Capacity = 3 },
	{ Name = "حوض 4", Price = 6_000, Capacity = 4 },
	{ Name = "حوض 6", Price = 150_000, Capacity = 6 },
	{ Name = "حوض 8", Price = 1_200_000, Capacity = 8 },
	{ Name = "حوض 10", Price = 8_000_000, Capacity = 10 },
} :: { Level }

-- التانكي: كم stud تقدر تسوق وهو مليان
ShopConfig.Tank = {
	{ Name = "تانكي الربع", Price = 0, Size = 5_000 },
	{ Name = "تانكي 7500", Price = 5_000, Size = 7_500 },
	{ Name = "تانكي 10000", Price = 100_000, Size = 10_000 },
	{ Name = "تانكي 14000", Price = 900_000, Size = 14_000 },
} :: { Level }

-- البنزين (أبو فلّة)
ShopConfig.Fuel = {
	PricePerStud = 0.04, -- فل تانكي الربع بـ 200 تقريباً
	JerryPrice = 300,
	JerryAmount = 2_500,
	MaxJerries = 2,
	AbandonTime = 180, -- سيارة خالصة بنزين ومحد فيها: بعد هالمدة ترجع للديرة فاضية
}

-- أبو هبال يشتري الهبالي بدخل كم ثانية منه
ShopConfig.SellSeconds = 300

-- لازم تكون قريب من المحل عشان تشتري (السيرفر يتحقق)
ShopConfig.ShopDistance = 16
-- السيارة لازم تكون قريبة من المحطة / أبو هبال
ShopConfig.CarDistance = 45

-- أماكن المحلات في الديرة (X, Z). أبو هبال في الدكان اللي في النص، وأبو فلّة في محطة البنزين.
ShopConfig.Shops = {
	{ Id = "Habal", Name = "أبو هبال", Title = "يشتري هباليك 💰", X = 0, Z = 0 },
	-- بين طريق الغرب/الشرق ومواقف السيارات (65 stud عن النص، 202.5° و 337.5°)، بعيد عن الطرق
	{ Id = "Agal", Name = "أبو عقيل", Title = "محل العقّال", X = -60, Z = -25 },
	{ Id = "Garage", Name = "أبو كفر", Title = "ورشة أبو كفر 🔧", X = 60, Z = -25 },
	{ Id = "Fuel", Name = "أبو فلّة", Title = "محطة البنزين ⛽", X = 80, Z = 36 },
}

-- اللي يتطور، وفي أي محل
ShopConfig.Upgrades = {
	Melee = "Agal",
	Gun = "Agal",
	Engine = "Garage",
	Load = "Garage",
	Tank = "Garage",
} :: { [string]: string }

return ShopConfig
