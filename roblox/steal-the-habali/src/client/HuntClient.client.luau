-- أزرار الصيد للاعب: عقال، تنويم، فلّته، سيارتي. تشتغل باللمس والكيبورد والجويستك.
-- الجوال يرسل "ضربت" أو "طلقت لهالاتجاه" بس، والسيرفر هو اللي يقرر.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Debris = game:GetService("Debris")
local Lighting = game:GetService("Lighting")

local CatchConfig = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("CatchConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local function remote(name: string): RemoteEvent
	return Remotes:WaitForChild(name) :: RemoteEvent
end

-- ===== الواجهة =====

local gui = Instance.new("ScreenGui")
gui.Name = "HuntHud"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = false
gui.Parent = player:WaitForChild("PlayerGui")

local function makeButton(name: string, text: string, key: string, position: UDim2, color: Color3): TextButton
	local button = Instance.new("TextButton")
	button.Name = name
	button.AnchorPoint = Vector2.new(1, 1)
	button.Position = position
	button.Size = UDim2.fromOffset(84, 84)
	button.BackgroundColor3 = color
	button.BackgroundTransparency = 0.15
	button.Text = text
	button.TextScaled = true
	button.Font = Enum.Font.GothamBlack
	button.TextColor3 = Color3.new(1, 1, 1)
	button.TextStrokeTransparency = 0.4
	button.AutoButtonColor = true
	button.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = button
	local padding = Instance.new("UIPadding")
	padding.PaddingLeft = UDim.new(0.14, 0)
	padding.PaddingRight = UDim.new(0.14, 0)
	padding.PaddingTop = UDim.new(0.22, 0)
	padding.PaddingBottom = UDim.new(0.22, 0)
	padding.Parent = button
	-- حرف الزر للكيبورد (يختفي في الجوال)
	local hint = Instance.new("TextLabel")
	hint.Name = "Key"
	hint.AnchorPoint = Vector2.new(0.5, 0)
	hint.Position = UDim2.new(0.5, 0, 1, 2)
	hint.Size = UDim2.fromOffset(28, 18)
	hint.BackgroundTransparency = 1
	hint.Text = key
	hint.TextScaled = true
	hint.Font = Enum.Font.GothamBold
	hint.TextColor3 = Color3.new(1, 1, 1)
	hint.TextStrokeTransparency = 0.3
	hint.Visible = not UserInputService.TouchEnabled
	hint.Parent = button
	return button
end

-- فوق زر النط حق الجوال، على اليمين تحت
local swingButton = makeButton("Swing", CatchConfig.Melee.Name, "F", UDim2.new(1, -120, 1, -150), Color3.fromRGB(200, 90, 50))
local shootButton = makeButton("Shoot", "تنويم", "R", UDim2.new(1, -24, 1, -190), Color3.fromRGB(70, 120, 220))
local releaseButton = makeButton("Release", "فلّته", "X", UDim2.new(1, -216, 1, -110), Color3.fromRGB(120, 120, 120))
releaseButton.Visible = false
local carButton = makeButton("Car", "سيارتي", "C", UDim2.new(1, -16, 0, 150), Color3.fromRGB(60, 160, 90))
carButton.AnchorPoint = Vector2.new(1, 0)
carButton.Size = UDim2.fromOffset(96, 52)
local carCorner = carButton:FindFirstChildOfClass("UICorner")
if carCorner then
	carCorner.CornerRadius = UDim.new(0.3, 0)
end

-- رسالة فوق في النص
local toast = Instance.new("TextLabel")
toast.Name = "Toast"
toast.AnchorPoint = Vector2.new(0.5, 0)
toast.Position = UDim2.fromScale(0.5, 0.14)
toast.Size = UDim2.new(0.8, 0, 0, 44)
toast.BackgroundColor3 = Color3.fromRGB(30, 22, 18)
toast.BackgroundTransparency = 1
toast.TextTransparency = 1
toast.TextScaled = true
toast.Font = Enum.Font.GothamBlack
toast.TextColor3 = Color3.fromRGB(255, 245, 225)
toast.Parent = gui
local toastConstraint = Instance.new("UISizeConstraint")
toastConstraint.MaxSize = Vector2.new(620, 44)
toastConstraint.Parent = toast
local toastCorner = Instance.new("UICorner")
toastCorner.CornerRadius = UDim.new(0.3, 0)
toastCorner.Parent = toast

local toastToken = 0
local function showToast(text: string)
	toastToken += 1
	local token = toastToken
	toast.Text = text
	toast.TextTransparency = 0
	toast.BackgroundTransparency = 0.3
	task.delay(2.6, function()
		if token == toastToken then
			TweenService:Create(toast, TweenInfo.new(0.4), { TextTransparency = 1, BackgroundTransparency = 1 }):Play()
		end
	end)
end

-- ===== الأفعال =====

local shootReadyAt = 0

local function swing()
	remote("Swing"):FireServer()
	-- هزة صغيرة للزر عشان تحس بالضربة
	swingButton.Rotation = -12
	task.delay(0.08, function()
		swingButton.Rotation = 0
	end)
end

local function shoot()
	local now = os.clock()
	if now < shootReadyAt then
		return
	end
	local character = player.Character
	local head = character and character:FindFirstChild("Head") :: BasePart?
	local camera = Workspace.CurrentCamera
	if not head or not camera then
		return
	end
	-- نصوّب على اللي في نص الشاشة
	local target = camera.CFrame.Position + camera.CFrame.LookVector * CatchConfig.Gun.Range
	local aim = target - head.Position
	if aim.Magnitude < 0.01 then
		return
	end
	shootReadyAt = now + CatchConfig.Gun.Cooldown
	remote("Shoot"):FireServer(aim.Unit)
	shootButton.BackgroundTransparency = 0.6
	task.delay(CatchConfig.Gun.Cooldown, function()
		shootButton.BackgroundTransparency = 0.15
	end)
end

local function release()
	remote("Release"):FireServer()
end

local function spawnCar()
	remote("SpawnCar"):FireServer()
end

swingButton.Activated:Connect(swing)
shootButton.Activated:Connect(shoot)
releaseButton.Activated:Connect(release)
carButton.Activated:Connect(spawnCar)

local KEYS: { [Enum.KeyCode]: () -> () } = {
	[Enum.KeyCode.F] = swing,
	[Enum.KeyCode.ButtonX] = swing,
	[Enum.KeyCode.R] = shoot,
	[Enum.KeyCode.ButtonY] = shoot,
	[Enum.KeyCode.X] = release,
	[Enum.KeyCode.ButtonB] = release,
	[Enum.KeyCode.C] = spawnCar,
	[Enum.KeyCode.DPadUp] = spawnCar,
}
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	local action = KEYS[input.KeyCode]
	if action then
		action()
	end
end)

