-- يبني الأوبي كامل بالكود: اللوبي، المراحل، نقاط الحفظ، النهاية، والمسار التعاوني 🪢
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
local PLATE_COLOR = Color3.fromRGB(255, 90, 160)
local BRIDGE_COLOR = Color3.fromRGB(255, 200, 230)

-- جسر يطلع لما أحد يوقف على أحد الأزرار
export type BridgeGroup = {
	plates: { BasePart },
	bridge: BasePart,
}

type Ctx = {
	x: number, -- نهاية آخر منصة (على محور x)
	y: number, -- سطح آخر منصة
	z: number, -- وسط المسار (على محور z)
	folder: Instance,
	gapScale: number,
	colors: { Color3 },
	count: number,
	bridges: { BridgeGroup },
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
	z: number?, -- إزاحة عن وسط المسار
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
		CFrame.new(nearX + length / 2, top - THICK / 2, ctx.z + (o.z or 0)),
		color,
		o.material
	)
	ctx.x = nearX + length
	ctx.y = top
	return p
end

local function addLabel(
	adornee: BasePart,
	text: string,
	size: UDim2,
	offsetY: number,
	color: Color3,
	maxDistance: number?
): TextLabel
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
	return label
end

-- قطعة مخفية نعلّق عليها لوحة كلام
local function signAnchor(parent: Instance, position: Vector3): Part
	local anchor = makePart(parent, Vector3.new(1, 1, 1), CFrame.new(position), Color3.new(1, 1, 1))
	anchor.Name = "Sign"
	anchor.Transparency = 1
	anchor.CanCollide = false
	anchor.CanTouch = false
	anchor.CanQuery = false
	return anchor
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
	local landing = math.max(6, size)
	platform(ctx, landing, landing, { gap = scaled(ctx, s.gap or 4) })
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
		CFrame.new((startX + endX) / 2, baseY - THICK - 0.5, ctx.z),
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
	local size = s.size or 6
	local startCenter = ctx.x + size / 2 + 0.5
	local endCenter = ctx.x + span - size / 2 - 0.5
	local origin = CFrame.new(startCenter, ctx.y - THICK / 2, ctx.z)
	local p = makePart(ctx.folder, Vector3.new(size, THICK, size), origin, MOVER_COLOR, Enum.Material.DiamondPlate)
	p.Name = "Mover"
	p:SetAttribute("Origin", origin)
	p:SetAttribute("Offset", Vector3.new(endCenter - startCenter, 0, 0))
	p:SetAttribute("Period", s.period or 6)
	CollectionService:AddTag(p, "Mover")
	ctx.x += span
	platform(ctx, math.max(6, size), 8)
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
		CFrame.new(cx, top - THICK / 2, ctx.z) * CFrame.Angles(0, 0, math.pi / 2),
		ctx.colors[ctx.count % #ctx.colors + 1]
	)
	disk.Shape = Enum.PartType.Cylinder
	local bars = s.bars or 1
	for b = 1, bars do
		local center = CFrame.new(cx, top + 1.2, ctx.z)
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
	local w = s.width or 2
	w -= w % 2
	platform(ctx, 6, math.max(6, w + 2), { gap = scaled(ctx, 4) })
	local truss = Instance.new("TrussPart")
	truss.Anchored = true
	truss.Size = Vector3.new(2, h, w)
	truss.CFrame = CFrame.new(ctx.x + 1, ctx.y + h / 2, ctx.z)
	truss.Color = Color3.fromRGB(90, 90, 100)
	truss.Parent = ctx.folder
	ctx.x += 2
	platform(ctx, 8, 8, { rise = h })
end

