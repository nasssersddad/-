-- يفحص المسارين: تقدر توصل للنهاية بالنطّات؟ والجسور التعاونية لازم لها زر؟ (يشغّله run_course_check.py)
local course = CourseBuilder.build()
local JUMP, WALK = Config.JumpPower, 16
local SAFETY = 0.75
local function reach(g, rise)
	local disc = JUMP * JUMP - 2 * g * rise
	if disc < 0 then return -1 end
	return WALK * (JUMP + math.sqrt(disc)) / g
end
local function maxHeight(g) return JUMP * JUMP / (2 * g) end

local function stageOf(o)
	local p = o.Parent
	while p do
		local n = p.Name or ""
		local coop = string.match(n, "^CoopStage(%d+)$")
		if coop then return "coop", tonumber(coop) end
		local solo = string.match(n, "^Stage(%d+)$")
		if solo then return "solo", tonumber(solo) end
		if n == "CoopFinish" then return "coop", 99 end
		if n == "Finish" then return "solo", 99 end
		if n == "Lobby" then return "solo", 0 end
		p = p.Parent
	end
	return "?", -1
end

local pieces = {}
local function add(o, kind)
	local p = o.CFrame.Position
	local sx, sy, sz = o.Size.X, o.Size.Y, o.Size.Z
	if o.Shape == "PartType.Cylinder" then sx, sy, sz = o.Size.Y, o.Size.X, o.Size.Z end
	local mode, stage = stageOf(o)
	local piece = { o = o, kind = kind, mode = mode, stage = stage, minX = p.X - sx/2, maxX = p.X + sx/2,
		minZ = p.Z - sz/2, maxZ = p.Z + sz/2, top = p.Y + sy/2, bottom = p.Y - sy/2, name = o.Name or o.ClassName }
	table.insert(pieces, piece)
	return piece
end
for _, o in ALL do
	if (o.ClassName == "Part" or o.ClassName == "TrussPart" or o.ClassName == "SpawnLocation") and o.Size and o.CFrame then
		if o.tags.Kill or o.Name == "Sign" or o.Name == "Pillar" or o.Name == "TrophyBase" or o.Name == "Trophy" then
			-- skip
		elseif o.Name == "Bridge" then
			add(o, "bridge")
		elseif o.ClassName == "TrussPart" then
			add(o, "truss")
		elseif o.Name == "Mover" then
			local a = add(o, "mover")
			local off = o:GetAttribute("Offset")
			local b = add(o, "moverEnd")
			b.minX += off.X; b.maxX += off.X
			a.twin = b; b.twin = a
		elseif o.Name == "JumpPad" or o.Name == "BridgePlate" or o.Name == "Checkpoint" or o.Name == "FinishPad" or string.match(o.Name or "", "^PairPad") then
			-- thin decor on top of platforms; JumpPad handled via its platform
			if o.Name == "JumpPad" then o.__pad = true; table.insert(pieces, { padOnly = o }) end
		elseif o.CanCollide ~= false then
			add(o, "solid")
		end
	end
end

local pads = {}
for i = #pieces, 1, -1 do if pieces[i].padOnly then table.insert(pads, table.remove(pieces, i).padOnly) end end

local function gravityFor(piece)
	if piece.mode ~= "solo" or piece.stage < 1 or piece.stage > #Config.Stages then return Config.DefaultGravity end
	local world = Config.Worlds[Config.Stages[piece.stage].world]
	return if world.twist == "lowGravity" then Config.LowGravity else Config.DefaultGravity
end

local function edgeDist(a, b)
	local dx = math.max(0, a.minX - b.maxX, b.minX - a.maxX)
	local dz = math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ)
	return math.sqrt(dx*dx + dz*dz)
end

