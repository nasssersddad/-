-- اختبار قواعد طلوع الهبالي برا روبلوكس:
--   luau roblox/steal-the-habali/tests/HabaliRules.test.luau

local MapConfig = require("../src/shared/MapConfig")
local HabaliConfig = require("../src/shared/HabaliConfig")
local HabaliRules = require("../src/shared/HabaliRules")

local rules = HabaliRules.new(MapConfig, HabaliConfig)
local wander = HabaliConfig.Wander
local failures = 0

local function check(ok: boolean, message: string)
	if not ok then
		failures += 1
		print("FAIL: " .. message)
	end
end

-- نرد ثابت (نفس الأرقام كل مرة) عشان الاختبار يطلع نفس النتيجة
local function makeRng(seed: number)
	-- Park-Miller: الضرب يبقى أصغر من 2^53 فما نخسر دقة
	local state = seed
	return function(): number
		state = (state * 16807) % 2147483647
		return (state - 1) / 2147483646
	end
end

local function radiusOf(x: number, z: number): number
	return math.sqrt(x * x + z * z)
end

local function distanceToRoads(x: number, z: number): number
	local best = math.huge
	for _, path in MapConfig.Roads.Paths do
		for i = 1, #path - 1 do
			local a, b = path[i], path[i + 1]
			local abx, abz = b.X - a.X, b.Z - a.Z
			local t = math.clamp(((x - a.X) * abx + (z - a.Z) * abz) / (abx * abx + abz * abz), 0, 1)
			best = math.min(best, math.sqrt((x - a.X - abx * t) ^ 2 + (z - a.Z - abz * t) ^ 2))
		end
	end
	return best
end

local roadFlat = MapConfig.Roads.Width / 2 + MapConfig.Roads.Shoulder + MapConfig.Roads.FlatMargin

-- كل طبقة لها حد وتأخير وسرعة ولون
local total = 0
for _, zone in MapConfig.Zones do
	check(HabaliConfig.Caps[zone.Id] ~= nil, "no cap for " .. zone.Id)
	check(HabaliConfig.RespawnDelay[zone.Id] ~= nil, "no respawn delay for " .. zone.Id)
	check(HabaliConfig.WalkSpeed[zone.Id] ~= nil, "no walk speed for " .. zone.Id)
	check(HabaliConfig.RarityColors[zone.Id] ~= nil, "no colour for " .. zone.Id)
	total += HabaliConfig.Caps[zone.Id] or 0
end
check(total == 26, "caps should total 26, got " .. total)

-- مشوار وحد ما يقدر يقفز من جهة الطريق للجهة الثانية
check(wander.RoadClearance * 2 > wander.StepMax, "road clearance too small for StepMax")
check(wander.RoadClearance > roadFlat, "road clearance inside the flat road strip")

-- الطلوع: داخل الطبقة، بعيد عن الطرق والمعالم
local rng = makeRng(42)
for _, zone in MapConfig.Zones do
	local found = 0
	for _ = 1, 2000 do
		local x, z = rules.SamplePoint(zone.Id, rng)
		if x and z then
			found += 1
			local r = radiusOf(x, z)
			check(r >= zone.MinRadius + wander.ZoneMargin and r <= zone.MaxRadius - wander.ZoneMargin, zone.Id .. " spawn outside ring at r=" .. r)
			check(MapConfig.GetZoneAt(r) == zone, zone.Id .. " spawn in another zone")
			check(distanceToRoads(x, z) >= wander.RoadClearance, zone.Id .. " spawn on road")
			for _, landmark in MapConfig.Landmarks do
				local d = math.sqrt((x - landmark.X) ^ 2 + (z - landmark.Z) ^ 2)
				check(d >= landmark.Radius + wander.LandmarkMargin, zone.Id .. " spawn inside " .. landmark.Id)
			end
		end
	end
	check(found >= 1990, zone.Id .. " sampler failed too often: " .. found .. "/2000")
end

