-- تنسيق الوقت: 83.4 ثانية ← 1:23.4

local Format = {}

function Format.time(seconds: number): string
	seconds = math.max(0, seconds)
	local minutes = math.floor(seconds / 60)
	local rest = seconds - minutes * 60
	return string.format("%d:%04.1f", minutes, rest)
end

return Format
