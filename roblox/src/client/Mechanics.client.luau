-- جهة اللاعب: تحريك المنصات، الموت من الحمم، منصات القفز، وحركات كل عالم
-- (الجاذبية الخفيفة، التحكم المعكوس، الكاميرا المقلوبة، والوقت المعكوس)

local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local player = Players.LocalPlayer

-- ========== تتبّع الأشياء المتحركة ==========

local function track(tag: string): { BasePart }
	local list: { BasePart } = {}
	local function add(inst: Instance)
		if inst:IsA("BasePart") and not table.find(list, inst) then
			table.insert(list, inst)
		end
	end
	for _, inst in CollectionService:GetTagged(tag) do
		add(inst)
	end
	CollectionService:GetInstanceAddedSignal(tag):Connect(add)
	CollectionService:GetInstanceRemovedSignal(tag):Connect(function(inst)
		local i = table.find(list, inst :: any)
		if i then
			table.remove(list, i)
		end
	end)
	return list
end

local movers = track("Mover")
local spinners = track("Spinner")
local vanishers = track("Vanish")

local TAU = math.pi * 2

-- نستخدم وقت السيرفر عشان كل اللاعبين يشوفون المنصات بنفس المكان تقريباً
RunService.Stepped:Connect(function()
	local t = Workspace:GetServerTimeNow()

	for _, p in movers do
		local origin = p:GetAttribute("Origin")
		local offset = p:GetAttribute("Offset")
		local period = p:GetAttribute("Period")
		if typeof(origin) == "CFrame" and typeof(offset) == "Vector3" and type(period) == "number" then
			local phase = (t % period) / period * TAU
			local alpha = 0.5 - 0.5 * math.cos(phase)
			p.CFrame = origin + offset * alpha
			-- السرعة تخلي اللاعب يمشي مع المنصة بدل ما يزحلق
			p.AssemblyLinearVelocity = offset * (0.5 * math.sin(phase) * TAU / period)
		end
	end

	for _, p in spinners do
		local center = p:GetAttribute("Center")
		local speed = p:GetAttribute("Speed")
		local phase = p:GetAttribute("Phase") or 0
		if typeof(center) == "CFrame" and type(speed) == "number" then
			p.CFrame = center * CFrame.Angles(0, (t * speed) % TAU + phase, 0)
		end
	end

	for _, p in vanishers do
		local period = p:GetAttribute("Period")
		local offset = p:GetAttribute("Offset") or 0
		local visible = p:GetAttribute("Visible") or 0.7
		if type(period) == "number" then
			local f = ((t + offset) % period) / period
			local shown = f < visible
			local warning = shown and f > visible - 0.15
			p.CanCollide = shown
			p.Transparency = if not shown then 0.85 elseif warning then 0.5 else 0
		end
	end
end)

-- ========== الموت ومنصات القفز ==========

local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Include

local lastLaunch = 0

local function kill(humanoid: Humanoid)
	if humanoid.Health > 0 then
		humanoid.Health = 0
	end
end

local function launch(root: BasePart, humanoid: Humanoid, pad: BasePart)
	local now = os.clock()
	if now - lastLaunch < 0.4 then
		return
	end
	lastLaunch = now
	local height = pad:GetAttribute("LaunchHeight") or 20
	local vy = math.sqrt(2 * Workspace.Gravity * height)
	humanoid:ChangeState(Enum.HumanoidStateType.Freefall)
	local v = root.AssemblyLinearVelocity
	root.AssemblyLinearVelocity = Vector3.new(v.X, vy, v.Z)
end

local function onCharacter(character: Model)
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	local root = character:WaitForChild("HumanoidRootPart") :: BasePart
	overlap.FilterDescendantsInstances = { character }

	humanoid.Touched:Connect(function(other: BasePart)
		if CollectionService:HasTag(other, "Kill") then
			kill(humanoid)
		elseif CollectionService:HasTag(other, "JumpPad") then
			launch(root, humanoid, other)
		end
	end)

	local connection
	connection = RunService.Heartbeat:Connect(function()
		if not character.Parent or humanoid.Health <= 0 then
			connection:Disconnect()
			return
		end
		-- لو طاح تحت المسار
		if root.Position.Y < -5 then
			kill(humanoid)
			return
		end
		-- العصي اللي تدور ما تطلق Touched دايماً، فنفحصها بأنفسنا
		for _, bar in spinners do
			if (bar.Position - root.Position).Magnitude < bar.Size.X then
				if #Workspace:GetPartsInPart(bar, overlap) > 0 then
					kill(humanoid)
					return
				end
			end
		end
	end)
