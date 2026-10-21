-- الإحساس والأصوات عند اللاعب: لمعة الضربة، والنجوم، وغبار السحب، واحتفال الصيدة،
-- وصوت المحرك والهرن. كلها زينة بس، والسيرفر ما يعتمد على شي منها.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local FxConfig = require(Shared:WaitForChild("FxConfig"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local STAR = "rbxasset://textures/particles/sparkles_main.dds"
local SMOKE = "rbxasset://textures/particles/smoke_main.dds"

local characterNames: { [string]: string } = {}
for _, c in HabaliConfig.Characters do
	characterNames[c.Id] = c.DisplayName
end
local rarityNames: { [string]: string } = {}
for _, zone in MapConfig.Zones do
	rarityNames[zone.Id] = zone.Rarity
end
local variantInfo: { [string]: any } = {}
for _, v in HabaliConfig.Variants do
	variantInfo[v.Id] = v
end

local function rgb(values: { number }): Color3
	return Color3.fromRGB(values[1], values[2], values[3])
end

-- ===== الأصوات =====

local function newSound(name: string, parent: Instance): Sound
	local spec = FxConfig.Sounds[name]
	local sound = Instance.new("Sound")
	sound.Name = "Fx" .. name
	sound.SoundId = "rbxassetid://" .. spec.Id
	sound.Volume = spec.Volume
	sound.PlaybackSpeed = spec.Pitch or 1
	sound.RollOffMode = Enum.RollOffMode.InverseTapered
	sound.RollOffMinDistance = 12
	sound.RollOffMaxDistance = FxConfig.Radius
	sound.Parent = parent
	return sound
end

-- صوت مرة وحدة على قطعة (ينمسح لما يخلص). نفس الصوت ما يتكرر بسرعة
local lastPlayed: { [string]: number } = {}
local function play(name: string, parent: Instance?, pitchJitter: number?)
	local now = os.clock()
	if lastPlayed[name] and now - lastPlayed[name] < FxConfig.SoundGap then
		return
	end
	lastPlayed[name] = now
	local sound = newSound(name, parent or Workspace)
	if pitchJitter then
		sound.PlaybackSpeed *= 1 + (math.random() * 2 - 1) * pitchJitter
	end
	sound:Play()
	sound.Ended:Once(function()
		sound:Destroy()
	end)
	Debris:AddItem(sound, 8)
end

-- ===== هزة الكاميرا =====

local shakeUntil, shakeStrength = 0, 0
local function shake(strength: number)
	shakeStrength = math.max(shakeStrength, strength)
	shakeUntil = os.clock() + FxConfig.Shake.Duration
end
RunService:BindToRenderStep("HuntShake", Enum.RenderPriority.Camera.Value + 2, function()
	local now = os.clock()
	if now >= shakeUntil then
		shakeStrength = 0
		return
	end
	local camera = Workspace.CurrentCamera
	local fade = (shakeUntil - now) / FxConfig.Shake.Duration
	local s = shakeStrength * fade
	camera.CFrame *= CFrame.new((math.random() - 0.5) * s, (math.random() - 0.5) * s, 0)
end)

-- ===== جزيئات =====

local function burst(parent: BasePart, color: Color3, count: number, speed: number, texture: string?)
	local emitter = Instance.new("ParticleEmitter")
	emitter.Texture = texture or STAR
	emitter.Color = ColorSequence.new(color)
	emitter.LightEmission = 0.6
	emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.2), NumberSequenceKeypoint.new(1, 0) })
	emitter.Lifetime = NumberRange.new(0.4, 0.8)
	emitter.Speed = NumberRange.new(speed * 0.6, speed)
	emitter.SpreadAngle = Vector2.new(180, 180)
	emitter.Rate = 0
	emitter.Parent = parent
	emitter:Emit(count)
	Debris:AddItem(emitter, 1.2)
end

-- ===== الضربة =====

