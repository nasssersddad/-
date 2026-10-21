--!strict
-- إعدادات الإحساس والأصوات (مؤثرات للزينة بس، عند اللاعب).
-- الأصوات كلها من روبلوكس وشركائها المرخّصين (Pro Sound Effects و APM Music) عشان حقوق النشر.

export type SoundSpec = { Id: number, Volume: number, Pitch: number? }

local FxConfig = {}

FxConfig.Sounds = {
	Swing = { Id = 12222200, Volume = 0.5 }, -- swoosh.wav (Roblox)
	Hit = { Id = 9125994773, Volume = 0.7 }, -- لعبة مطاط تصفّر (Pro Sound Effects)
	Stun = { Id = 9040476898, Volume = 0.45 }, -- Early Bird - Hit1 (APM)
	Gun = { Id = 9116275751, Volume = 0.45, Pitch = 1.6 }, -- شرارة كهربا (Pro Sound Effects)
	CatchCommon = { Id = 9045129322, Volume = 0.5 }, -- It's All A Big Joke - Tag2 (APM)
	CatchRare = { Id = 9045119921, Volume = 0.6 }, -- Mascot Party - Mnemonic1 (APM)
	Horn = { Id = 9114402335, Volume = 0.8 }, -- هرن (Pro Sound Effects)
	Engine = { Id = 80317022777602, Volume = 0.35 }, -- محرك (Roblox Resources)
	Drag = { Id = 9113597177, Volume = 0.35, Pitch = 0.7 }, -- سحب على الأرض (Pro Sound Effects)
} :: { [string]: SoundSpec }

-- اللي أبعد من كذا ما يوصله المؤثر (stud)
FxConfig.Radius = 160

-- هزة الكاميرا للي ضرب
FxConfig.Shake = { Hit = 0.25, Stun = 0.6, Duration = 0.18 }

-- صوت المحرك: الحدة حسب السرعة
FxConfig.Engine = { MinPitch = 0.7, MaxPitch = 1.6, IdleVolume = 0.15, DriveVolume = 0.4 }

FxConfig.HornCooldown = 1

return FxConfig