end

player.CharacterAdded:Connect(onCharacter)
if player.Character then
	task.spawn(onCharacter, player.Character)
end

-- ========== حركات العوالم ==========

local controls = nil
task.spawn(function()
	local ok, result = pcall(function()
		local module = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule") :: ModuleScript) :: any
		return module:GetControls()
	end)
	if ok then
		controls = result
	else
		warn("[Obby] ما لقيت التحكم:", result)
	end
end)

local sepia = Instance.new("ColorCorrectionEffect")
sepia.Name = "RewindTint"
sepia.Enabled = false
sepia.Saturation = -0.75
sepia.Contrast = 0.15
sepia.TintColor = Color3.fromRGB(255, 225, 185)
sepia.Parent = Lighting

local baseClock = Lighting.ClockTime
local currentTwist: string? = nil

local function unbind(name: string)
	pcall(function()
		RunService:UnbindFromRenderStep(name)
	end)
end

local function clearTwist()
	Workspace.Gravity = Config.DefaultGravity
	unbind("ObbyInvert")
	unbind("ObbyFlipCamera")
	sepia.Enabled = false
	Lighting.ClockTime = baseClock
end

local function applyTwist(twist: string)
	if twist == currentTwist then
		return
	end
	clearTwist()
	currentTwist = twist

	if twist == "lowGravity" then
		Workspace.Gravity = Config.LowGravity
		Lighting.ClockTime = 0 -- ليل عشان القمر
	elseif twist == "invert" then
		-- نشتغل بعد سكربت التحكم ونعكس اتجاه المشي
		RunService:BindToRenderStep("ObbyInvert", Enum.RenderPriority.Input.Value + 1, function()
			local character = player.Character
			local humanoid = character and character:FindFirstChildOfClass("Humanoid")
			if humanoid and controls then
				local move: Vector3 = controls:GetMoveVector()
				if move.Magnitude > 0 then
					humanoid:Move(-move, true)
				end
			end
		end)
	elseif twist == "flipCamera" then
		-- نلف الكاميرا 180 درجة بعد ما تتحدّث
		RunService:BindToRenderStep("ObbyFlipCamera", Enum.RenderPriority.Camera.Value + 1, function()
			local camera = Workspace.CurrentCamera
			if camera then
				camera.CFrame = camera.CFrame * CFrame.Angles(0, 0, math.pi)
			end
		end)
	elseif twist == "rewind" then
		sepia.Enabled = true
	end
end

local function refresh()
	local stage = player:GetAttribute("Stage") or 1
	local worldIndex = Config.worldIndexForStage(stage)
	local world = worldIndex and Config.Worlds[worldIndex]
	applyTwist(if world then world.twist else "none")
end

player:GetAttributeChangedSignal("Stage"):Connect(refresh)
refresh()

-- ========== تلوين نقاط الحفظ اللي وصلتها ==========

local REACHED = Color3.fromRGB(90, 255, 130)
local NOT_REACHED = Color3.fromRGB(235, 235, 235)

local function colorCheckpoint(pad: Instance)
	if not pad:IsA("BasePart") then
		return
	end
	local stage = player:GetAttribute("Stage") or 1
	local padStage = pad:GetAttribute("Stage") or 0
	pad.Color = if padStage <= stage then REACHED else NOT_REACHED
end

local function colorAll()
	for _, pad in CollectionService:GetTagged("Checkpoint") do
		colorCheckpoint(pad)
	end
end

CollectionService:GetInstanceAddedSignal("Checkpoint"):Connect(colorCheckpoint)
player:GetAttributeChangedSignal("Stage"):Connect(colorAll)
colorAll()
