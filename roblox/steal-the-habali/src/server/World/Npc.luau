-- شخصية بثوب وشماغ وعقال، مع اسمها فوق راسها. البياعين في الديرة وناس البر كلهم منها.

local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")

local Npc = {}

local SKIN = Color3.fromRGB(198, 150, 110)
local THOBE = Color3.fromRGB(245, 245, 240)

export type Options = {
	Name: string,
	Title: string,
	Thobe: Color3?, -- لون الثوب (أبيض لو ما انعطى)
	Shemagh: Color3?, -- لون الشماغ (أحمر لو ما انعطى)
	Anchored: boolean?, -- false = يمشي (الراعي)
}

local function attach(head: BasePart, part: BasePart)
	part.Anchored = false
	part.CanCollide = false
	part.Massless = true
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = head
	weld.Part1 = part
	weld.Parent = part
end

local function piece(name: string, size: Vector3, cframe: CFrame, color: Color3, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Material = Enum.Material.Fabric
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

-- cframe = مكان الرجلين ويطالع قدام. يرجّع الموديل والـ HumanoidRootPart
function Npc.Build(options: Options, cframe: CFrame, parent: Instance): (Model?, BasePart?)
	local thobe = options.Thobe or THOBE
	local description = Instance.new("HumanoidDescription")
	description.HeadColor = SKIN
	description.LeftArmColor = SKIN
	description.RightArmColor = SKIN
	description.TorsoColor = thobe
	description.LeftLegColor = thobe
	description.RightLegColor = thobe
	local ok, rig = pcall(function()
		return Players:CreateHumanoidModelFromDescription(description, Enum.HumanoidRigType.R15)
	end)
	if not ok or not rig then
		warn("[Npc] ما قدرنا نسوي", options.Name, rig)
		return nil, nil
	end
	rig.Name = options.Name
	local humanoid = rig:FindFirstChildOfClass("Humanoid") :: Humanoid
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	local root = rig:FindFirstChild("HumanoidRootPart") :: BasePart
	root.Anchored = options.Anchored ~= false
	rig:PivotTo(cframe * CFrame.new(0, humanoid.HipHeight + root.Size.Y / 2, 0))
	-- الشماغ والعقال الأسود فوقه
	local head = rig:FindFirstChild("Head") :: BasePart?
	if head then
		attach(head, piece("Shemagh", Vector3.new(1.5, 0.5, 1.5), head.CFrame * CFrame.new(0, head.Size.Y / 2, 0), options.Shemagh or Color3.fromRGB(200, 30, 40), rig))
		attach(head, piece("ShemaghBack", Vector3.new(1.6, 1.6, 0.25), head.CFrame * CFrame.new(0, 0.1, 0.7), Color3.fromRGB(235, 235, 235), rig))
		local meshes = ServerStorage:FindFirstChild("GearMeshes")
		local agal = meshes and meshes:FindFirstChild("Agal")
		if agal and agal:IsA("BasePart") then
			local ring = agal:Clone()
			ring.Size = ring.Size * 0.55
			ring.CFrame = head.CFrame * CFrame.new(0, head.Size.Y / 2 + 0.25, 0) * CFrame.Angles(math.rad(90), 0, 0)
			ring.Parent = rig
			attach(head, ring)
		end
	end
	-- الاسم فوق الراس
	local board = Instance.new("BillboardGui")
	board.Name = "NameTag"
	board.Size = UDim2.fromOffset(220, 60)
	board.StudsOffsetWorldSpace = Vector3.new(0, 3.2, 0)
	board.MaxDistance = 90
	board.Adornee = root
	board.Parent = root
	for i, text in { options.Name, options.Title } do
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 0.5)
		label.Position = UDim2.fromScale(0, (i - 1) * 0.5)
		label.BackgroundTransparency = 1
		label.TextScaled = true
		label.Font = if i == 1 then Enum.Font.GothamBlack else Enum.Font.GothamBold
		label.TextColor3 = if i == 1 then Color3.fromRGB(255, 225, 120) else Color3.new(1, 1, 1)
		label.TextStrokeTransparency = 0.3
		label.Text = text
		label.Parent = board
	end
	rig.Parent = parent
	return rig, root
end

-- زر "اضغط" عند الشخصية
function Npc.Prompt(root: BasePart, name: string, action: string, object: string, distance: number): ProximityPrompt
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = name
	prompt.ActionText = action
	prompt.ObjectText = object
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = distance
	prompt.RequiresLineOfSight = false
	prompt.Parent = root
	return prompt
end

return Npc
