--!strict
-- إعدادات الإحساس والأصوات (مؤثرات للزينة بس، عند اللاعب).
-- الأصوات كلها من روبلوكس وشركائها المرخّصين (Pro Sound Effects و APM Music) عشان حقوق النشر.
-- صاحب اللعبة قال الأصوات الأولى مزعجة وما تناسب الحركة: خليناها قصيرة وواطية، وبدون موسيقى.

export type SoundSpec = { Id: number, Volume: number, Pitch: number? }

local FxConfig = {}

FxConfig.Sounds = {
	Swing = { Id = 12222200, Volume = 0.25 }, -- swoosh.wav (Roblox)
	Hit = { Id = 9113487557, Volume = 0.45 }, -- ضربة على الجسم قصيرة (Pro Sound Effects)
	Stun = { Id = 9113488983, Volume = 0.55, Pitch = 0.85 }, -- ضربة أثقل لما يدوخ (Pro Sound Effects)
	Gun = { Id = 12222200, Volume = 0.3, Pitch = 1.9 }, -- "فيو" سريع للسهم المنوّم (Roblox)
	CatchCommon = { Id = 9119323621, Volume = 0.45 }, -- طاخ وهو يطيح في الحوض (Pro Sound Effects)
	CatchRare = { Id = 9120975564, Volume = 0.3 }, -- جمهور يصارخ (Pro Sound Effects)
	Horn = { Id = 9114402335, Volume = 0.45 }, -- هرن (Pro Sound Effects)
	Alert = { Id = 9114402335, Volume = 0.2, Pitch = 1.6 }, -- تنبيه السيرفر: الهرن أحد وأوطى (مؤقت لين نختار صفارة)
	Engine = { Id = 80317022777602, Volume = 0.2 }, -- محرك (Roblox Resources)
	Drag = { Id = 9113597177, Volume = 0.35, Pitch = 0.7 }, -- سحب على الأرض (Pro Sound Effects) - عجب صاحب اللعبة
} :: { [string]: SoundSpec }

-- نفس الصوت ما يتكرر أسرع من كذا (ثواني)، عشان ما يصير إزعاج
FxConfig.SoundGap = 0.12

-- اللي أبعد من كذا ما يوصله المؤثر (stud)
FxConfig.Radius = 160

-- هزة الكاميرا للي ضرب
FxConfig.Shake = { Hit = 0.25, Stun = 0.6, Duration = 0.18 }

-- صوت المحرك: الحدة حسب السرعة. واطي عشان ما يزعج طول الوقت
FxConfig.Engine = { MinPitch = 0.75, MaxPitch = 1.4, IdleVolume = 0.06, DriveVolume = 0.2 }

FxConfig.HornCooldown = 1

return FxConfig
