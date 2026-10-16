-- 🪢 الوضع التعاوني: يربط لاعبين بحبل في مسار خاص
-- - دوائر الربط في اللوبي: كل واحد يوقف على دائرة، وبعد 3 ثواني تنربطون
-- - نقطة الحفظ مشتركة، ولو واحد طاح الثنين يرجعون لها
-- - الحبل يسحبه الكلاينت (كل لاعب يتسحب لخويه)، والسيرفر يحدد طوله
-- - الجسور بالأزرار: الجسر يطلع لما أحد يوقف على أحد الأزرار

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Format = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Format"))

local CoopConfig = Config.Coop

type Team = {
	a: Player,
	b: Player,
	stage: number,
	length: number,
	publishedLength: number,
	reeling: { [Player]: boolean },
	beam: Beam,
	startTime: number,
	finished: boolean,
	quietUntil: number, -- وقت ما نتجاهل فيه الموت (رسبون مقصود أو موت متسلسل)
}

export type Options = {
	course: any, -- CourseBuilder.CoopCourse
	lobby: any, -- CourseBuilder.Lobby
	remotes: Folder,
	notify: RemoteEvent,
	onCoopWin: (player: Player, elapsed: number) -> number, -- يرجّع عدد مرات الفوز التعاوني
}

local Coop = {}

local teams: { [Player]: Team } = {}
local course
local lobby
local notify: RemoteEvent
local onCoopWin: (Player, number) -> number
local ropes: Folder

local function members(team: Team): { Player }
	return { team.a, team.b }
end

local function other(team: Team, player: Player): Player
	return if team.a == player then team.b else team.a
end

local function aliveRoot(player: Player): BasePart?
	local character = player.Character
	if not character then
		return nil
	end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart")
	if humanoid and humanoid.Health > 0 and root and root:IsA("BasePart") then
		return root
	end
	return nil
end

-- هل اللاعب واقف فوق هالقطعة؟ (أضمن من Touched/TouchEnded)
local function standingOn(pad: BasePart, player: Player): boolean
	local root = aliveRoot(player)
	if not root then
		return false
	end
	local rel = pad.CFrame:PointToObjectSpace(root.Position)
	return math.abs(rel.X) <= pad.Size.X / 2 + 0.5 and math.abs(rel.Z) <= pad.Size.Z / 2 + 0.5 and rel.Y > 0 and rel.Y < 6
end

local function ropeAttachment(player: Player): Attachment?
	local root = aliveRoot(player)
	if not root then
		return nil
	end
	local existing = root:FindFirstChild("RopeAttachment")
	if existing and existing:IsA("Attachment") then
		return existing
	end
	local attachment = Instance.new("Attachment")
	attachment.Name = "RopeAttachment"
	-- محور الأتاشمنت لتحت عشان الحبل يتدلّى
	attachment.CFrame = CFrame.fromMatrix(Vector3.zero, Vector3.new(0, -1, 0), Vector3.new(1, 0, 0))
	attachment.Parent = root
	return attachment
end

local function updateBeam(team: Team)
	team.beam.Attachment0 = ropeAttachment(team.a)
	team.beam.Attachment1 = ropeAttachment(team.b)
end

local function setTeamAttributes(team: Team)
	for _, player in members(team) do
		player:SetAttribute("Partner", other(team, player).UserId)
		player:SetAttribute("CoopStage", team.stage)
		player:SetAttribute("CoopStart", team.startTime)
		player:SetAttribute("RopeLength", team.length)
	end
end

local function setTeamStage(team: Team, stage: number)
	team.stage = stage
	for _, player in members(team) do
		player:SetAttribute("CoopStage", stage)
	end
end

-- نرجّع الثنين للرسبون (نقطة الحفظ المشتركة) بدون ما نحسبها طيحة
local function respawnTeam(team: Team)
	team.quietUntil = os.clock() + 2
	for _, player in members(team) do
		if player.Parent then
			player:LoadCharacter()
		end
	end
end

local function formTeam(a: Player, b: Player)
	local beam = Instance.new("Beam")
	beam.Name = string.format("Rope_%d_%d", a.UserId, b.UserId)
	beam.Color = ColorSequence.new(Color3.fromRGB(150, 95, 50))
	beam.Width0 = 0.3
	beam.Width1 = 0.3
	beam.FaceCamera = true
	beam.Segments = 12
	beam.LightInfluence = 1
	beam.Parent = ropes

	local team: Team = {
		a = a,
		b = b,
		stage = 1,
		length = CoopConfig.ropeLength,
		publishedLength = CoopConfig.ropeLength,
		reeling = {},
		beam = beam,
		startTime = Workspace:GetServerTimeNow(),
		finished = false,
		quietUntil = 0,
	}
	teams[a] = team
	teams[b] = team
	setTeamAttributes(team)
	for _, player in members(team) do
		notify:FireClient(player, { kind = "coopFormed", partner = other(team, player).DisplayName })
	end
	respawnTeam(team)
