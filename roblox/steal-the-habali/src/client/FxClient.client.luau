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

-- ===== حركة اليد (الضربة والتصويب) =====
-- مفاصل الأفاتار الجديدة (AnimationConstraint) ما تقبل نكتب Transform، فنحرك اليد
-- بـ IKControl: نحط هدف (Attachment) واليد تلحقه. يشتغل على أي شخصية عند كل لاعب.
-- workspace:GetAttribute("FxSlow") يبطّي الحركة للتجربة والتصوير بس.

local function slowScale(): number
	local slow = Workspace:GetAttribute("FxSlow")
	return if typeof(slow) == "number" and slow > 0 then slow else 1
end

local function ease(t: number, style: string?): number
	if style == "out" then
		return 1 - (1 - t) ^ 3
	elseif style == "in" then
		return t ^ 2
	end
	return t * t * (3 - 2 * t)
end

-- IK الذراع اليمين لهالشخصية (نسويه مرة وحدة ونعيد استخدامه)
local function armIK(character: Model): (IKControl?, Attachment?)
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local upper = character:FindFirstChild("RightUpperArm")
	local hand = character:FindFirstChild("RightHand")
	if not humanoid or not root or not upper or not hand then
		return nil, nil
	end
	local target = root:FindFirstChild("FxArmTarget") :: Attachment?
	if not target then
		local made = Instance.new("Attachment")
		made.Name = "FxArmTarget"
		made.Parent = root
		target = made
	end
	local ik = humanoid:FindFirstChild("FxArmIK") :: IKControl?
	if not ik then
		local made = Instance.new("IKControl")
		made.Name = "FxArmIK"
		made.Type = Enum.IKControlType.Position
		made.ChainRoot = upper
		made.EndEffector = hand
		made.Target = target
		made.Priority = 10
		made.Weight = 0
		made.Parent = humanoid
		ik = made
	end
	return ik, target
end

-- keys: { { t = ثواني, pos = Vector3 (بالنسبة لـ HumanoidRootPart: +X يمين، +Y فوق، -Z قدام), w = 0..1, ease = ... } }
-- getPos (اختياري) يحسب مكان الهدف كل فريم بدال pos (التصويب)
local playing: { [Model]: number } = {}

local function playArm(character: Model, keys: { any }, getPos: ((number) -> Vector3)?)
	if not character or not character.Parent then
		return
	end
	local ik, target = armIK(character)
	if not ik or not target then
		return
	end
	local token = (playing[character] or 0) + 1
	playing[character] = token
	local scale = slowScale()
	local total = keys[#keys].t * scale
	local started = os.clock()
	local connection
	connection = RunService.RenderStepped:Connect(function()
		local elapsed = os.clock() - started
		if playing[character] ~= token or not character.Parent or not ik.Parent then
			connection:Disconnect()
			return
		end
		if elapsed >= total then
			ik.Weight = 0
			playing[character] = nil
			connection:Disconnect()
			return
		end
		local a, b = keys[1], keys[#keys]
		for i = 1, #keys - 1 do
			if elapsed <= keys[i + 1].t * scale then
				a, b = keys[i], keys[i + 1]
				break
			end
		end
		local span = math.max((b.t - a.t) * scale, 1e-3)
		local k = ease(math.clamp((elapsed - a.t * scale) / span, 0, 1), b.ease)
		ik.Weight = a.w + (b.w - a.w) * k
		target.Position = if getPos then getPos(elapsed / scale) else a.pos:Lerp(b.pos, k)
	end)
end

-- ضربة العقال: ترفع اليد ورا فوق الراس، تضرب لقدام وتحت بقوة، وترجع (أقل من تبريد الضربة 0.4)
local SWING = {
	{ t = 0, pos = Vector3.new(1.4, 0.2, 0), w = 0 },
	{ t = 0.12, ease = "out", pos = Vector3.new(1.1, 3.3, 1.3), w = 1 },
	{ t = 0.21, ease = "in", pos = Vector3.new(0.6, 0.4, -2.6), w = 1 },
	{ t = 0.37, pos = Vector3.new(1.2, 0, -1), w = 0 },
}

local function agalTrail(character: Model): Trail?
	local gear = character:FindFirstChild("HuntGear")
	local agal = gear and gear:FindFirstChild("Agal")
	local top = agal and agal:FindFirstChild("TrailTop")
	local bottom = agal and agal:FindFirstChild("TrailBottom")
	if not agal or not top or not bottom then
		return nil
	end
	local trail = agal:FindFirstChild("SwingTrail") :: Trail?
	if not trail then
		local made = Instance.new("Trail")
		made.Name = "SwingTrail"
		made.Attachment0 = top :: Attachment
		made.Attachment1 = bottom :: Attachment
		made.Lifetime = 0.12
		made.MinLength = 0
		made.LightEmission = 0.3
		made.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255))
		made.Transparency = NumberSequence.new(0.35, 1)
		made.Enabled = false
		made.Parent = agal
		trail = made
	end
	return trail
end

local function swingArm(character: Model)
	if not character or not character.Parent then
		return
	end
	playArm(character, SWING)
	local trail = agalTrail(character)
	if trail then
		local scale = slowScale()
		task.delay(0.11 * scale, function()
			trail.Enabled = true
			task.delay(0.14 * scale, function()
				trail.Enabled = false
			end)
		end)
	end
	local hand = character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm")
	play("Swing", hand, 0.1)
