-- الأحداث بالوقت: العاصفة الرملية (كل ساعة على الدقيقة 30)، والإنفنتي (كل جمعة 9 الليل بتوقيت السعودية).
-- السيرفر يحسب الوقت ويطلّع الهبالي، ويكتب الأوقات على ReplicatedStorage عشان الجوال يعرض العدّاد.
-- للتجربة في Studio بس: workspace:SetAttribute("EventTimeOffset", ثواني) يقدّم الساعة.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local EventsConfig = require(Shared:WaitForChild("EventsConfig"))
local EventRules = require(Shared:WaitForChild("EventRules"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))
local Alerts = require(script.Parent:WaitForChild("Alerts"))

local EventService = {}

local rules = EventRules.new(EventsConfig)
local stormOn = false
local infinityModel: Model? = nil
local infinityStart: number? = nil -- بداية الإنفنتي اللي طلع (عشان ما يطلع مرتين بنفس الأسبوع)
local announced: { [string]: boolean } = {}

local function now(): number
	local offset = if RunService:IsStudio() then Workspace:GetAttribute("EventTimeOffset") else nil
	return os.time() + (if type(offset) == "number" then offset else 0)
end

local function landmarkName(angle: number): string
	-- أقرب معلم لهالزاوية
	local best, bestDiff = "الربع الخالي", math.huge
	for _, landmark in MapConfig.Landmarks do
		local a = math.atan2(landmark.Z, landmark.X)
		local diff = math.abs(math.atan2(math.sin(a - angle), math.cos(a - angle)))
		if diff < bestDiff then
			best, bestDiff = landmark.DisplayName, diff
		end
	end
	return best
end

local function spawnInfinity(start: number)
	infinityStart = start
	local landmarks = MapConfig.Landmarks
	local landmark = landmarks[math.random(1, #landmarks)]
	local angle = math.atan2(landmark.Z, landmark.X)
	local model = HabaliService.SpawnSpecial("Infinity", angle, EventsConfig.Infinity.Radius, EventsConfig.Infinity.Beam)
	if not model then
		warn("[Events] ما قدرنا نطلّع الإنفنتي")
		return
	end
	infinityModel = model
	ReplicatedStorage:SetAttribute("InfinityWhere", landmarkName(angle))
	local root = model.PrimaryPart
	Alerts.Event("♾️ طلع الإنفنتي عند " .. landmarkName(angle) .. "! أول واحد يصيده ياخذه", "Infinity", root and root.Position)
end

local function tick()
	local t = now()
	ReplicatedStorage:SetAttribute("EventClockOffset", t - Workspace:GetServerTimeNow())

	-- العاصفة
	local active, start, finish = rules.Sandstorm(t)
	ReplicatedStorage:SetAttribute("SandstormStart", start)
	ReplicatedStorage:SetAttribute("SandstormEnd", finish)
	if active and not stormOn then
		stormOn = true
		HabaliService.SetBoost(EventsConfig.Sandstorm.CapMultiplier, EventsConfig.Sandstorm.VariantMultiplier)
		Alerts.Event("🌪️ العاصفة الرملية بدأت! النادر ضعف، والذهبي والدايموند أكثر", "Storm")
	elseif not active and stormOn then
		stormOn = false
		HabaliService.SetBoost(1, 1)
		Alerts.Event("🌤️ خلصت العاصفة الرملية", "Storm")
	elseif not active and start - t <= EventsConfig.Sandstorm.Warning and not announced["storm" .. start] then
		announced["storm" .. start] = true
		Alerts.Event("🌪️ عاصفة رملية بعد دقيقة! جهّز سيارتك", "Storm")
	end

	-- الإنفنتي
	local infActive, infStart, infEnd = rules.Infinity(t)
	ReplicatedStorage:SetAttribute("InfinityStart", infStart)
	ReplicatedStorage:SetAttribute("InfinityEnd", infEnd)
	if infActive and infinityStart ~= infStart then
		spawnInfinity(infStart)
	elseif not infActive then
		for _, before in EventsConfig.Infinity.Announce do
			local key = "inf" .. infStart .. ":" .. before
			if infStart - t <= before and infStart - t > before - 5 and not announced[key] then
				announced[key] = true
				Alerts.Event("♾️ الإنفنتي يطلع بعد " .. rules.FormatIn(before) .. "!", "Infinity")
			end
		end
	end
	-- خلص وقته وهو للحين في الصحراء: يهرب
	if infinityModel and (not infActive or infinityStart ~= infStart) then
		if infinityModel.Parent and HabaliService.IsFree(infinityModel) then
			infinityModel:Destroy()
			Alerts.Event("♾️ الإنفنتي هرب! يرجع الجمعة الجاية", "Infinity")
		end
		infinityModel = nil
		ReplicatedStorage:SetAttribute("InfinityWhere", nil)
	end
	if infinityModel and not HabaliService.IsActive(infinityModel) then
		infinityModel = nil -- انصاد (تنبيه الصيدة يطلع من CatchService)
		ReplicatedStorage:SetAttribute("InfinityWhere", nil)
	end
end

function EventService.Start()
	task.spawn(function()
		while true do
			local ok, err = pcall(tick)
			if not ok then
				warn("[Events]", err)
			end
			task.wait(1)
		end
	end)
end

return EventService