end

local function disband(team: Team, reason: string, leaver: Player?)
	if teams[team.a] ~= team and teams[team.b] ~= team then
		return -- انفك من قبل
	end
	team.beam:Destroy()
	for _, player in members(team) do
		teams[player] = nil
		if player ~= leaver and player.Parent then
			player:SetAttribute("Partner", nil)
			player:SetAttribute("CoopStage", nil)
			player:SetAttribute("CoopStart", nil)
			player:SetAttribute("RopeLength", nil)
			notify:FireClient(player, { kind = "coopBroken", text = reason })
			player:LoadCharacter() -- يرجع لمرحلته في الأوبي العادي
		end
	end
end

function Coop.isTeamed(player: Player): boolean
	return teams[player] ~= nil
end

-- مكان الرسبون: نقطة الحفظ المشتركة، وكل واحد على جنب
function Coop.spawnCFrame(player: Player): CFrame?
	local team = teams[player]
	if not team then
		return nil
	end
	local base = if team.stage > CoopConfig.FinalStage then course.finishSpawn else course.checkpoints[team.stage]
	local side = if team.a == player then -2.5 else 2.5
	return base * CFrame.new(side, 0, 0)
end

function Coop.onCharacterAdded(player: Player, character: Model)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if not humanoid or not humanoid:IsA("Humanoid") then
		return
	end
	if character:WaitForChild("HumanoidRootPart", 10) then
		local team = teams[player]
		if team then
			updateBeam(team)
		end
	end

	humanoid.Died:Connect(function()
		local team = teams[player]
		-- نتأكد إنها الشخصية الحالية وإن الموت مو بسبب رسبون مقصود
		if not team or player.Character ~= character or os.clock() < team.quietUntil then
			return
		end
		team.quietUntil = os.clock() + 2
		local partner = other(team, player)
		local partnerCharacter = partner.Character
		local partnerHumanoid = partnerCharacter and partnerCharacter:FindFirstChildOfClass("Humanoid")
		if partnerHumanoid and partnerHumanoid.Health > 0 then
			partnerHumanoid.Health = 0
		end
		notify:FireClient(partner, { kind = "coopFall", name = player.DisplayName })
		notify:FireClient(player, { kind = "coopFall", name = player.DisplayName, self = true })
	end)
end

function Coop.onPlayerRemoving(player: Player)
	local team = teams[player]
	if team then
		disband(team, string.format("✂️ %s طلع من اللعبة، وانفك الحبل", player.DisplayName), player)
	end
end

-- ========== حلقات السيرفر ==========

local pairing: { a: Player?, b: Player?, since: number } = { a = nil, b = nil, since = 0 }

local function pairStep()
	local pads = lobby.pairPads
	local onA: Player? = nil
	local onB: Player? = nil
	for _, player in Players:GetPlayers() do
		if not teams[player] then
			if not onA and standingOn(pads[1], player) then
				onA = player
			elseif not onB and standingOn(pads[2], player) then
				onB = player
			end
		end
	end

	local status = lobby.pairStatus
	if onA and onB and onA ~= onB then
		if pairing.a ~= onA or pairing.b ~= onB then
			pairing.a, pairing.b, pairing.since = onA, onB, os.clock()
		end
		local left = CoopConfig.pairSeconds - (os.clock() - pairing.since)
		if left <= 0 then
			pairing.a, pairing.b = nil, nil
			status.Text = ""
			formTeam(onA, onB)
		else
			status.Text = string.format("🪢 تنربطون بعد %d…", math.ceil(left))
		end
	else
		pairing.a, pairing.b = nil, nil
		if onA or onB then
			status.Text = "🪢 ننتظر خويك يوقف على الدائرة الثانية"
		else
			status.Text = ""
		end
	end
end

local function bridgeStep()
	for _, group in course.bridges do
		local active = false
		for _, plate in group.plates do
			for _, player in Players:GetPlayers() do
				if standingOn(plate, player) then
					active = true
					break
				end
			end
			if active then
				break
			end
		end
		local bridge: BasePart = group.bridge
		if bridge.CanCollide ~= active then
			bridge.CanCollide = active
			bridge.Transparency = if active then 0.1 else 0.85
			for _, plate in group.plates do
				plate.Material = if active then Enum.Material.Neon else Enum.Material.SmoothPlastic
			end
		end
	end
