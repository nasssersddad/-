--!strict
-- مهمة أول 3 دقايق وحماية المبتدئ (اتفقنا 2026-10-23). أرقام ونصوص بس.

local OnboardingConfig = {}

-- الخطوات بالترتيب. Id يستخدمه السيرفر (Tutorial.Step)، و Text يطلع للاعب فوق الشاشة
OnboardingConfig.Steps = {
	{ Id = "Stun", Text = "اضرب الهبالي بالعقال 💥" },
	{ Id = "Grab", Text = "دوّخته! قرّب واضغط اسحب" },
	{ Id = "Car", Text = "اضغط زر سيارتي 🚙" },
	{ Id = "Load", Text = "حطه في حوض السيارة" },
	{ Id = "Unload", Text = "سوق لقاعدتك ونزّله 🏠" },
	{ Id = "Collect", Text = "اجمع فلوسك من الزر الأخضر 💰" },
}

OnboardingConfig.Reward = 500
OnboardingConfig.DoneText = "🎉 خلصت! +500 💰 شوف النادر اللي يلمع بعيد، أندر وأغلى!"

-- حماية المبتدئ: كم ثانية لعب (تنحسب وهو داخل اللعبة بس)
OnboardingConfig.NewbieSeconds = 15 * 60

return OnboardingConfig