-- منصات تختفي وترجع (مجموعتين بالتناوب)
function Segments.vanish(ctx: Ctx, s)
	local period = s.period or 3.2
	local gap = scaled(ctx, s.gap or 3.5)
	local size = s.size or 5
	for i = 1, s.count or 6 do
		local p = platform(ctx, size, size, {
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
	local pad = makePart(ctx.folder, Vector3.new(4, 0.4, 4), CFrame.new(ctx.x - 3, ctx.y + 0.2, ctx.z), PAD_COLOR, Enum.Material.Neon)
	pad.Name = "JumpPad"
	pad:SetAttribute("LaunchHeight", h + 9)
	CollectionService:AddTag(pad, "JumpPad")
	addLabel(pad, "⬆️", UDim2.fromOffset(60, 60), 3, PAD_COLOR, 60)
	platform(ctx, 8, 8, { gap = 4, rise = h })
end

-- 🪢 جسر بأزرار: واحد يوقف على الزر عشان يطلع الجسر، والثاني يعبر
-- الفراغ أبعد من النطّة، والأزرار قريبة من الحافة عشان الحبل يكفي بينهم
function Segments.bridge(ctx: Ctx, s)
	local gap = s.gap or Config.Coop.bridgeGap
	local plateZ = ctx.z - 3.5
	local bridgeZ = 3

	platform(ctx, 10, 12, { gap = scaled(ctx, 4) })
	local nearPlate = makePart(ctx.folder, Vector3.new(4, 0.3, 4), CFrame.new(ctx.x - 2, ctx.y + 0.15, plateZ), PLATE_COLOR)
	nearPlate.Name = "BridgePlate"
	addLabel(nearPlate, "🔘 وقّف هنا", UDim2.fromOffset(140, 40), 3, PLATE_COLOR, 80)

	local bridge = makePart(
		ctx.folder,
		Vector3.new(gap, THICK, 4),
		CFrame.new(ctx.x + gap / 2, ctx.y - THICK / 2, ctx.z + bridgeZ),
		BRIDGE_COLOR,
		Enum.Material.Glass
	)
	bridge.Name = "Bridge"
	bridge.CanCollide = false
	bridge.Transparency = 0.85
	CollectionService:AddTag(bridge, "CoopBridge")

	ctx.x += gap
	platform(ctx, 10, 12)
	local farPlate = makePart(
		ctx.folder,
		Vector3.new(4, 0.3, 4),
		CFrame.new(ctx.x - 10 + 2, ctx.y + 0.15, plateZ),
		PLATE_COLOR
	)
	farPlate.Name = "BridgePlate"
	addLabel(farPlate, "🔘 وقّف هنا", UDim2.fromOffset(140, 40), 3, PLATE_COLOR, 80)

	table.insert(ctx.bridges, { plates = { nearPlate, farPlate }, bridge = bridge })
end

-- 🪢 طريقين ضيقين وبينهم حمم: كل واحد ياخذ طريق، والفراغات بأماكن مختلفة
function Segments.lanes(ctx: Ctx, s)
	local length = s.length or 36
	platform(ctx, 6, 14, { gap = scaled(ctx, 3) })
	local startX = ctx.x + 3
	local endX = startX + length
	local baseY = ctx.y
	local laneZ = 5

	local function lane(z: number, pieceLength: number, gap: number, phase: number)
		local x = startX + phase
		while x < endX do
			local l = math.min(pieceLength, endX - x)
			if l >= 1.5 then
				ctx.count += 1
				makePart(
					ctx.folder,
					Vector3.new(l, THICK, 2.5),
					CFrame.new(x + l / 2, baseY - THICK / 2, ctx.z + z),
					ctx.colors[ctx.count % #ctx.colors + 1]
				)
			end
			x += l + gap
		end
	end
	-- أول قطعة لاصقة بالمنصة عشان تبدون منها
	lane(-laneZ, 5, 3, -3)
	lane(laneZ, 3.5, 3, -3)

	local divider = makePart(
		ctx.folder,
		Vector3.new(length + 3, 1, 4),
		CFrame.new(startX - 3 + (length + 3) / 2, baseY - 1.5, ctx.z),
		LAVA_COLOR,
		Enum.Material.Neon
	)
	divider.Name = "LaneLava"
	CollectionService:AddTag(divider, "Kill")

	ctx.x = endX
	ctx.y = baseY
	platform(ctx, 8, 14, { gap = 3 })
end

type CheckpointOpts = {
	tag: string,
	width: number,
}

local function buildCheckpoint(ctx: Ctx, stage: number, gap: number, opts: CheckpointOpts): (BasePart, CFrame)
	local plat = platform(ctx, 10, opts.width, { gap = gap, color = Color3.fromRGB(60, 60, 70), material = Enum.Material.Concrete })
	local pad = makePart(
		ctx.folder,
		Vector3.new(7, 0.3, 7),
		plat.CFrame * CFrame.new(0, THICK / 2 + 0.15, 0),
		CHECKPOINT_COLOR,
		Enum.Material.Neon
	)
	pad.Name = "Checkpoint"
	pad:SetAttribute("Stage", stage)
	CollectionService:AddTag(pad, opts.tag)
	addLabel(pad, tostring(stage), UDim2.fromOffset(80, 80), 5, Color3.new(1, 1, 1))
	-- مكان الرسبون فوق النقطة ووجهك للمرحلة
	local spawnCf = CFrame.lookAt(pad.Position + Vector3.new(0, 4, 0), pad.Position + Vector3.new(10, 4, 0))
	return pad, spawnCf
end

local function buildWorldSign(parent: Instance, position: Vector3, title: string, desc: string, color: Color3)
	addLabel(signAnchor(parent, position), title, UDim2.fromOffset(420, 70), 0, color, 200)
	addLabel(signAnchor(parent, position - Vector3.new(0, 4, 0)), desc, UDim2.fromOffset(420, 40), 0, Color3.new(1, 1, 1), 200)
end

export type Lobby = {
	spawn: SpawnLocation,
	pairPads: { BasePart },
	pairStatus: TextLabel,
}

local function buildLobby(root: Instance, ctx: Ctx): Lobby
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
	addLabel(signAnchor(lobby, Vector3.new(floor.Position.X, ctx.y + 16, 0)), "🙃 أوبي المقلوب", UDim2.fromOffset(500, 100), 0, Color3.fromRGB(255, 220, 80), 300)
	addLabel(
		signAnchor(lobby, Vector3.new(floor.Position.X, ctx.y + 10, 0)),
		"5 عوالم وكل عالم يقلب اللعبة! ← روح يمين وابدأ",
		UDim2.fromOffset(480, 40),
		0,
		Color3.new(1, 1, 1),
		300
	)

	-- أعمدة زينة
	for i = 0, 3 do
		local angle = i * math.pi / 2 + math.pi / 4
		local pos = floor.Position + Vector3.new(math.cos(angle) * 18, THICK / 2 + 5, math.sin(angle) * 18)
		local pillar = makePart(lobby, Vector3.new(2, 10, 2), CFrame.new(pos), Color3.fromRGB(255, 200, 60), Enum.Material.Neon)
		pillar.Name = "Pillar"
	end

	-- 🪢 دوائر الربط: كل لاعب يوقف على دائرة
	local pairZ = 14
	local pairPads = {}
	for i, offsetX in { -4, 4 } do
		local pad = makePart(
			lobby,
			Vector3.new(5, 0.4, 5),
			CFrame.new(floor.Position.X - 8 + offsetX, ctx.y + 0.2, pairZ),
			if i == 1 then Color3.fromRGB(255, 150, 90) else Color3.fromRGB(255, 205, 120),
			Enum.Material.Neon
		)
		pad.Name = "PairPad" .. i
		pad.Shape = Enum.PartType.Block
		addLabel(pad, "🪢 " .. i, UDim2.fromOffset(70, 50), 3, Color3.new(1, 1, 1), 80)
		pairPads[i] = pad
	end
	addLabel(
		signAnchor(lobby, Vector3.new(floor.Position.X - 8, ctx.y + 10, pairZ)),
		"🪢 العب مع خوي: كل واحد يوقف على دائرة",
		UDim2.fromOffset(380, 40),
		0,
		Config.Coop.colors[2],
		120
	)
	local pairStatus = addLabel(
		signAnchor(lobby, Vector3.new(floor.Position.X - 8, ctx.y + 7, pairZ)),
		"",
		UDim2.fromOffset(380, 34),
		0,
		Color3.new(1, 1, 1),
		120
	)

	return { spawn = spawn, pairPads = pairPads, pairStatus = pairStatus }
end

type FinishOpts = {
	name: string,
	tag: string,
	text: string,
}

local function buildFinish(root: Instance, ctx: Ctx, opts: FinishOpts): (BasePart, CFrame)
	local folder = Instance.new("Folder")
	folder.Name = opts.name
	folder.Parent = root
	ctx.folder = folder
	local floor = platform(ctx, 24, 24, { gap = 4, color = Color3.fromRGB(255, 215, 80), material = Enum.Material.Marble })

	local base = makePart(folder, Vector3.new(6, 3, 6), floor.CFrame * CFrame.new(4, THICK / 2 + 1.5, 0), Color3.fromRGB(60, 60, 70), Enum.Material.Marble)
	base.Name = "TrophyBase"
	local cup = makePart(
		folder,
		Vector3.new(3, 5, 3),
		base.CFrame * CFrame.new(0, 4, 0) * CFrame.Angles(0, 0, math.pi / 2),
		Color3.fromRGB(255, 200, 40),
		Enum.Material.Foil
	)
	cup.Name = "Trophy"
	cup.Shape = Enum.PartType.Cylinder
	addLabel(cup, opts.text, UDim2.fromOffset(260, 70), 5, Color3.fromRGB(255, 220, 80), 200)

	local pad = makePart(folder, Vector3.new(16, 0.3, 16), floor.CFrame * CFrame.new(-2, THICK / 2 + 0.15, 0), Color3.fromRGB(255, 240, 150), Enum.Material.Neon)
	pad.Name = "FinishPad"
	CollectionService:AddTag(pad, opts.tag)

	local spawnCf = CFrame.lookAt(floor.Position + Vector3.new(-6, 5, 0), floor.Position + Vector3.new(10, 5, 0))
	return pad, spawnCf
end

-- بحر حمم تحت المسار كامل
local function buildLavaSea(root: Instance, fromX: number, toX: number, z: number, width: number)
	local chunk = 512
	local x = fromX
	while x < toX do
		local len = math.min(chunk, toX - x)
		local sea = makePart(root, Vector3.new(len, 1, width), CFrame.new(x + len / 2, 0, z), LAVA_COLOR, Enum.Material.Neon)
		sea.Name = "LavaSea"
		sea.Transparency = 0.15
		CollectionService:AddTag(sea, "Kill")
		x += len
	end
end

local function runSegments(ctx: Ctx, segments)
	for _, segment in segments do
		local build = Segments[segment.type]
		if build then
			build(ctx, segment)
		else
			warn("نوع عقبة غير معروف:", segment.type)
		end
	end
end

export type CoopCourse = {
	checkpoints: { CFrame },
	checkpointPads: { BasePart },
	finishPad: BasePart,
	finishSpawn: CFrame,
	bridges: { BridgeGroup },
}

local function buildCoopCourse(root: Instance): CoopCourse
	local coopRoot = Instance.new("Folder")
	coopRoot.Name = "Coop"
	coopRoot.Parent = root

	local ctx: Ctx = {
		x = 0,
		y = START_Y,
		z = Config.Coop.courseZ,
		folder = coopRoot,
		gapScale = 1,
		colors = Config.Coop.colors,
		count = 0,
		bridges = {},
	}

	local checkpoints = {}
	local checkpointPads = {}
	for stage, def in Config.Coop.stages do
		local folder = Instance.new("Folder")
		folder.Name = string.format("CoopStage%02d", stage)
		folder.Parent = coopRoot
		ctx.folder = folder
		local gap = if stage == 1 then 0 else 4
		checkpointPads[stage], checkpoints[stage] = buildCheckpoint(ctx, stage, gap, { tag = "CoopCheckpoint", width = 12 })
		if stage == 1 then
			buildWorldSign(
				folder,
				Vector3.new(ctx.x - 5, ctx.y + 14, ctx.z),
				Config.Coop.icon .. " " .. Config.Coop.name,
				Config.Coop.desc,
				Config.Coop.colors[1]
			)
		end
		runSegments(ctx, def.segments)
	end

	local finishPad, finishSpawn = buildFinish(coopRoot, ctx, { name = "CoopFinish", tag = "CoopFinish", text = "🪢🏆 خلّصتوا!" })
	buildLavaSea(coopRoot, -40, ctx.x + 60, ctx.z, 160)

	return {
		checkpoints = checkpoints,
		checkpointPads = checkpointPads,
		finishPad = finishPad,
		finishSpawn = finishSpawn,
		bridges = ctx.bridges,
	}
end

export type Course = {
	lobby: Lobby,
	checkpoints: { CFrame },
	checkpointPads: { BasePart },
	finishPad: BasePart,
	finishSpawn: CFrame,
	coop: CoopCourse,
}

function CourseBuilder.build(): Course
	local root = Instance.new("Folder")
	root.Name = "Course"
	root.Parent = Workspace

	local ctx: Ctx = {
		x = 0,
		y = START_Y,
		z = 0,
		folder = root,
		gapScale = 1,
		colors = Config.Worlds[1].colors,
		count = 0,
		bridges = {},
	}

	local lobby = buildLobby(root, ctx)
	local checkpoints = {}
	local checkpointPads = {}

	for stage, def in Config.Stages do
		local folder = Instance.new("Folder")
		folder.Name = string.format("Stage%02d", stage)
		folder.Parent = root
		ctx.folder = folder

		-- الفراغ قبل نقطة الحفظ يتبع العالم اللي قبلها (لأن اللاعب لسا فيه)
		local gap = if stage == 1 then 0 else scaled(ctx, 4)
		checkpointPads[stage], checkpoints[stage] = buildCheckpoint(ctx, stage, gap, { tag = "Checkpoint", width = 10 })

		local world = Config.Worlds[def.world]
		ctx.gapScale = world.gapScale or 1
		ctx.colors = world.colors
		if Config.isWorldStart(stage) then
			buildWorldSign(
				folder,
				Vector3.new(ctx.x - 5, ctx.y + 14, 0),
				string.format("%s العالم %d: %s", world.icon, def.world, world.name),
				world.desc,
				world.colors[1]
			)
		end

		runSegments(ctx, def.segments)
	end

	local finishPad, finishSpawn = buildFinish(root, ctx, { name = "Finish", tag = "Finish", text = "🏆 النهاية!" })
	buildLavaSea(root, -80, ctx.x + 60, 0, 400)

	return {
		lobby = lobby,
		checkpoints = checkpoints,
		checkpointPads = checkpointPads,
		finishPad = finishPad,
		finishSpawn = finishSpawn,
		coop = buildCoopCourse(root),
	}
end

return CourseBuilder
