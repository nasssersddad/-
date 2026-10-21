-- العدّة في يد اللاعب: العقال في اليمين، ومسدس التنويم في اليسار.
-- شكل بس (بدون وزن ولا اصطدام)، والسيرفر يحطها عشان كل اللاعبين يشوفونها.

local Gear = {}

local function weldPart(hand: BasePart, parent: Instance, name: string, size: Vector3, offset: CFrame, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Color = color
	part.Material = material
	part.Massless = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.CFrame = hand.CFrame * offset
	part.Parent = parent
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = hand
	weld.Part1 = part
	weld.Parent = part
	return part
end

local function hand(character: Model, r15: string, r6: string): BasePart?
	return (character:FindFirstChild(r15) or character:FindFirstChild(r6)) :: BasePart?
end

function Gear.Equip(character: Model)
	if not character.Parent or character:FindFirstChild("HuntGear") then
		return
	end
	local right = hand(character, "RightHand", "Right Arm")
	local left = hand(character, "LeftHand", "Left Arm")
	if not right or not left then
		return
	end
	local folder = Instance.new("Model")
	folder.Name = "HuntGear"
	folder.Parent = character

	-- العقال: حلقة سودا من 10 قطع صغيرة، متدلية من اليد
	local black = Color3.fromRGB(20, 20, 22)
	local below = right.Size.Y / 2 + 0.7
	for i = 0, 9 do
		local angle = i / 10 * math.pi * 2
		local offset = CFrame.new(0, -below, 0) * CFrame.Angles(angle, 0, 0) * CFrame.new(0, 0, 0.6)
		weldPart(right, folder, "Agal", Vector3.new(0.22, 0.4, 0.22), offset, black, Enum.Material.Fabric)
	end

	-- مسدس التنويم: جسم أزرق وماسورة فاتحة
	local gunBase = CFrame.new(0, -left.Size.Y / 2 - 0.2, -0.3)
	weldPart(left, folder, "GunBody", Vector3.new(0.35, 0.5, 1.1), gunBase, Color3.fromRGB(60, 110, 220), Enum.Material.SmoothPlastic)
	local barrel = weldPart(left, folder, "GunBarrel", Vector3.new(0.7, 0.22, 0.22), gunBase * CFrame.new(0, 0.1, -0.8) * CFrame.Angles(0, math.rad(90), 0), Color3.fromRGB(150, 230, 255), Enum.Material.Neon)
	barrel.Shape = Enum.PartType.Cylinder
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	muzzle.Position = Vector3.new(0.35, 0, 0)
	muzzle.Parent = barrel
end

return Gear
