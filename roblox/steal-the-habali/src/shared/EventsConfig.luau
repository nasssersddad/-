--!strict
-- المرحلة 6: التنبيهات، والعاصفة الرملية، والإنفنتي الأسبوعي.
-- كل الأوقات بتوقيت UTC (السعودية = UTC+3). أرقام بس عشان تنختبر برا روبلوكس.

local EventsConfig = {}

-- العاصفة الرملية: كل ساعة على الدقيقة AtMinute، ومدتها Duration ثانية
EventsConfig.Sandstorm = {
	AtMinute = 30,
	Duration = 300,
	Warning = 60, -- عدّاد قبلها بكذا ثانية
	CapMultiplier = 2, -- النادر وفوق ضعف العدد
	VariantMultiplier = 3, -- فرصة الذهبي والدايموند ×3
}

-- الإنفنتي: كل أسبوع يوم Weekday (0 = الأحد ... 5 = الجمعة) الساعة HourUTC
EventsConfig.Infinity = {
	Weekday = 5, -- الجمعة
	HourUTC = 18, -- 9 الليل بتوقيت السعودية
	Duration = 3600, -- يبقى ساعة، وبعدها يهرب لو محد صاده
	Radius = 2880, -- يطلع في الربع الخالي قريب من معلم
	Beam = 600, -- عمود النور فوقه
	Announce = { 3600, 600, 60 }, -- تنبيه قبله بساعة و10 دقايق ودقيقة
}

-- التنبيهات للسيرفر كله: على الغالي بس
EventsConfig.Alerts = {
	Rarities = { VeryRare = true, Legendary = true, Infinity = true } :: { [string]: boolean },
	Variants = { Gold = true, Diamond = true } :: { [string]: boolean },
	BeaconTime = 20, -- العلامة اللي فوق المكان تبقى كذا ثانية
}

return EventsConfig