local function canGo(a, b, allowBridge)
	if a == b then return false end
	if a.mode ~= b.mode then return false end
	if (a.kind == "bridge" or b.kind == "bridge") and not allowBridge then return false end
	if a.twin == b then return true end
	local d = edgeDist(a, b)
	local rise = b.top - a.top
	-- truss: climb from adjacent piece to the truss top, and step off at the top
	if a.kind == "truss" or b.kind == "truss" then
		local t = if a.kind == "truss" then a else b
		local other = if a.kind == "truss" then b else a
		return d <= 0.6 and other.top >= t.bottom - 0.5 and other.top <= t.top + 0.5
	end
	if d <= 0.6 and math.abs(rise) <= 1.2 then return true end -- walk/step
	local g = gravityFor(a)
	if rise > maxHeight(g) * 0.85 then
		-- jump pad on a?
		for _, pad in pads do
			local pp = pad.CFrame.Position
			if pp.X >= a.minX and pp.X <= a.maxX and pp.Z >= a.minZ and pp.Z <= a.maxZ and math.abs(pp.Y - a.top) < 1 then
				local h = pad:GetAttribute("LaunchHeight")
				if rise <= h - 4 and d <= 12 then return true end
			end
		end
		return false
	end
	local r = reach(g, math.max(rise, 0))
	return r > 0 and d <= r * SAFETY
end

local function bfs(mode, startPred, goalPred, allowBridge)
	local start, goal
	for _, p in pieces do
		if p.mode == mode and startPred(p) and not start then start = p end
		if p.mode == mode and goalPred(p) then goal = p end
	end
	assert(start and goal, "missing start/goal for " .. mode)
	local seen = { [start] = true }
	local queue = { start }
	local reachedStage = -1
	while #queue > 0 do
		local cur = table.remove(queue, 1)
		if cur == goal then return true, reachedStage end
		reachedStage = math.max(reachedStage, cur.stage)
		for _, nxt in pieces do
			if not seen[nxt] and canGo(cur, nxt, allowBridge) then
				seen[nxt] = true
				table.insert(queue, nxt)
			end
		end
	end
	return false, reachedStage
end

local failures = 0
local function check(cond, msg)
	print((cond and "PASS " or "FAIL ") .. msg)
	if not cond then failures += 1 end
end

-- 1) solo: lobby -> finish
local ok, st = bfs("solo", function(p) return p.stage == 0 end, function(p) return p.stage == 99 end, false)
check(ok, "solo course reachable lobby -> finish (furthest stage " .. st .. ")")
-- 2) coop: start -> finish with bridges
ok, st = bfs("coop", function(p) return p.stage == 1 end, function(p) return p.stage == 99 end, true)
check(ok, "coop course reachable with bridges on (furthest stage " .. st .. ")")
-- 3) coop: without bridges must be blocked at the first bridge stage
ok, st = bfs("coop", function(p) return p.stage == 1 end, function(p) return p.stage == 99 end, false)
check(not ok, "coop course NOT reachable without bridges (stuck at stage " .. st .. ")")
-- 4) each bridge gap unjumpable and plates within rope length
for i, group in course.coop.bridges do
	local b = group.bridge
	local gap = b.Size.X
	local r = reach(Config.DefaultGravity, 0)
	check(gap > r, string.format("bridge %d gap %.1f > max jump %.2f", i, gap, r))
	local p1, p2 = group.plates[1].CFrame.Position, group.plates[2].CFrame.Position
	local dist = (p1 - p2).Magnitude
	check(dist <= Config.Coop.ropeLength - 1, string.format("bridge %d plates %.1f apart <= rope %d - 1", i, dist, Config.Coop.ropeLength))
	-- partner on plate must be able to stand while other walks the whole bridge
	local far = 0
	for _, plate in group.plates do
		local pp = plate.CFrame.Position
		for _, x in { b.CFrame.Position.X - gap/2, b.CFrame.Position.X + gap/2 } do
			local bp = Vector3.new(x, b.CFrame.Position.Y + 1, b.CFrame.Position.Z)
			local dd = (bp - pp).Magnitude
			if dd > far then far = dd end
		end
	end
	check(far <= Config.Coop.ropeLength, string.format("bridge %d: farthest bridge end from a plate %.1f <= rope", i, far))
end
-- 5) coop spawn offsets land on checkpoint platforms
for stage, cf in course.coop.checkpoints do
	local pad = course.coop.checkpointPads[stage]
	check(math.abs(cf.Z - pad.CFrame.Z) < 0.01, "coop checkpoint " .. stage .. " spawn above pad")
end
print("checkpoints solo", #course.checkpoints, "coop", #course.coop.checkpoints, "bridges", #course.coop.bridges)
print(failures == 0 and "ALL PASS" or (failures .. " FAILURES"))