local function swingArm(character: Model)
	if not character or not character.Parent then
		return
	end
	local upper = character:FindFirstChild("RightUpperArm")
	local shoulder: any = (upper and upper:FindFirstChild("RightShoulder"))
		or (character:FindFirstChild("Torso") and character.Torso:FindFirstChild("Right Shoulder"))
	-- المفصل ممكن يكون Motor6D (القديم) أو AnimationConstraint (الجديد، C0 فيه للقراءة بس).
	-- الاثنين فيهم Transform، فنضيف عليه دوران كل فريم بعد الأنيميشن
	if shoulder and (shoulder:IsA("Motor6D") or shoulder:IsA("AnimationConstraint")) and not shoulder:GetAttribute("Swinging") then
		shoulder:SetAttribute("Swinging", true)
		local start = os.clock()
		local duration = 0.26
		local lastBase, lastApplied = shoulder.Transform, nil
		local connection
		connection = RunService.RenderStepped:Connect(function()
			local t = (os.clock() - start) / duration
			-- لو الأنيميشن ما غيّر المفصل، نرجع للأصل عشان الدوران ما يتراكم
			local base = if lastApplied and shoulder.Transform == lastApplied then lastBase else shoulder.Transform
			if t >= 1 or not shoulder.Parent then
				shoulder.Transform = base
				shoulder:SetAttribute("Swinging", nil)
				connection:Disconnect()
				return
			end
			-- يرفع بسرعة وينزل أبطأ
			local amount = if t < 0.3 then t / 0.3 else 1 - (t - 0.3) / 0.7
			local applied = base * CFrame.Angles(math.rad(150) * amount, 0, 0)
			shoulder.Transform = applied
			lastBase, lastApplied = base, applied
		end)
	end
	local hand = character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm")
	play("Swing", hand, 0.1)
end

local function flash(model: Model)
	local highlight = Instance.new("Highlight")
	highlight.FillColor = Color3.new(1, 1, 1)
	highlight.FillTransparency = 0.15
	highlight.OutlineTransparency = 1
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded
	highlight.Parent = model
	TweenService:Create(highlight, TweenInfo.new(0.18), { FillTransparency = 1 }):Play()
	Debris:AddItem(highlight, 0.2)
end

local function onHit(model: Model, stunned: boolean, kind: string, byUserId: number)
	if typeof(model) ~= "Instance" or not model:IsA("Model") or not model.Parent then
		return
	end
	local hitbox = model:FindFirstChild("Hitbox") :: BasePart?
	if not hitbox then
		return
	end
	flash(model)
	burst(hitbox, Color3.fromRGB(255, 235, 120), if stunned then 22 else 10, if stunned then 18 else 12)
	play(if stunned then "Stun" else "Hit", hitbox, 0.12)
	if byUserId == player.UserId then
		shake(if stunned then FxConfig.Shake.Stun else FxConfig.Shake.Hit)
	end
end

-- ===== الدوخة: نجوم تلف (عقال) أو Zzz (تنويم) =====

local stunFx: { [Model]: { Instance } } = {}

local function clearStun(model: Model)
	local list = stunFx[model]
	stunFx[model] = nil
	if list then
		for _, instance in list do
			instance:Destroy()
		end
	end
end

local function showStun(model: Model)
	if stunFx[model] then
		return
	end
	local root = model.PrimaryPart
	if not root then
		return
	end
	local sleepy = model:GetAttribute("StunKind") == "Gun"
	local gui = Instance.new("BillboardGui")
	gui.Name = "StunFx"
	gui.Size = UDim2.fromOffset(90, 40)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 7.5, 0)
	gui.MaxDistance = 140
	gui.LightInfluence = 0
	gui.Adornee = root
	gui.Parent = root
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.Font = Enum.Font.GothamBlack
	label.Text = if sleepy then "Z z z" else "⭐ 💫 ⭐"
	label.TextColor3 = if sleepy then Color3.fromRGB(170, 220, 255) else Color3.fromRGB(255, 230, 90)
	label.TextStrokeTransparency = 0.3
	label.Parent = gui
	-- تتمايل يمين ويسار عشان تحس إنها تلف
	local swayIn = TweenService:Create(gui, TweenInfo.new(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
		StudsOffsetWorldSpace = Vector3.new(0, 8.3, 0),
	})
	swayIn:Play()
	label.Rotation = -8
	TweenService:Create(label, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Rotation = 8 }):Play()
	stunFx[model] = { gui }
end

-- ===== السحب: غبار وصوت =====

local dragFx: { [Model]: { Emitter: ParticleEmitter, Sound: Sound, Hitbox: BasePart } } = {}

local function setDragging(model: Model, on: boolean)
	local current = dragFx[model]
	if on and not current then
		local hitbox = model:FindFirstChild("Hitbox") :: BasePart?
		if not hitbox then
			return
		end
		local emitter = Instance.new("ParticleEmitter")
		emitter.Texture = SMOKE
		emitter.Color = ColorSequence.new(Color3.fromRGB(222, 196, 150))
		emitter.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.4), NumberSequenceKeypoint.new(1, 1) })
		emitter.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.5), NumberSequenceKeypoint.new(1, 4) })
		emitter.Lifetime = NumberRange.new(0.6, 1)
		emitter.Speed = NumberRange.new(1, 3)
		emitter.Rate = 0
		emitter.Parent = hitbox
		local sound = newSound("Drag", hitbox)
		sound.Looped = true
		dragFx[model] = { Emitter = emitter, Sound = sound, Hitbox = hitbox }
	elseif not on and current then
		dragFx[model] = nil
		current.Emitter:Destroy()
		current.Sound:Destroy()
	end
