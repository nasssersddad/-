--!strict
-- إعدادات الصيد والسحب والسيارة (المرحلة 3).
-- أرقام بس عشان نختبرها برا روبلوكس. مفاتيح الندرة: Common / Rare / VeryRare / Legendary.

local CatchConfig = {}

-- العقال: ضرب من قريب
CatchConfig.Melee = {
	Name = "عقال",
	Range = 8, -- من نص اللاعب لنص الهبالي (بالـ stud)
	Cooldown = 0.4,
	HitsToStun = { Common = 3, Rare = 5, VeryRare = 8, Legendary = 12, Infinity = 20 } :: { [string]: number },
}

-- مسدس التنويم: من بعيد، ويصوّب تلقائياً على أقرب هبالي قدامك
CatchConfig.Gun = {
	Name = "مسدس التنويم",
	Range = 120,
	Cooldown = 2.5,
	AimCone = 12, -- بالدرجات: كم يسامح لو التصويب مو دقيق
	ShotsToStun = { Common = 1, Rare = 1, VeryRare = 2, Legendary = 3, Infinity = 5 } :: { [string]: number },
}

-- كم ثانية يجلس دايخ، وبعدها يصحى ويشرد
CatchConfig.StunTime = { Common = 25, Rare = 20, VeryRare = 15, Legendary = 12, Infinity = 10 } :: { [string]: number }

-- لو ما أحد ضربه هالمدة، يرجع كامل
CatchConfig.RecoverTime = 8

-- النادر وفوق يشرد أسرع بعد ما ينضرب
CatchConfig.Flee = {
	Rarities = { Rare = true, VeryRare = true, Legendary = true, Infinity = true } :: { [string]: boolean },
	SpeedMultiplier = 2,
	Time = 6,
}

-- لما تمسك النادر مرة أو الأسطوري ممكن يصحى وينطحك
CatchConfig.Resist = {
	Chance = { VeryRare = 0.3, Legendary = 0.5, Infinity = 0.6 } :: { [string]: number },
	HealthAfter = 0.4, -- يصحى وباقي له هالنسبة، يعني تحتاج ضربات أقل
	KnockbackSpeed = 70,
	KnockbackUp = 35,
}

-- السحب
CatchConfig.Drag = {
	PromptHold = 0.5,
	PromptDistance = 10,
	GrabDistance = 14, -- السيرفر يرفض لو أبعد من كذا
	NormalWalkSpeed = 16,
	WalkSpeed = { Common = 14, Rare = 12, VeryRare = 10, Legendary = 8, Infinity = 7 } :: { [string]: number },
	RopeLength = 7,
	BreakDistance = 30, -- لو بعد عنك أكثر من كذا (نط أو انتقال) يفلت
}

-- وزن كل ندرة (السيارة لها حمولة)
CatchConfig.Weight = { Common = 1, Rare = 2, VeryRare = 4, Legendary = 6, Infinity = 6 } :: { [string]: number }

-- سيارة الربع: أول سيارة، معك من البداية
CatchConfig.Car = {
	Name = "ربع",
	MaxSpeed = 40, -- stud/ثانية: حافة الماب في دقيقة ونص تقريباً
	Reverse = 0.5, -- سرعة الرجوع نسبة من السرعة
	Capacity = 3,
	Slots = 3,
	SlowPerWeight = 0.08, -- كل وزن يبطّيها 8%
	MinSpeedFactor = 0.5,
	SteerAngle = 32, -- بالدرجات
	LoadDistance = 14,
	SpawnCooldown = 10,
	SpeedTolerance = 1.5, -- السيرفر يرجّعها لو تعدّت السرعة × هالرقم
}

return CatchConfig
