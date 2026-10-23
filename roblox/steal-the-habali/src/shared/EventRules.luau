--!strict
-- حسابات أوقات العاصفة والإنفنتي، ومين يستاهل تنبيه. دوال بس عشان تنختبر برا روبلوكس.
-- الوقت: ثواني unix (UTC). يوم 1970-01-01 كان خميس.

local EventRules = {}

local DAY = 86400
local HOUR = 3600

function EventRules.new(config: any)
	local rules = {}

	-- 0 = الأحد ... 6 = السبت
	function rules.Weekday(t: number): number
		return (math.floor(t / DAY) + 4) % 7
	end

	-- العاصفة: (شغّالة؟، متى تبدأ اللي جاية أو اللي شغّالة، متى تخلص)
	function rules.Sandstorm(t: number): (boolean, number, number)
		local storm = config.Sandstorm
		local hourStart = t - t % HOUR
		local start = hourStart + storm.AtMinute * 60
		if t >= start + storm.Duration then
			start += HOUR
		end
		local active = t >= start and t < start + storm.Duration
		return active, start, start + storm.Duration
	end

	-- الإنفنتي: (طالع الحين؟، متى يبدأ اللي جاي أو الطالع، متى يخلص)
	function rules.Infinity(t: number): (boolean, number, number)
		local inf = config.Infinity
		local today = math.floor(t / DAY)
		for k = -1, 7 do
			local day = today + k
			if (day + 4) % 7 == inf.Weekday then
				local start = day * DAY + inf.HourUTC * HOUR
				if t < start + inf.Duration then
					return t >= start, start, start + inf.Duration
				end
			end
		end
		return false, 0, 0 -- ما يصير
	end

	-- يستاهل تنبيه للسيرفر كله؟
	function rules.ShouldAlert(rarity: string, variant: string?): boolean
		return config.Alerts.Rarities[rarity] == true or (variant ~= nil and config.Alerts.Variants[variant] == true)
	end

	-- "2 يوم 4 ساعة"، "12 دقيقة"، "45 ثانية"
	function rules.FormatIn(seconds: number): string
		seconds = math.max(0, math.floor(seconds))
		if seconds >= DAY then
			return string.format("%d يوم %d ساعة", seconds // DAY, (seconds % DAY) // HOUR)
		elseif seconds >= HOUR then
			return string.format("%d ساعة %d دقيقة", seconds // HOUR, (seconds % HOUR) // 60)
		elseif seconds >= 60 then
			return string.format("%d دقيقة", math.ceil(seconds / 60))
		end
		return string.format("%d ثانية", seconds)
	end

	return rules
end

return EventRules
