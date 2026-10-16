-- يبني الأوبي كامل بالكود: اللوبي، المراحل، نقاط الحفظ، والنهاية
-- الأشياء اللي تتحرك (منصات، مراوح، منصات تختفي) يحرّكها الكلاينت عشان تكون ناعمة

local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local CourseBuilder = {}

local START_Y = 12
local THICK = 2 -- سماكة المنصات
local LAVA_COLOR = Color3.fromRGB(255, 85, 30)
local BEAM_COLOR = Color3.fromRGB(150, 100, 60)
local MOVER_COLOR = Color3.fromRGB(240, 240, 255)
local CHECKPOINT_COLOR = Color3.fromRGB(235, 235, 235)
local PAD_COLOR = Color3.fromRGB(60, 255, 120)
local STONE_COLOR = Color3.fromRGB(70, 70, 82)

type Ctx = {
	x: number, -- نهاية آخر منصة (على محور x)
	y: number, -- سطح آخر منصة
	folder: Instance,
	gapScale: number,
	colors: { Color3 },
	count: number,
}

local function makePart(parent: Instance, size: Vector3, cframe: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function scaled(ctx: Ctx, gap: number): number
	return gap * ctx.gapScale
end

type PlatformOpts = {
	gap: number?,
	rise: number?,
	z: number?,
	color: Color3?,
	material: Enum.Material?,
}

-- منصة تبدأ بعد آخر منصة بمسافة gap، وتصير هي "آخر منصة"
local function platform(ctx: Ctx, length: number, width: number, opts: PlatformOpts?): Part
	local o: PlatformOpts = opts or {}
	local nearX = ctx.x + (o.gap or 0)
	local top = ctx.y + (o.rise or 0)
	ctx.count += 1
	local color = o.color or ctx.colors[ctx.count % #ctx.colors + 1]
	local p = makePart(
		ctx.folder,
		Vector3.new(length, THICK, width),
		CFrame.new(nearX + length / 2, top - THICK / 2, o.z or 0),
		color,
		o.material
	)
	ctx.x = nearX + length
	ctx.y = top
	return p
end

local function addLabel(adornee: BasePart, text: string, size: UDim2, offsetY: number, color: Color3, maxDistance: number?)
	local gui = Instance.new("BillboardGui")
	gui.Size = size
	gui.StudsOffset = Vector3.new(0, offsetY, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = maxDistance or 120
	gui.Adornee = adornee
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.Font = Enum.Font.GothamBlack
	label.TextColor3 = color
	label.TextStrokeTransparency = 0.2
	label.Parent = gui
	gui.Parent = adornee
end

local Segments = {}

-- نطّات عادية
function Segments.jumps(ctx: Ctx, s)
	local size = s.size or 5
	for i = 1, s.count or 4 do
		platform(ctx, size, size, {
			gap = scaled(ctx, s.gap or 4),
			rise = s.rise or 0,
			z = math.sin(i * 1.7) * 2,
		})
	end
	platform(ctx, 6, 6, { gap = scaled(ctx, s.gap or 4) })
end

-- حمم وحجار تنط عليها
function Segments.lava(ctx: Ctx, s)
	local startX = ctx.x
	local baseY = ctx.y
	local gap = scaled(ctx, s.gap or 3)
	for i = 1, s.stones or 4 do
		platform(ctx, 3, 3, {
			gap = gap,
			z = if i % 2 == 0 then 2 else -2,
			color = STONE_COLOR,
			material = Enum.Material.Slate,
		})
	end
	local endX = ctx.x + gap
	local lava = makePart(
		ctx.folder,
		Vector3.new(endX - startX, 1, 16),
		CFrame.new((startX + endX) / 2, baseY - THICK - 0.5, 0),
		LAVA_COLOR,
		Enum.Material.Neon
	)
	lava.Name = "Lava"
	CollectionService:AddTag(lava, "Kill")
	platform(ctx, 6, 8, { gap = gap })
end

-- خشبة رفيعة تمشي عليها
function Segments.beam(ctx: Ctx, s)
	platform(ctx, s.length or 14, s.width or 1.5, { color = BEAM_COLOR, material = Enum.Material.WoodPlanks })
	platform(ctx, 6, 6)
end

-- منصات يمين ويسار
function Segments.zigzag(ctx: Ctx, s)
	local gap = scaled(ctx, s.gap or 2.5)
	for i = 1, s.count or 5 do
		platform(ctx, 4, 4, { gap = gap, z = if i % 2 == 0 then 4 else -4 })
	end
	platform(ctx, 6, 6, { gap = gap })
end

-- منصة تروح وترجع فوق فراغ
function Segments.mover(ctx: Ctx, s)
	local span = s.span or 18
	local size = 6
	local startCenter = ctx.x + size / 2 + 0.5
	local endCenter = ctx.x + span - size / 2 - 0.5
	local origin = CFrame.new(startCenter, ctx.y - THICK / 2, 0)
	local p = makePart(ctx.folder, Vector3.new(size, THICK, size), origin, MOVER_COLOR, Enum.Material.DiamondPlate)
	p.Name = "Mover"
	p:SetAttribute("Origin", origin)
	p:SetAttribute("Offset", Vector3.new(endCenter - startCenter, 0, 0))
	p:SetAttribute("Period", s.period or 6)
	CollectionService:AddTag(p, "Mover")
	ctx.x += span
	platform(ctx, 6, 8)
end

-- دائرة فوقها عصا حمرا تدور، نطّ فوقها
function Segments.spinner(ctx: Ctx, s)
	local r = s.radius or 9
	local gap = scaled(ctx, 3)
	local cx = ctx.x + gap + r
	local top = ctx.y
	ctx.count += 1
	local disk = makePart(
		ctx.folder,
		Vector3.new(THICK, r * 2, r * 2),
		CFrame.new(cx, top - THICK / 2, 0) * CFrame.Angles(0, 0, math.pi / 2),
		ctx.colors[ctx.count % #ctx.colors + 1]
	)
	disk.Shape = Enum.PartType.Cylinder
	local bars = s.bars or 1
	for b = 1, bars do
		local center = CFrame.new(cx, top + 1.2, 0)
		local bar = makePart(ctx.folder, Vector3.new(r * 2 - 0.5, 1, 1), center, LAVA_COLOR, Enum.Material.Neon)
		bar.Name = "SpinnerBar"
		bar.CanCollide = false
		bar:SetAttribute("Center", center)
		bar:SetAttribute("Speed", s.speed or 1.5)
		bar:SetAttribute("Phase", (b - 1) * math.pi / bars)
		CollectionService:AddTag(bar, "Kill")
		CollectionService:AddTag(bar, "Spinner")
	end
	ctx.x = cx + r
	ctx.y = top
	platform(ctx, 6, 6, { gap = gap })
end

-- سلّم تتسلقه لفوق
function Segments.truss(ctx: Ctx, s)
	local h = s.height or 12
	h -= h % 2 -- لازم يكون زوجي
	platform(ctx, 6, 6, { gap = scaled(ctx, 4) })
	local truss = Instance.new("TrussPart")
	truss.Anchored = true
	truss.Size = Vector3.new(2, h, 2)
	truss.CFrame = CFrame.new(ctx.x + 1, ctx.y + h / 2, 0)
	truss.Color = Color3.fromRGB(90, 90, 100)
	truss.Parent = ctx.folder
	ctx.x += 2
	platform(ctx, 8, 8, { rise = h })
end

-- منصات تختفي وترجع (مجموعتين بالتناوب)
function Segments.vanish(ctx: Ctx, s)
	local period = s.period or 3.2
	local gap = scaled(ctx, s.gap or 3.5)
	for i = 1, s.count or 6 do
		local p = platform(ctx, 5, 5, {
			gap = gap,
			color = if i % 2 == 0 then Color3.fromRGB(120, 200, 255) else Color3.fromRGB(255, 160, 220),
			material = Enum.Material.Glass,
		})
		p.Name = "Vanish"
		p:SetAttribute("Period", period)
		p:SetAttribute("Offset", if i % 2 == 0 then period / 2 else 0)
		p:SetAttribute("Visible", 0.72)
		CollectionService:AddTag(p, "Vanish")
	end
	platform(ctx, 6, 8, { gap = gap })
end

-- منصة قفز خارق توديك لفوق
function Segments.pad(ctx: Ctx, s)
	local h = s.height or 16
	platform(ctx, 8, 8, { gap = scaled(ctx, 4) })
	local pad = makePart(ctx.folder, Vector3.new(4, 0.4, 4), CFrame.new(ctx.x - 3, ctx.y + 0.2, 0), PAD_COLOR, Enum.Material.Neon)
	pad.Name = "JumpPad"
	pad:SetAttribute("LaunchHeight", h + 9)
	CollectionService:AddTag(pad, "JumpPad")
	addLabel(pad, "⬆️", UDim2.fromOffset(60, 60), 3, PAD_COLOR, 60)
	platform(ctx, 8, 8, { gap = 4, rise = h })
end

local function buildCheckpoint(ctx: Ctx, stage: number, gap: number): (BasePart, CFrame)
	local plat = platform(ctx, 10, 10, { gap = gap, color = Color3.fromRGB(60, 60, 70), material = Enum.Material.Concrete })
	local pad = makePart(
		ctx.folder,
		Vector3.new(7, 0.3, 7),
		plat.CFrame * CFrame.new(0, THICK / 2 + 0.15, 0),
		CHECKPOINT_COLOR,
		Enum.Material.Neon
	)
	pad.Name = "Checkpoint"
	pad:SetAttribute("Stage", stage)
	CollectionService:AddTag(pad, "Checkpoint")
	addLabel(pad, tostring(stage), UDim2.fromOffset(80, 80), 5, Color3.new(1, 1, 1))
	-- مكان الرسبون فوق النقطة ووجهك للمرحلة
	local spawnCf = CFrame.lookAt(pad.Position + Vector3.new(0, 4, 0), pad.Position + Vector3.new(10, 4, 0))
	return pad, spawnCf
end

local function buildWorldSign(parent: Instance, position: Vector3, world, index: number)
	local anchor = makePart(parent, Vector3.new(1, 1, 1), CFrame.new(position), Color3.new(1, 1, 1))
	anchor.Transparency = 1
	anchor.CanCollide = false
	anchor.CanTouch = false
	anchor.Name = "WorldSign"
	addLabel(
		anchor,
		string.format("%s العالم %d: %s", world.icon, index, world.name),
		UDim2.fromOffset(420, 70),
		0,
		world.colors[1],
		200
	)
	local desc = makePart(parent, Vector3.new(1, 1, 1), CFrame.new(position - Vector3.new(0, 4, 0)), Color3.new(1, 1, 1))
	desc.Transparency = 1
	desc.CanCollide = false
	desc.CanTouch = false
	addLabel(desc, world.desc, UDim2.fromOffset(420, 40), 0, Color3.new(1, 1, 1), 200)
end

local function buildLobby(root: Instance, ctx: Ctx): SpawnLocation
	local lobby = Instance.new("Folder")
	lobby.Name = "Lobby"
	lobby.Parent = root
	ctx.folder = lobby
	ctx.x = -44
	local floor = platform(ctx, 44, 44, { color = Color3.fromRGB(95, 95, 110), material = Enum.Material.Concrete })

	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Size = Vector3.new(8, 1, 8)
	spawn.CFrame = CFrame.new(floor.Position.X - 10, ctx.y + 0.5, 0)
	spawn.Color = Color3.fromRGB(255, 200, 60)
	spawn.Material = Enum.Material.Neon
	spawn.TopSurface = Enum.SurfaceType.Smooth
	spawn.Parent = lobby

	-- لوحة العنوان
	local title = makePart(lobby, Vector3.new(1, 1, 1), CFrame.new(floor.Position.X, ctx.y + 16, 0), Color3.new(1, 1, 1))
	title.Transparency = 1
	title.CanCollide = false
	title.CanTouch = false
	addLabel(title, "🙃 أوبي المقلوب", UDim2.fromOffset(500, 100), 0, Color3.fromRGB(255, 220, 80), 300)
	local how = makePart(lobby, Vector3.new(1, 1, 1), CFrame.new(floor.Position.X, ctx.y + 10, 0), Color3.new(1, 1, 1))
	how.Transparency = 1
	how.CanCollide = false
	how.CanTouch = false
	addLabel(how, "5 عوالم وكل عالم يقلب اللعبة! ← روح يمين وابدأ", UDim2.fromOffset(480, 40), 0, Color3.new(1, 1, 1), 300)

	-- أعمدة زينة
	for i = 0, 3 do
		local angle = i * math.pi / 2 + math.pi / 4
		local pos = floor.Position + Vector3.new(math.cos(angle) * 18, THICK / 2 + 5, math.sin(angle) * 18)
		local pillar = makePart(lobby, Vector3.new(2, 10, 2), CFrame.new(pos), Color3.fromRGB(255, 200, 60), Enum.Material.Neon)
		pillar.Name = "Pillar"
	end
	return spawn
end

local function buildFinish(root: Instance, ctx: Ctx): (BasePart, CFrame)
	local folder = Instance.new("Folder")
	folder.Name = "Finish"
	folder.Parent = root
	ctx.folder = folder
	local floor = platform(ctx, 24, 24, { gap = 4, color = Color3.fromRGB(255, 215, 80), material = Enum.Material.Marble })

	local base = makePart(folder, Vector3.new(6, 3, 6), floor.CFrame * CFrame.new(4, THICK / 2 + 1.5, 0), Color3.fromRGB(60, 60, 70), Enum.Material.Marble)
	base.Name = "TrophyBase"
	local cup = makePart(folder, Vector3.new(3, 5, 3), base.CFrame * CFrame.new(0, 4, 0), Color3.fromRGB(255, 200, 40), Enum.Material.Foil)
	cup.Name = "Trophy"
	cup.Shape = Enum.PartType.Cylinder
	cup.CFrame = base.CFrame * CFrame.new(0, 4, 0) * CFrame.Angles(0, 0, math.pi / 2)
	addLabel(cup, "🏆 النهاية!", UDim2.fromOffset(260, 70), 5, Color3.fromRGB(255, 220, 80), 200)

	local pad = makePart(folder, Vector3.new(16, 0.3, 16), floor.CFrame * CFrame.new(-2, THICK / 2 + 0.15, 0), Color3.fromRGB(255, 240, 150), Enum.Material.Neon)
	pad.Name = "FinishPad"
	CollectionService:AddTag(pad, "Finish")

	local spawnCf = CFrame.lookAt(floor.Position + Vector3.new(-6, 5, 0), floor.Position + Vector3.new(10, 5, 0))
	return pad, spawnCf
end

-- بحر حمم تحت المسار كامل
local function buildLavaSea(root: Instance, fromX: number, toX: number)
	local chunk = 512
	local x = fromX
	while x < toX do
		local len = math.min(chunk, toX - x)
		local sea = makePart(root, Vector3.new(len, 1, 400), CFrame.new(x + len / 2, 0, 0), LAVA_COLOR, Enum.Material.Neon)
		sea.Name = "LavaSea"
		sea.Transparency = 0.15
		CollectionService:AddTag(sea, "Kill")
		x += len
	end
end

export type Course = {
	spawn: SpawnLocation,
	checkpoints: { CFrame },
	checkpointPads: { BasePart },
	finishPad: BasePart,
	finishSpawn: CFrame,
}

function CourseBuilder.build(): Course
	local root = Instance.new("Folder")
	root.Name = "Course"
	root.Parent = Workspace

	local ctx: Ctx = {
		x = 0,
		y = START_Y,
		folder = root,
		gapScale = 1,
		colors = Config.Worlds[1].colors,
		count = 0,
	}

	local spawn = buildLobby(root, ctx)
	local checkpoints = {}
	local checkpointPads = {}

	for stage, def in Config.Stages do
		local folder = Instance.new("Folder")
		folder.Name = string.format("Stage%02d", stage)
		folder.Parent = root
		ctx.folder = folder

		-- الفراغ قبل نقطة الحفظ يتبع العالم اللي قبلها (لأن اللاعب لسا فيه)
		local gap = if stage == 1 then 0 else scaled(ctx, 4)
		checkpointPads[stage], checkpoints[stage] = buildCheckpoint(ctx, stage, gap)

		local world = Config.Worlds[def.world]
		ctx.gapScale = world.gapScale or 1
		ctx.colors = world.colors
		if Config.isWorldStart(stage) then
			buildWorldSign(folder, Vector3.new(ctx.x - 5, ctx.y + 14, 0), world, def.world)
		end

		for _, segment in def.segments do
			local build = Segments[segment.type]
			if build then
				build(ctx, segment)
			else
				warn("نوع عقبة غير معروف:", segment.type)
			end
		end
	end

	local finishPad, finishSpawn = buildFinish(root, ctx)
	buildLavaSea(root, -80, ctx.x + 60)

	return {
		spawn = spawn,
		checkpoints = checkpoints,
		checkpointPads = checkpointPads,
		finishPad = finishPad,
		finishSpawn = finishSpawn,
	}
end

return CourseBuilder