end

-- التصويب: اليد تمتد لين تأشر على الهدف، ترتد شوي مع الطلقة، وبعدها تنزل
local AIM = {
	{ t = 0, w = 0 },
	{ t = 0.08, ease = "out", w = 1 },
	{ t = 0.85, w = 1 },
	{ t = 1.1, ease = "in", w = 0 },
}

local function aimArm(character: Model, aimAt: Vector3)
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local upper = character:FindFirstChild("RightUpperArm") :: BasePart?
	if not root or not upper then
		return
	end
	playArm(character, AIM, function(t: number): Vector3
		-- من الكتف باتجاه الهدف بطول الذراع تقريباً. الارتداد: ترجع ورا وترتفع شوي بعد الطلقة
		local shoulder = upper.Position + Vector3.new(0, upper.Size.Y * 0.4, 0)
		local direction = (aimAt - shoulder).Unit
		local kick = if t > 0.08 and t < 0.25 then math.sin((t - 0.08) / 0.17 * math.pi) else 0
		local point = shoulder + direction * (2.2 - kick * 0.5) + Vector3.new(0, kick * 0.35, 0)
		return root.CFrame:PointToObjectSpace(point)
	end)
end

-- سهم ينشاف وهو طاير من فم المسدس لين المكان اللي صابه
local function decorPart(size: Vector3, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Size = size
	part.Color = color
	part.Material = material
	part.Anchored = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	return part
end

local function flyDart(from: Vector3, to: Vector3)
	local distance = (to - from).Magnitude
	if distance < 1 then
		return
	end
	local look = CFrame.lookAt(from, to)
	local dart = decorPart(Vector3.new(0.12, 0.12, 0.7), Color3.fromRGB(200, 205, 215), Enum.Material.Metal)
	dart.Name = "Dart"
	dart.CFrame = look
	local feather = decorPart(Vector3.new(0.3, 0.3, 0.2), Color3.fromRGB(255, 140, 30), Enum.Material.Neon)
	feather.CFrame = look * CFrame.new(0, 0, 0.4)
	dart.Parent = Workspace
	feather.Parent = dart
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(0, 0.05, 0.35)
	a0.Parent = dart
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(0, -0.05, 0.35)
	a1.Parent = dart
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Lifetime = 0.15
	trail.Color = ColorSequence.new(Color3.fromRGB(255, 190, 120))
	trail.Transparency = NumberSequence.new(0.3, 1)
	trail.Parent = dart
	local time = math.clamp(distance / 260, 0.05, 0.5) * slowScale()
	local info = TweenInfo.new(time, Enum.EasingStyle.Linear)
	local finalCFrame = CFrame.lookAt(to, to + look.LookVector)
	TweenService:Create(dart, info, { CFrame = finalCFrame }):Play()
	TweenService:Create(feather, info, { CFrame = finalCFrame * CFrame.new(0, 0, 0.4) }):Play()
	Debris:AddItem(dart, time + 0.6)
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

-- قاذف النعاس: غيمة بنفسجية تكبر وتختفي، وفوقها Zzz
local function sleepCloud(position: Vector3, radius: number)
	if typeof(position) ~= "Vector3" or type(radius) ~= "number" or radius <= 0 or radius > 40 then
		return
	end
	local cloud = Instance.new("Part")
	cloud.Shape = Enum.PartType.Ball
	cloud.Size = Vector3.one * 2
	cloud.Anchored = true
	cloud.CanCollide = false
	cloud.CanQuery = false
	cloud.CanTouch = false
	cloud.CastShadow = false
	cloud.Material = Enum.Material.ForceField
	cloud.Color = Color3.fromRGB(170, 120, 255)
	cloud.Transparency = 0.2
	cloud.Position = position
	cloud.Parent = Workspace
	TweenService:Create(cloud, TweenInfo.new(0.35, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = Vector3.one * radius * 2 }):Play()
	task.delay(0.9, function()
		TweenService:Create(cloud, TweenInfo.new(0.8), { Transparency = 1 }):Play()
	end)
	burst(cloud, Color3.fromRGB(200, 170, 255), 18, 6, SMOKE)
	play("Gun", cloud, 0.05)
	Debris:AddItem(cloud, 2)
end

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
	elseif kind == "Cloud" then
		sleepCloud(...)
	end
end)

-- المسدس: الذراع تصوّب، والسهم يطير من فم المسدس، ووميض وصوت
Remotes:WaitForChild("Shot").OnClientEvent:Connect(function(from, to, shooter)
	if typeof(from) ~= "Vector3" then
		return
	end
	if typeof(shooter) == "Instance" and shooter:IsA("Model") and typeof(to) == "Vector3" then
		aimArm(shooter, to)
		-- السهم يطلع بعد ما ترتفع اليد
		task.delay(0.07 * slowScale(), function()
			local gear = shooter:FindFirstChild("HuntGear")
			local gun = gear and gear:FindFirstChild("DartGun")
			local muzzle = gun and gun:FindFirstChild("Muzzle") :: Attachment?
			flyDart(if muzzle then muzzle.WorldPosition else from, to)
		end)
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
