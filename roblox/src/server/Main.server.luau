-- السيرفر: يبني الأوبي، يتابع نقاط الحفظ والفوز، ويحفظ التقدّم

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local StarterPlayer = game:GetService("StarterPlayer")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Format = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Format"))
local CourseBuilder = require(script.Parent:WaitForChild("CourseBuilder"))
local Data = require(script.Parent:WaitForChild("Data"))

-- إعدادات عامة
StarterPlayer.CharacterUseJumpPower = true
StarterPlayer.CharacterJumpPower = Config.JumpPower
Workspace.Gravity = Config.DefaultGravity
Lighting.ClockTime = 14
Lighting.Brightness = 2
Lighting.OutdoorAmbient = Color3.fromRGB(150, 150, 170)
if not Lighting:FindFirstChildOfClass("Atmosphere") then
	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Density = 0.3
	atmosphere.Haze = 1
	atmosphere.Color = Color3.fromRGB(200, 215, 255)
	atmosphere.Parent = Lighting
end

local course = CourseBuilder.build()

-- قنوات التواصل مع الكلاينت
local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
local restartRemote = Instance.new("RemoteEvent")
restartRemote.Name = "Restart"
restartRemote.Parent = remotes
local notifyRemote = Instance.new("RemoteEvent")
notifyRemote.Name = "Notify"
notifyRemote.Parent = remotes
remotes.Parent = ReplicatedStorage

local profiles: { [Player]: Data.Profile } = {}

-- أسماء الأعمدة في لوحة اللاعبين
local STAGE_STAT = "المرحلة"
local WINS_STAT = "الفوز"

local function stageText(stage: number): string
	return if stage >= Config.FinishedStage then "🏆" else tostring(stage)
end

local function setStage(player: Player, stage: number)
	local profile = profiles[player]
	if not profile then
		return
	end
	profile.stage = stage
	player:SetAttribute("Stage", stage)
	local stats = player:FindFirstChild("leaderstats")
	local value = stats and stats:FindFirstChild(STAGE_STAT)
	if value and value:IsA("StringValue") then
		value.Value = stageText(stage)
	end
end

local function startRun(player: Player, fullRun: boolean)
	player:SetAttribute("RunStart", Workspace:GetServerTimeNow())
	player:SetAttribute("FullRun", fullRun)
end

local function playerFromHit(hit: BasePart): Player?
	local model = hit:FindFirstAncestorOfClass("Model")
	if not model or not model:FindFirstChildOfClass("Humanoid") then
		return nil
	end
	return Players:GetPlayerFromCharacter(model)
end

local function spawnCFrame(stage: number): CFrame?
	if stage >= Config.FinishedStage then
		return course.finishSpawn
	elseif stage > 1 then
		return course.checkpoints[stage]
	end
	return nil -- المرحلة الأولى: يطلع من اللوبي
end

local function onCharacterAdded(player: Player, character: Model)
	local humanoid = character:WaitForChild("Humanoid", 10)
	if humanoid and humanoid:IsA("Humanoid") then
		humanoid.UseJumpPower = true
		humanoid.JumpPower = Config.JumpPower
	end
	local profile = profiles[player]
	local cf = spawnCFrame(if profile then profile.stage else 1)
	if cf and character:WaitForChild("HumanoidRootPart", 10) then
		task.wait() -- نخلي الشخصية تكمّل تحميل قبل النقل
		character:PivotTo(cf)
	end
end

local function onPlayerAdded(player: Player)
	local profile = Data.load(player.UserId)
	if not player.Parent then
		return -- طلع قبل ما نخلص
	end
	profiles[player] = profile

	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local stageValue = Instance.new("StringValue")
	stageValue.Name = STAGE_STAT
	stageValue.Parent = stats
	local winsValue = Instance.new("IntValue")
	winsValue.Name = WINS_STAT
	winsValue.Value = profile.wins
	winsValue.Parent = stats
	stats.Parent = player

	player:SetAttribute("Wins", profile.wins)
	player:SetAttribute("BestTime", profile.best)
	setStage(player, profile.stage)
	startRun(player, profile.stage == 1)

	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	if player.Character then
		task.spawn(onCharacterAdded, player, player.Character)
	end
end

local function onPlayerRemoving(player: Player)
	local profile = profiles[player]
	if profile then
		Data.save(player.UserId, profile)
		profiles[player] = nil
	end
end

-- نقاط الحفظ
for stage, pad in course.checkpointPads do
	pad.Touched:Connect(function(hit)
		local player = playerFromHit(hit)
		local profile = player and profiles[player]
		if not player or not profile then
			return
		end
		-- نسمح بس بالتقدّم، ما نرجّعه لورا
		if stage > profile.stage and profile.stage < Config.FinishedStage then
			setStage(player, stage)
		end
	end)
end

-- النهاية
course.finishPad.Touched:Connect(function(hit)
	local player = playerFromHit(hit)
	local profile = player and profiles[player]
	if not player or not profile or profile.stage ~= Config.FinalStage then
		return
	end
	local elapsed = Workspace:GetServerTimeNow() - (player:GetAttribute("RunStart") or Workspace:GetServerTimeNow())
	local fullRun = player:GetAttribute("FullRun") == true
	local newBest = false
	if fullRun and (profile.best == nil or elapsed < profile.best) then
		profile.best = elapsed
		newBest = true
		player:SetAttribute("BestTime", elapsed)
	end
	profile.wins += 1
	player:SetAttribute("Wins", profile.wins)
	local stats = player:FindFirstChild("leaderstats")
	local winsValue = stats and stats:FindFirstChild(WINS_STAT)
	if winsValue and winsValue:IsA("IntValue") then
		winsValue.Value = profile.wins
	end
	setStage(player, Config.FinishedStage)

	notifyRemote:FireClient(player, {
		kind = "win",
		time = elapsed,
		fullRun = fullRun,
		best = profile.best,
		newBest = newBest,
		wins = profile.wins,
	})
	local text = if fullRun
		then string.format("🏆 %s خلّص أوبي المقلوب بوقت %s!", player.DisplayName, Format.time(elapsed))
		else string.format("🏆 %s خلّص أوبي المقلوب!", player.DisplayName)
	for _, other in Players:GetPlayers() do
		if other ~= player then
			notifyRemote:FireClient(other, { kind = "message", text = text })
		end
	end
end)

-- ابدأ من جديد
local lastRestart: { [Player]: number } = {}
restartRemote.OnServerEvent:Connect(function(player)
	if not profiles[player] then
		return
	end
	local now = os.clock()
	if lastRestart[player] and now - lastRestart[player] < 2 then
		return
	end
	lastRestart[player] = now
	setStage(player, 1)
	startRun(player, true)
	player:LoadCharacter()
end)

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(function(player)
	onPlayerRemoving(player)
	lastRestart[player] = nil
end)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

-- حفظ تلقائي
task.spawn(function()
	while true do
		task.wait(Config.AutosaveSeconds)
		for player, profile in profiles do
			Data.save(player.UserId, profile)
		end
	end
end)

game:BindToClose(function()
	for player, profile in profiles do
		Data.save(player.UserId, profile)
	end
end)