-- المشي: يبقى داخل طبقته طول المشوار، ومسافته في الحدود
for _, zone in MapConfig.Zones do
	local x, z = rules.SamplePoint(zone.Id, rng)
	assert(x and z, "no start point")
	local moved = 0
	for _ = 1, 3000 do
		local tx, tz = rules.WanderTarget(x, z, zone.Id, rng)
		if tx and tz then
			local d = math.sqrt((tx - x) ^ 2 + (tz - z) ^ 2)
			check(d >= wander.StepMin - 1e-6 and d <= wander.StepMax + 1e-6, "step length " .. d)
			for i = 0, 20 do
				local t = i / 20
				local px, pz = x + (tx - x) * t, z + (tz - z) * t
				check(rules.IsAllowed(px, pz, zone.Id), zone.Id .. " walk left allowed area")
				check(MapConfig.GetZoneAt(radiusOf(px, pz)) == zone, zone.Id .. " walk crossed zone border")
			end
			x, z = tx, tz
			moved += 1
		end
	end
	check(moved > 2500, zone.Id .. " wanderer stuck too often: " .. moved)
end

-- نسب الذهبي والدايموند
local counts = { Diamond = 0, Gold = 0, Normal = 0 }
local rolls = 400000
local oddsRng = makeRng(7)
for _ = 1, rolls do
	local id = rules.RollVariant(oddsRng)
	counts[id] += 1
end
local diamond, gold = counts.Diamond / rolls, counts.Gold / rolls
check(math.abs(diamond - 0.005) < 0.001, string.format("diamond rate %.4f", diamond))
check(math.abs(gold - 0.03) < 0.002, string.format("gold rate %.4f", gold))
check(rules.RollVariant(function() return 0 end) == "Diamond", "roll 0 should be Diamond")
check(rules.RollVariant(function() return 0.0049 end) == "Diamond", "roll 0.0049 should be Diamond")
check(rules.RollVariant(function() return 0.005 end) == "Gold", "roll 0.005 should be Gold")
check(rules.RollVariant(function() return 0.0349 end) == "Gold", "roll 0.0349 should be Gold")
check(rules.RollVariant(function() return 0.035 end) == "Normal", "roll 0.035 should be Normal")
check(rules.RollVariant(function() return 0.9999 end) == "Normal", "roll 0.9999 should be Normal")

-- الشخصيات الثلاث كلها تطلع
local seen = {}
for _ = 1, 300 do
	seen[rules.PickCharacter(rng)] = true
end
for _, character in HabaliConfig.Characters do
	check(seen[character.Id] == true, "character never picked: " .. character.Id)
end
check(rules.PickCharacter(function() return 0.99999 end) == HabaliConfig.Characters[#HabaliConfig.Characters].Id, "last character")

-- هوك أول دقيقة: من أي اتجاه نلقى مكان للشعبي والنادر، والنادر بنفس الاتجاه تقريباً
local hook = HabaliConfig.Hook
for degrees = 0, 359, 5 do
	local angle = math.rad(degrees)
	local cx, cz = rules.PointNear("Common", angle, hook.CommonRadius)
	check(cx ~= nil, "no hook Common spot at " .. degrees)
	local rx, rz = rules.PointNear("Rare", angle, hook.RareRadius)
	check(rx ~= nil, "no hook Rare spot at " .. degrees)
	if cx and cz then
		check(math.abs(radiusOf(cx, cz) - hook.CommonRadius) < 1e-6, "hook Common radius")
	end
	if rx and rz then
		local diff = math.abs((math.atan2(rz, rx) - angle + math.pi) % (2 * math.pi) - math.pi)
		check(diff < math.rad(20), "hook Rare drifted " .. math.deg(diff) .. " deg at " .. degrees)
	end
end
-- اللاعب يطلع على طريق الجنوب، فالهوك لازم ينزاح عن الطريق
local sx, sz = rules.PointNear("Common", math.rad(90), hook.CommonRadius)
check(sx ~= nil and sz ~= nil and distanceToRoads(sx, sz) >= wander.RoadClearance, "hook on south road")

-- طبقة مو موجودة
check(rules.SamplePoint("Nope", rng) == nil, "unknown zone should give nil")
check(not rules.IsAllowed(0, 0, "Common"), "Dira centre must not be allowed")

if failures == 0 then
	print("HabaliRules: all checks passed")
else
	error(string.format("HabaliRules: %d failure(s)", failures))
end
