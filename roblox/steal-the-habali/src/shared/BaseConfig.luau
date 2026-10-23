--!strict
-- إعدادات القواعد والدخل والسرقة والثأر والحفظ (المرحلة 4).
-- أرقام بس عشان نختبرها برا روبلوكس.

local BaseConfig = {}

BaseConfig.Slots = 10 -- منصات العرض في كل قاعدة

-- الدخل بالثانية لكل هبالي على منصة، والنسخ الخاصة تضرب فيه
BaseConfig.Income = { Common = 1, Rare = 4, VeryRare = 15, Legendary = 50, Infinity = 300 } :: { [string]: number }
BaseConfig.VariantMultiplier = { Normal = 1, Gold = 3, Diamond = 10 } :: { [string]: number }

-- الفلوس تتجمع في القاعدة لين ترجع تاخذها، بس لها حد (كم ثانية من الدخل)
BaseConfig.PendingCapSeconds = 600

-- الدرع: القاعدة محمية لو صاحبها أبعد من كذا عن نص الديرة (أو مو موجود)
BaseConfig.ShieldRadius = 260

-- القفل: يقفل القاعدة هالمدة، وبعدها لازم تنتظر قبل ما تقفلها مرة ثانية
BaseConfig.LockTime = 60
BaseConfig.LockCooldown = 60

-- السرقة
BaseConfig.Steal = {
	BaseHold = 3, -- ثواني ضغط مطوّل عشان تشيل هبالي من قاعدة غيرك
	CarHold = 4, -- من حوض سيارة واقفة
	PromptDistance = 10,
	CarryWalkSpeed = 10, -- تمشي أبطأ وأنت شايل
	HitsToDrop = 3, -- كم ضربة عقال على اللي شايل أو ساحب عشان يطيّحه
	HitWindow = 6, -- الضربات لازم تكون خلال هالثواني
}

-- الثأر: علامة على الحرامي، ولو رجّعت منه خلال الوقت تاخذ بونص
BaseConfig.Revenge = {
	Time = 60,
	BonusSeconds = 120, -- البونص = دخل الهبالي المسترجع لهالمدة
	PairCooldown = 600, -- بونص واحد بس من نفس الحرامي كل 10 دقايق (ضد ربع يسرقون من بعض)
}

-- الحفظ
BaseConfig.Data = {
	StoreName = "PlayerData_v1",
	Version = 1,
	AutosaveSeconds = 60,
	SessionStaleSeconds = 180, -- قفل جلسة أقدم من كذا نعتبره ميت (السيرفر طاح)
	LoadRetries = 6,
	LoadRetryWait = 5,
	MaxMoney = 1e12,
}

return BaseConfig