end

local function ropeStep(dt: number)
	local seen: { [Team]: boolean } = {}
	for _, team in teams do
		if not seen[team] then
			seen[team] = true
			local reeling = team.reeling[team.a] or team.reeling[team.b]
			if reeling then
				team.length = math.max(CoopConfig.minRopeLength, team.length - CoopConfig.reelSpeed * dt)
			else
				team.length = math.min(CoopConfig.ropeLength, team.length + CoopConfig.releaseSpeed * dt)
			end
			local atLimit = team.length == CoopConfig.minRopeLength or team.length == CoopConfig.ropeLength
			if math.abs(team.length - team.publishedLength) >= 0.25 or (atLimit and team.length ~= team.publishedLength) then
				team.publishedLength = team.length
				for _, player in members(team) do
					player:SetAttribute("RopeLength", team.length)
				end
			end
		end
	end
end

-- ========== البداية ==========

function Coop.init(options: Options)
	course = options.course
	lobby = options.lobby
	notify = options.notify
	onCoopWin = options.onCoopWin

	ropes = Instance.new("Folder")
	ropes.Name = "Ropes"
	ropes.Parent = Workspace

	local function remote(name: string): RemoteEvent
		local r = Instance.new("RemoteEvent")
		r.Name = name
		r.Parent = options.remotes
		return r
	end
	local reelRemote = remote("CoopReel")
	local leaveRemote = remote("CoopLeave")
	local restartRemote = remote("CoopRestart")

	reelRemote.OnServerEvent:Connect(function(player, holding)
		local team = teams[player]
		if team then
			team.reeling[player] = holding == true
		end
	end)

	leaveRemote.OnServerEvent:Connect(function(player)
		local team = teams[player]
		if team then
			disband(team, string.format("✂️ %s فك الحبل", player.DisplayName))
		end
	end)

	local lastRestart: { [Team]: number } = {}
	restartRemote.OnServerEvent:Connect(function(player)
		local team = teams[player]
		if not team then
			return
		end
		local now = os.clock()
		if lastRestart[team] and now - lastRestart[team] < 2 then
			return
		end
		lastRestart[team] = now
		team.finished = false
		team.startTime = Workspace:GetServerTimeNow()
		team.stage = 1
		setTeamAttributes(team)
		respawnTeam(team)
	end)

	-- نقاط الحفظ المشتركة
	for stage, pad in course.checkpointPads do
		pad.Touched:Connect(function(hit)
			local model = hit:FindFirstAncestorOfClass("Model")
			local player = model and Players:GetPlayerFromCharacter(model)
			local team = player and teams[player]
			if team and not team.finished and stage > team.stage then
				setTeamStage(team, stage)
			end
		end)
	end

	-- النهاية
	course.finishPad.Touched:Connect(function(hit)
		local model = hit:FindFirstAncestorOfClass("Model")
		local player = model and Players:GetPlayerFromCharacter(model)
		local team = player and teams[player]
		if not team or team.finished or team.stage ~= CoopConfig.FinalStage then
			return
		end
		team.finished = true
		setTeamStage(team, CoopConfig.FinishedStage)
		local elapsed = Workspace:GetServerTimeNow() - team.startTime
		for _, member in members(team) do
			local wins = onCoopWin(member, elapsed)
			notify:FireClient(member, {
				kind = "coopWin",
				time = elapsed,
				wins = wins,
				partner = other(team, member).DisplayName,
			})
		end
		local text = string.format(
			"🪢🏆 %s و %s خلّصوا درب الحبل بوقت %s!",
			team.a.DisplayName,
			team.b.DisplayName,
			Format.time(elapsed)
		)
		for _, viewer in Players:GetPlayers() do
			if teams[viewer] ~= team then
				notify:FireClient(viewer, { kind = "message", text = text })
			end
		end
	end)

	local pairTimer = 0
	local bridgeTimer = 0
	RunService.Heartbeat:Connect(function(dt)
		ropeStep(dt)
		pairTimer += dt
		if pairTimer >= 0.25 then
			pairTimer = 0
			pairStep()
		end
		bridgeTimer += dt
		if bridgeTimer >= 0.1 then
			bridgeTimer = 0
			bridgeStep()
		end
	end)

	-- نبدأ الجسور مسكّرة
	bridgeStep()
end

return Coop
