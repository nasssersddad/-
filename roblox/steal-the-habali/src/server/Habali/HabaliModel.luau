-- شكل الهبالي المؤقت: بلوكات ملونة، واسمه وندرته فوق راسه.
-- النادر وفوق يلمع بلون ندرته، والذهبي والدايموند يتغير لونهم ويلمعون.
-- المجسمات الحقيقية تجي بعدين، فخلّيناه خفيف (كم قطعة بس) عشان الجوال.

local HabaliModel = {}

-- ارتفاع القطعة الأساسية (Root) عن الأرض. الموديل كله ينحسب منها
HabaliModel.RootHeight = 0.5

type PartSpec = { Name: string, Size: { number }, Offset: { number }, Color: { number }, Shape: string? }

-- كل شخصية: قطع بمقاسها ومكانها من Root (X يمين، Y فوق، Z ورا)
local SHAPES: { [string]: { PartSpec } } = {
	-- جمل راسه ثلاجة
	Jamaloni = {
		{ Name = "Body", Size = { 3, 3, 5 }, Offset = { 0, 3, 0.5 }, Color = { 196, 150, 96 } },
		{ Name = "Hump", Size = { 2.4, 1.4, 2 }, Offset = { 0, 5.2, 1 }, Color = { 176, 132, 82 } },
		{ Name = "Neck", Size = { 1.2, 2.4, 1.2 }, Offset = { 0, 4.6, -2.4 }, Color = { 196, 150, 96 } },
		{ Name = "Fridge", Size = { 2.4, 3, 2 }, Offset = { 0, 6.6, -2.8 }, Color = { 235, 240, 245 } },
		{ Name = "Legs", Size = { 2.6, 1.6, 4.2 }, Offset = { 0, 0.8, 0.5 }, Color = { 150, 112, 72 } },
	},
	-- دلّة قهوة بجزمة عسكرية
	Dalla = {
		{ Name = "Body", Size = { 3, 3.6, 3 }, Offset = { 0, 3.4, 0 }, Color = { 214, 170, 70 }, Shape = "Cylinder" },
		{ Name = "Lid", Size = { 1.6, 1.2, 1.6 }, Offset = { 0, 5.8, 0 }, Color = { 230, 190, 90 } },
		{ Name = "Spout", Size = { 0.7, 0.7, 2.4 }, Offset = { 0, 4.4, -2.2 }, Color = { 214, 170, 70 } },
		{ Name = "Boots", Size = { 3.2, 1.6, 3.6 }, Offset = { 0, 0.8, -0.2 }, Color = { 80, 90, 50 } },
	},
	-- شاورما بأجنحة طيارة
	Shawarma = {
		{ Name = "Body", Size = { 2.6, 2.6, 5.2 }, Offset = { 0, 3, 0 }, Color = { 222, 180, 120 } },
		{ Name = "Filling", Size = { 2, 0.6, 4.6 }, Offset = { 0, 4.5, 0 }, Color = { 170, 90, 50 } },
		{ Name = "Wings", Size = { 8, 0.4, 1.8 }, Offset = { 0, 3.2, 0.2 }, Color = { 150, 155, 165 } },
		{ Name = "Tail", Size = { 2.4, 1.6, 0.4 }, Offset = { 0, 4, 2.6 }, Color = { 150, 155, 165 } },
		{ Name = "Feet", Size = { 1.8, 1.7, 1.8 }, Offset = { 0, 0.85, 0 }, Color = { 120, 80, 50 } },
	},
}

local function rgb(values: { number }): Color3
	return Color3.fromRGB(values[1], values[2], values[3])
end

