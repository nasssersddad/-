--!strict
-- المرحلة 7ب: المطلوب الأول، والعصابة والدعوة، وإعادة البداية، ولوحة الأبطال (اتفقنا 2026-10-24).

local RivalsConfig = {}

-- المطلوب الأول: أغنى واحد في السيرفر (فلوسه + قيمة بيع هباليه)
RivalsConfig.MostWanted = {
	MinPlayers = 2,
	Refresh = 10, -- ثواني
	StealBonus = 0.2, -- اللي يسرق منه ياخذ +20% من سعر بيع الهبالي
}

-- العصابة: لكل صديق روبلوكس معك في السيرفر +10% دخل، لين +30%
RivalsConfig.Gang = {
	PerFriend = 0.1,
	MaxFriends = 3,
	InviteReward = 1_000, -- للاثنين لما يدخل صديق أول مرة من دعوتك
	MaxInviteRewards = 10, -- كم مرة بالكثير ياخذ اللي يدعي (ضد الحسابات الوهمية)
}

-- إعادة البداية: السعر يتضاعف ×2.5، وكل مرة +25% دخل للأبد. الهبالي يبقون
RivalsConfig.Rebirth = {
	BasePrice = 10_000_000,
	PriceGrowth = 2.5,
	IncomeBonus = 0.25,
}

-- لوحة الأبطال في الديرة
RivalsConfig.Leaderboard = {
	Refresh = 120, -- ثواني
	Top = 10,
	RichStore = "RichBoard_v1",
	RebirthStore = "RebirthBoard_v1",
	X = -26, -- في الساحة (بعيد عن الطرق والدكان)
	Z = -26,
}

return RivalsConfig