-- ===== زر "حطه في السيارة": يطلع بس لصاحب السيارة وهو ساحب هبالي =====

local function refreshLoadPrompts()
	local cars = Workspace:FindFirstChild("Cars")
	local isDragging = player:GetAttribute("Dragging") ~= nil
	releaseButton.Visible = isDragging
	-- اللي شايل مسروق فوق راسه يحطه في سيارته بنفس الزر
	isDragging = isDragging or player:GetAttribute("Carrying") ~= nil
	if not cars then
		return
	end
	for _, car in cars:GetChildren() do
		local bed = car:FindFirstChild("Bed")
		local prompt = bed and bed:FindFirstChild("LoadPrompt") :: ProximityPrompt?
		if prompt then
			prompt.Enabled = isDragging and car:GetAttribute("OwnerUserId") == player.UserId
		end
	end
end
player:GetAttributeChangedSignal("Dragging"):Connect(refreshLoadPrompts)
player:GetAttributeChangedSignal("Carrying"):Connect(refreshLoadPrompts)
task.spawn(function()
	while true do
		refreshLoadPrompts() -- السيارة ممكن تتحمل متأخر في الجوال
		task.wait(1)
	end
end)

-- ===== المؤثرات =====

local messages = remote("Notify")
messages.OnClientEvent:Connect(function(text)
	if type(text) == "string" then
		showToast(text)
	end
end)

-- خط الطلقة
remote("Shot").OnClientEvent:Connect(function(from, to)
	if typeof(from) ~= "Vector3" or typeof(to) ~= "Vector3" then
		return
	end
	local length = (to - from).Magnitude
	if length < 0.5 then
		return
	end
	local tracer = Instance.new("Part")
	tracer.Anchored = true
	tracer.CanCollide = false
	tracer.CanQuery = false
	tracer.CanTouch = false
	tracer.CastShadow = false
	tracer.Material = Enum.Material.Neon
	tracer.Color = Color3.fromRGB(140, 220, 255)
	tracer.Size = Vector3.new(0.25, 0.25, length)
	tracer.CFrame = CFrame.lookAt(from, to) * CFrame.new(0, 0, -length / 2)
	tracer.Parent = Workspace
	TweenService:Create(tracer, TweenInfo.new(0.25), { Transparency = 1 }):Play()
	Debris:AddItem(tracer, 0.3)
end)

-- لحظة المقاومة: نطحة، والكاميرا تقرّب، والألوان تبهت شوي (slow-mo)
local busy = false
remote("Moment").OnClientEvent:Connect(function(focus, push)
	if typeof(focus) ~= "Vector3" or typeof(push) ~= "Vector3" or push.Magnitude > 200 then
		return
	end
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if root and humanoid then
		humanoid:ChangeState(Enum.HumanoidStateType.FallingDown)
		root.AssemblyLinearVelocity = push
	end
	local camera = Workspace.CurrentCamera
	if busy or not camera then
		return
	end
	busy = true
	local fov = camera.FieldOfView
	local grade = Instance.new("ColorCorrectionEffect")
	grade.Name = "HuntMoment"
	grade.Parent = Lighting
	TweenService:Create(camera, TweenInfo.new(0.15, Enum.EasingStyle.Quad), { FieldOfView = fov * 0.62 }):Play()
	TweenService:Create(grade, TweenInfo.new(0.15), { Saturation = -0.5, Contrast = 0.15 }):Play()
	task.wait(0.9)
	TweenService:Create(camera, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { FieldOfView = fov }):Play()
	local fade = TweenService:Create(grade, TweenInfo.new(0.35), { Saturation = 0, Contrast = 0 })
	fade:Play()
	fade.Completed:Wait()
	grade:Destroy()
	busy = false
end)