local function newPart(name: string, size: Vector3, cframe: CFrame, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Anchored = true
	part.CanCollide = false
	part.CanTouch = false
	part.CastShadow = false
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

export type BuildParams = {
	CharacterId: string,
	DisplayName: string,
	RarityText: string,
	RarityColor: { number },
	Glow: boolean,
	Variant: { Color: { number }, Material: string, DisplayName: string }?,
	LabelDistance: number,
	Beam: number?, -- طول عمود النور (للهوك) أو nil
	BeamWidth: number?,
}

-- يرجّع الموديل وقائمة قطعه (عشان السيرفر يحركها كلها بدفعة وحدة)
function HabaliModel.Build(params: BuildParams): (Model, { BasePart })
	local model = Instance.new("Model")
	model.Name = params.CharacterId
	local parts = {}

	local root = newPart("Root", Vector3.new(1, 1, 1), CFrame.new(0, HabaliModel.RootHeight, 0), model)
	root.Transparency = 1
	root.CanQuery = true -- مرحلة الصيد بتحتاج تلقاه بالـ raycast
	model.PrimaryPart = root
	table.insert(parts, root)

	local variant = params.Variant
	for _, spec in SHAPES[params.CharacterId] or SHAPES.Jamaloni do
		local offset = Vector3.new(spec.Offset[1], spec.Offset[2], spec.Offset[3])
		local part = newPart(spec.Name, Vector3.new(spec.Size[1], spec.Size[2], spec.Size[3]), CFrame.new(offset), model)
		if spec.Shape == "Cylinder" then
			-- الأسطوانة في روبلوكس على محور X، فندورها عشان توقف
			part.Shape = Enum.PartType.Cylinder
			part.Size = Vector3.new(spec.Size[2], spec.Size[1], spec.Size[3])
			part.CFrame = CFrame.new(offset) * CFrame.Angles(0, 0, math.rad(90))
		end
		if variant then
			part.Color = rgb(variant.Color)
			part.Material = Enum.Material[variant.Material]
			part.Reflectance = 0.25
		else
			part.Color = rgb(spec.Color)
			part.Material = Enum.Material.SmoothPlastic
		end
		table.insert(parts, part)
	end

	local rarityColor = rgb(params.RarityColor)
	if params.Glow then
		-- حلقة نيون تحت رجوله بلون الندرة، ونور حوله
		local halo = newPart("Halo", Vector3.new(0.3, 9, 9), CFrame.new(0, 0.2, 0) * CFrame.Angles(0, 0, math.rad(90)), model)
		halo.Shape = Enum.PartType.Cylinder
		halo.Material = Enum.Material.Neon
		halo.Color = rarityColor
		halo.Transparency = 0.35
		table.insert(parts, halo)

		local light = Instance.new("PointLight")
		light.Color = rarityColor
		light.Range = 14
		light.Brightness = 2
		light.Parent = root
	end
	if variant then
		local sparkles = Instance.new("Sparkles")
		sparkles.SparkleColor = rgb(variant.Color)
		sparkles.Parent = root
	end
	if params.Beam then
		-- عمود نور طويل ينشاف من بعيد
		-- لونه أفتح من لون الندرة عشان ما يضيع في السما الزرقا
		local width = params.BeamWidth or 8
		local beam = newPart("Beam", Vector3.new(width, params.Beam, width), CFrame.new(0, params.Beam / 2 + 6, 0), model)
		beam.Material = Enum.Material.Neon
		beam.Color = rarityColor:Lerp(Color3.new(1, 1, 1), 0.45)
		beam.Transparency = 0.15
		table.insert(parts, beam)
	end

	local gui = Instance.new("BillboardGui")
	gui.Name = "Label"
	gui.Adornee = root
	gui.StudsOffsetWorldSpace = Vector3.new(0, 10, 0)
	gui.MaxDistance = params.LabelDistance
	gui.LightInfluence = 0
	if params.Beam then
		-- الهوك ينقرا من بعيد: مقاس ثابت بالبكسل وفوق كل شي
		gui.Size = UDim2.fromOffset(220, 60)
		gui.AlwaysOnTop = true
	else
		-- مقاس ثابت بالبكسل عشان ينقرا في الجوال، و MaxDistance يخفيه لما تبعد
		gui.Size = UDim2.fromOffset(170, 46)
	end
	gui.Parent = root

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "Title" -- مو "Name" عشان ما يتلخبط مع خاصية Name
	nameLabel.Size = UDim2.fromScale(1, 0.55)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = params.DisplayName
	nameLabel.TextScaled = true
	nameLabel.Font = Enum.Font.GothamBlack
	nameLabel.TextColor3 = Color3.fromRGB(255, 250, 240)
	nameLabel.TextStrokeTransparency = 0.2
	nameLabel.Parent = gui

	local rarityLabel = Instance.new("TextLabel")
	rarityLabel.Name = "Rarity"
	rarityLabel.Position = UDim2.fromScale(0, 0.55)
	rarityLabel.Size = UDim2.fromScale(1, 0.45)
	rarityLabel.BackgroundTransparency = 1
	rarityLabel.Text = if variant then params.RarityText .. " · " .. variant.DisplayName else params.RarityText
	rarityLabel.TextScaled = true
	rarityLabel.Font = Enum.Font.GothamBold
	rarityLabel.TextColor3 = if variant then rgb(variant.Color) else rarityColor
	rarityLabel.TextStrokeTransparency = 0.2
	rarityLabel.Parent = gui

	-- الجوال يحمّل الموديل كامل أو ما يحمّله (ما يطلع نص هبالي)
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	return model, parts
end

return HabaliModel