end

-- ===== الصيدة: قصاصات وإعلان =====

local banner = Instance.new("ScreenGui")
banner.Name = "CatchBanner"
banner.ResetOnSpawn = false
banner.Parent = player:WaitForChild("PlayerGui")
local bannerLabel = Instance.new("TextLabel")
bannerLabel.AnchorPoint = Vector2.new(0.5, 0.5)
bannerLabel.Position = UDim2.fromScale(0.5, 0.32)
bannerLabel.Size = UDim2.new(0.9, 0, 0, 80)
bannerLabel.BackgroundTransparency = 1
bannerLabel.Text = ""
bannerLabel.TextScaled = true
bannerLabel.Font = Enum.Font.GothamBlack
bannerLabel.TextStrokeTransparency = 0
bannerLabel.TextTransparency = 1
bannerLabel.TextStrokeColor3 = Color3.fromRGB(40, 25, 15)
bannerLabel.Parent = banner
local bannerScale = Instance.new("UIScale")
bannerScale.Parent = bannerLabel
local bannerSize = Instance.new("UISizeConstraint")
bannerSize.MaxSize = Vector2.new(760, 80)
bannerSize.Parent = bannerLabel
local bannerToken = 0

local function showBanner(text: string, color: Color3)
	bannerToken += 1
	local token = bannerToken
	bannerLabel.Text = text
	bannerLabel.TextColor3 = color
	bannerLabel.TextTransparency = 0
	bannerLabel.TextStrokeTransparency = 0
	bannerScale.Scale = 0.3
	TweenService:Create(bannerScale, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	task.delay(2.6, function()
		if token == bannerToken then
			TweenService:Create(bannerLabel, TweenInfo.new(0.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
		end
	end)
end

local CONFETTI = {
	Color3.fromRGB(255, 90, 90),
	Color3.fromRGB(255, 210, 70),
	Color3.fromRGB(90, 200, 255),
	Color3.fromRGB(120, 230, 120),
	Color3.fromRGB(220, 120, 255),
}

local function onCaught(carModel: Model, rarity: string, variant: string?, characterId: string?, byUserId: number)
	if typeof(carModel) ~= "Instance" or not carModel.Parent then
		return
	end
	local bed = carModel:FindFirstChild("Bed") :: BasePart?
	if bed then
		for _, color in CONFETTI do
			burst(bed, color, 8, 22)
		end
	end
	local special = rarity ~= "Common" or (variant ~= nil and variant ~= HabaliConfig.NormalVariant)
	play(if special then "CatchRare" else "CatchCommon", bed)
	if byUserId ~= player.UserId then
		return
	end
	local name = characterNames[characterId or ""] or "هبالي"
	local info = variantInfo[variant or ""]
	local color = if info then rgb(info.Color) else rgb(HabaliConfig.RarityColors[rarity] or { 255, 255, 255 })
	if special then
		local extra = if info then " " .. info.DisplayName else ""
		showBanner(string.format("🎉 صدت %s%s! (%s)", name, extra, rarityNames[rarity] or ""), color)
		shake(0.4)
	else
		showBanner("🎉 صدت " .. name .. "!", Color3.fromRGB(255, 245, 225))
	end
end

-- ===== السيارات: صوت المحرك والهرن =====

local engines: { [Model]: Sound } = {}

local function onHorn(carModel: Model)
	if typeof(carModel) ~= "Instance" or not carModel.Parent then
		return
	end
	play("Horn", carModel:FindFirstChild("Chassis"))
end

local hornGui = Instance.new("ScreenGui")
hornGui.Name = "HornHud"
hornGui.ResetOnSpawn = false
hornGui.Parent = player.PlayerGui
local hornButton = Instance.new("TextButton")
hornButton.Name = "Horn"
-- تحت زر "سيارتي" فوق يمين، بعيد عن أزرار السواقة
hornButton.AnchorPoint = Vector2.new(1, 0)
hornButton.Position = UDim2.new(1, -16, 0, 214)
hornButton.Size = UDim2.fromOffset(96, 52)
hornButton.BackgroundColor3 = Color3.fromRGB(230, 170, 40)
hornButton.BackgroundTransparency = 0.15
hornButton.Text = "📯 هرن"
hornButton.TextScaled = true
hornButton.Font = Enum.Font.GothamBlack
hornButton.TextColor3 = Color3.new(1, 1, 1)
hornButton.Visible = false
hornButton.Parent = hornGui
local hornCorner = Instance.new("UICorner")
hornCorner.CornerRadius = UDim.new(0.3, 0)
hornCorner.Parent = hornButton

local function honk()
	Remotes.Horn:FireServer()
end
hornButton.Activated:Connect(honk)
UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and (input.KeyCode == Enum.KeyCode.H or input.KeyCode == Enum.KeyCode.ButtonL3) then
		honk()
	end
end)

-- ===== مراقبة العالم (10 مرات بالثانية) =====

local function inCar(): boolean
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local seat = humanoid and humanoid.SeatPart
	return seat ~= nil and seat:IsA("VehicleSeat")
end

local function update()
	-- الدوخة والسحب من الـ Attributes اللي يحطها السيرفر
	local habali = Workspace:FindFirstChild("Habali")
	if habali then
		for _, model in habali:GetChildren() do
			if model:IsA("Model") then
				if model:GetAttribute("Stunned") and not model:GetAttribute("DraggedBy") then
					showStun(model)
				else
					clearStun(model)
				end
				setDragging(model, model:GetAttribute("DraggedBy") ~= nil)
			end
		end
	end
	for model in stunFx do
		if not model.Parent or model.Parent ~= habali then
			clearStun(model)
		end
	end
	for model, fx in dragFx do
		if not model.Parent or model:GetAttribute("DraggedBy") == nil then
			setDragging(model, false)
		else
			local speed = fx.Hitbox.AssemblyLinearVelocity.Magnitude
			fx.Emitter.Rate = if speed > 2 then 12 else 0
			if speed > 2 and not fx.Sound.IsPlaying then
				fx.Sound:Play()
			elseif speed <= 2 and fx.Sound.IsPlaying then
				fx.Sound:Pause()
			end
		end
	end

	-- صوت المحرك: حدته حسب السرعة، وأعلى لو أحد سايق
	local cars = Workspace:FindFirstChild("Cars")
	if cars then
		for _, car in cars:GetChildren() do
			local chassis = car:FindFirstChild("Chassis") :: BasePart?
			if chassis and not engines[car] then
				local sound = newSound("Engine", chassis)
				sound.Looped = true
				sound:Play()
				engines[car] = sound
			end
			local sound = engines[car]
			local seat = car:FindFirstChild("DriverSeat") :: VehicleSeat?
			if sound and chassis then
				local speed = chassis.AssemblyLinearVelocity.Magnitude
				local t = math.clamp(speed / 40, 0, 1)
				local engine = FxConfig.Engine
				sound.PlaybackSpeed = engine.MinPitch + (engine.MaxPitch - engine.MinPitch) * t
				local driven = seat ~= nil and seat.Occupant ~= nil
				sound.Volume = if driven then engine.IdleVolume + (engine.DriveVolume - engine.IdleVolume) * t else 0
			end
		end
	end
	for car, sound in engines do
		if not car.Parent then
			engines[car] = nil
			sound:Destroy()
		end
	end

	hornButton.Visible = inCar()
end

task.spawn(function()
	while true do
		update()
		task.wait(0.1)
	end
end)

-- ===== الأحداث من السيرفر =====

Remotes:WaitForChild("Fx").OnClientEvent:Connect(function(kind, ...)
	if kind == "Swing" then
		swingArm(...)
	elseif kind == "Hit" then
		onHit(...)
	elseif kind == "Caught" then
		onCaught(...)
	elseif kind == "Horn" then
		onHorn(...)
	end
end)

-- صوت المسدس ووميضه (الخط الأزرق يرسمه HuntClient)
Remotes:WaitForChild("Shot").OnClientEvent:Connect(function(from)
	if typeof(from) ~= "Vector3" then
		return
	end
	local flashPart = Instance.new("Part")
	flashPart.Shape = Enum.PartType.Ball
	flashPart.Size = Vector3.new(1.2, 1.2, 1.2)
	flashPart.Anchored = true
	flashPart.CanCollide = false
	flashPart.CanQuery = false
	flashPart.CanTouch = false
	flashPart.Material = Enum.Material.Neon
	flashPart.Color = Color3.fromRGB(150, 230, 255)
	flashPart.Position = from
	flashPart.Parent = Workspace
	TweenService:Create(flashPart, TweenInfo.new(0.15), { Transparency = 1, Size = Vector3.new(2.4, 2.4, 2.4) }):Play()
	Debris:AddItem(flashPart, 1.5) -- يبقى (شفاف) لين يخلص الصوت
	play("Gun", flashPart, 0.08)
end)
