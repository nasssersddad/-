-- مهمة أول 3 دقايق عند اللاعب: نص الخطوة تحت، وسهم من اللاعب للهدف، وزر تخطّي.
-- وعدّاد حماية المبتدئ. كله عرض بس: الخطوة من Attribute "TutorialStep" اللي يحطه السيرفر.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local OnboardingConfig = require(Shared:WaitForChild("OnboardingConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local STEPS = OnboardingConfig.Steps
local DONE = #STEPS + 1
local YELLOW = Color3.fromRGB(255, 215, 60)

-- ===== الواجهة =====

local gui = Instance.new("ScreenGui")
gui.Name = "OnboardingHud"
gui.ResetOnSpawn = false
gui.DisplayOrder = 3
gui.Parent = player:WaitForChild("PlayerGui")

-- بطاقة الخطوة: تحت في النص (بين عصا الجوال والأزرار)
local card = Instance.new("Frame")
card.Name = "Step"
card.AnchorPoint = Vector2.new(0.5, 1)
card.Position = UDim2.new(0.5, 0, 1, -20)
card.Size = UDim2.new(0.46, 0, 0, 52)
card.BackgroundColor3 = Color3.fromRGB(25, 20, 18)
card.BackgroundTransparency = 0.15
card.Visible = false
card.Parent = gui
local cardLimit = Instance.new("UISizeConstraint")
cardLimit.MaxSize = Vector2.new(460, 52)
cardLimit.MinSize = Vector2.new(250, 44)
cardLimit.Parent = card
local cardCorner = Instance.new("UICorner")
cardCorner.CornerRadius = UDim.new(0, 12)
cardCorner.Parent = card
local cardStroke = Instance.new("UIStroke")
cardStroke.Color = YELLOW
cardStroke.Thickness = 2
cardStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
cardStroke.Parent = card

local stepText = Instance.new("TextLabel")
stepText.BackgroundTransparency = 1
stepText.Position = UDim2.new(0, 70, 0, 4)
stepText.Size = UDim2.new(1, -80, 1, -8)
stepText.TextScaled = true
stepText.Font = Enum.Font.GothamBlack
stepText.TextColor3 = Color3.new(1, 1, 1)
stepText.TextXAlignment = Enum.TextXAlignment.Right
stepText.Parent = card
local textLimit = Instance.new("UITextSizeConstraint")
textLimit.MaxTextSize = 24
textLimit.Parent = stepText

local skip = Instance.new("TextButton")
skip.Name = "Skip"
skip.Position = UDim2.fromOffset(6, 6)
skip.Size = UDim2.new(0, 58, 1, -12)
skip.BackgroundColor3 = Color3.fromRGB(90, 90, 90)
skip.Text = "تخطّي"
skip.TextScaled = true
skip.Font = Enum.Font.GothamBold
skip.TextColor3 = Color3.new(1, 1, 1)
skip.Parent = card
local skipCorner = Instance.new("UICorner")
skipCorner.CornerRadius = UDim.new(0, 8)
skipCorner.Parent = skip
skip.Activated:Connect(function()
	Remotes:WaitForChild("TutorialSkip"):FireServer()
end)

-- عدّاد حماية المبتدئ
local shield = Instance.new("TextLabel")
shield.Name = "Shield"
shield.AnchorPoint = Vector2.new(0.5, 0)
shield.Position = UDim2.new(0.5, 0, 0, 112)
shield.Size = UDim2.fromOffset(230, 24)
shield.BackgroundColor3 = Color3.fromRGB(40, 140, 80)
shield.BackgroundTransparency = 0.2
shield.TextScaled = true
shield.Font = Enum.Font.GothamBold
shield.TextColor3 = Color3.new(1, 1, 1)
shield.Visible = false
shield.Parent = gui
local shieldCorner = Instance.new("UICorner")
shieldCorner.CornerRadius = UDim.new(0, 10)
shieldCorner.Parent = shield

-- ===== السهم =====

local beamFolder = Instance.new("Folder")
beamFolder.Name = "TutorialArrow"
beamFolder.Parent = Workspace

local targetPart = Instance.new("Part")
targetPart.Name = "Target"
targetPart.Anchored = true
targetPart.CanCollide = false
targetPart.CanQuery = false
targetPart.CanTouch = false
targetPart.Transparency = 1
targetPart.Size = Vector3.one
targetPart.Parent = beamFolder
local targetAttachment = Instance.new("Attachment")
targetAttachment.Parent = targetPart

local marker = Instance.new("BillboardGui")
marker.Size = UDim2.fromOffset(48, 48)
marker.AlwaysOnTop = true
marker.StudsOffsetWorldSpace = Vector3.new(0, 6, 0)
marker.Adornee = targetPart
marker.Enabled = false
marker.Parent = targetPart
local markerText = Instance.new("TextLabel")
markerText.Size = UDim2.fromScale(1, 1)
markerText.BackgroundTransparency = 1
markerText.Text = "⬇️"
markerText.TextScaled = true
markerText.Parent = marker
TweenService:Create(marker, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { StudsOffsetWorldSpace = Vector3.new(0, 8, 0) }):Play()

local beam = Instance.new("Beam")
beam.Attachment1 = targetAttachment
beam.Color = ColorSequence.new(YELLOW)
beam.Width0 = 0.6
beam.Width1 = 0.6
beam.FaceCamera = true
beam.LightEmission = 0.6
beam.Transparency = NumberSequence.new(0.2)
beam.Texture = "rbxasset://textures/particles/sparkles_main.dds"
beam.TextureMode = Enum.TextureMode.Wrap
beam.TextureLength = 3
beam.TextureSpeed = 2
beam.Enabled = false
beam.Parent = beamFolder

local function findHook(rarity: string): Model?
	local best, bestD
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	for _, m in Workspace:GetDescendants() do
		if m:IsA("Model") and m:GetAttribute("HabaliId") and m:GetAttribute("Rarity") == rarity and m.PrimaryPart then
			local mine = m:GetAttribute("HookFor") == player.UserId
			local d = if root then (m.PrimaryPart.Position - root.Position).Magnitude else 0
			if mine then
				return m
			end
			if not bestD or d < bestD then
				best, bestD = m, d
			end
		end
	end
	return best
end

local function myPlot(): Model?
	local plots = Workspace:FindFirstChild("Map") and Workspace.Map:FindFirstChild("Plots")
	if not plots then
		return nil
	end
	for _, plot in plots:GetChildren() do
		if plot:GetAttribute("OwnerUserId") == player.UserId then
			return plot :: Model
		end
	end
	return nil
end

local function myCar(): Model?
	local cars = Workspace:FindFirstChild("Cars")
	if cars then
		for _, car in cars:GetChildren() do
			if car:GetAttribute("OwnerUserId") == player.UserId then
				return car :: Model
			end
		end
	end
	return nil
end

-- وين يأشر السهم في كل خطوة
local function targetFor(step: number): Vector3?
	local id = STEPS[step] and STEPS[step].Id
	if id == "Stun" or id == "Grab" then
		local hook = findHook("Common")
		return hook and hook.PrimaryPart and hook.PrimaryPart.Position
	elseif id == "Load" then
		local car = myCar()
		local bed = car and car:FindFirstChild("Bed") :: BasePart?
		return bed and bed.Position
	elseif id == "Unload" then
		local plot = myPlot()
		local drop = plot and plot:FindFirstChild("DropZone") :: BasePart?
		return drop and drop.Position
	elseif id == "Collect" then
		local plot = myPlot()
		local pad = plot and plot:FindFirstChild("CollectPad", true) :: BasePart?
		return pad and pad.Position
	elseif step == DONE then
		local rare = findHook("Rare")
		return rare and rare.PrimaryPart and rare.PrimaryPart.Position
	end
	return nil
end

local doneUntil = 0
player:GetAttributeChangedSignal("TutorialStep"):Connect(function()
	if player:GetAttribute("TutorialStep") == DONE and card.Visible then
		doneUntil = os.clock() + 25 -- نأشر على النادر شوي بعد ما يخلص
	end
end)

task.spawn(function()
	while true do
		task.wait(0.2)
		local step = player:GetAttribute("TutorialStep")
		local active = type(step) == "number" and step < DONE
		local showDone = step == DONE and os.clock() < doneUntil
		card.Visible = active or showDone
		skip.Visible = active
		if active then
			stepText.Text = string.format("%d/%d  %s", step, #STEPS, STEPS[step].Text)
		elseif showDone then
			stepText.Text = OnboardingConfig.DoneText
		end
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
		local target = if (active or showDone) and type(step) == "number" then targetFor(step) else nil
		if root and target then
			local origin = root:FindFirstChild("TutorialOrigin") :: Attachment?
			if not origin then
				local made = Instance.new("Attachment")
				made.Name = "TutorialOrigin"
				made.Position = Vector3.new(0, -2, 0)
				made.Parent = root
				origin = made
			end
			beam.Attachment0 = origin
			targetPart.Position = target
			beam.Enabled = (target - root.Position).Magnitude > 8
			marker.Enabled = true
		else
			beam.Enabled = false
			marker.Enabled = false
		end
		-- الحماية
		local left = player:GetAttribute("NewbieLeft")
		shield.Visible = type(left) == "number" and left > 0
		if shield.Visible then
			shield.Text = string.format("🛡️ محمي: باقي %d دقيقة", math.ceil(left / 60))
		end
	end
end)
