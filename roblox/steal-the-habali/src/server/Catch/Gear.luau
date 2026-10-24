-- العدّة في يد اللاعب: وحدة بس في اليد اليمين. العقال افتراضي، والمسدس يطلع لما يطلق
-- وبعدها يرجع العقال. شكل بس (بدون وزن ولا اصطدام)، والسيرفر يحطها عشان الكل يشوفها.
-- المجسمات في ServerStorage.GearMeshes (Agal و DartGun، مسوية بـ AI حق Studio):
--   Agal: حلقة مسطحة في XY المحلي (سماكتها على Z).  DartGun: الماسورة على -Z المحلي وفوقه +Y.
-- لو المجسمات مو موجودة نرجع لقطع بسيطة.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local ShopConfig = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("ShopConfig"))

local Gear = {}

local GUN_TIME = 2.5 -- كم ثانية يبقى المسدس في اليد بعد الطلقة

local holdToken: { [Model]: number } = {}

local function setup(part: BasePart, name: string)
	part.Name = name
	part.Anchored = false
	part.Massless = true
	part.CanCollide = false
	part.CanQuery = false
	part.CanTouch = false
	part.CastShadow = false
end

local function attach(hand: BasePart, part: BasePart, offset: CFrame, parent: Instance)
	part.CFrame = hand.CFrame * offset
	part.Parent = parent
	local weld = Instance.new("Weld")
	weld.Part0 = hand
	weld.Part1 = part
	weld.C0 = offset
	weld.Parent = part
end

local function block(name: string, size: Vector3, color: Color3, material: Enum.Material): Part
	local part = Instance.new("Part")
	part.Size = size
	part.Color = color
	part.Material = material
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	setup(part, name)
	return part
end

local function template(name: string): BasePart?
	local folder = ServerStorage:FindFirstChild("GearMeshes")
	local found = folder and folder:FindFirstChild(name)
	return if found and found:IsA("BasePart") then found:Clone() else nil
end

local function setVisible(part: Instance?, visible: boolean)
	if part and part:IsA("BasePart") then
		part.Transparency = if visible then 0 else 1
	end
end

-- شكل الليفل لو ما عندنا مجسم خاص فيه: نلوّن المجسم الأساسي (قطعة واحدة)
local LOOKS: { [string]: { Color: Color3, Material: Enum.Material, Scale: number } } = {
	Agal2 = { Color = Color3.fromRGB(70, 55, 20), Material = Enum.Material.Fabric, Scale = 1.05 }, -- مقصّب: خيوط ذهبية
	Slipper = { Color = Color3.fromRGB(40, 140, 220), Material = Enum.Material.Plastic, Scale = 1.0 },
	Agal4 = { Color = Color3.fromRGB(255, 200, 45), Material = Enum.Material.Foil, Scale = 1.1 }, -- العقال الذهبي
	DartRifle = { Color = Color3.fromRGB(60, 80, 55), Material = Enum.Material.Metal, Scale = 1.35 },
	SleepLauncher = { Color = Color3.fromRGB(230, 120, 40), Material = Enum.Material.SmoothPlastic, Scale = 1.5 },
}

-- المجسم حق الليفل (لو موجود في GearMeshes)، وإلا الأساسي ملوّن بشكل الليفل
local function meshFor(meshName: string?, baseName: string): BasePart?
	local exact = meshName and template(meshName)
	if exact then
		return exact
	end
	local part = template(baseName)
	local look = meshName and LOOKS[meshName]
	if part and look then
		if part:IsA("MeshPart") then
			part.TextureID = "" -- بدون التكستشر عشان يبان اللون
		end
		part.Color = look.Color
		part.Material = look.Material
		part.Size *= look.Scale
	end
	return part
end

-- يشيل العدّة القديمة ويركّب حق الليفلات الجديدة (بعد الشراء)
function Gear.Refresh(character: Model, gear: any)
	local holding = character:GetAttribute("Holding")
	local old = character:FindFirstChild("HuntGear")
	if old then
		old:Destroy()
	end
	Gear.Equip(character, gear)
	if holding == "Gun" then
		Gear.Hold(character, "Gun")
	end
end

-- gear (اختياري): ليفلات اللاعب من Loadout، عشان يطلع شكل سلاحه
function Gear.Equip(character: Model, gear: any?)
	if not character.Parent or character:FindFirstChild("HuntGear") then
		return
	end
	local meleeMesh = gear and ShopConfig.Melee[gear.Melee] and ShopConfig.Melee[gear.Melee].Mesh
	local gunMesh = gear and ShopConfig.Gun[gear.Gun] and ShopConfig.Gun[gear.Gun].Mesh
	local hand = (character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm")) :: BasePart?
	if not hand then
		return
	end
	local folder = Instance.new("Model")
	folder.Name = "HuntGear"
	folder.Parent = character
	folder.Destroying:Connect(function()
		holdToken[character] = nil
	end)
	-- نقطة المسكة: آخر الكف (اتجاه الذراع هو -Y حق اليد)
	local grip = CFrame.new(0, -hand.Size.Y / 2, 0)

	-- العقال: نمسكه من فوق ويتدلى، والحلقة في مستوى الضربة (قدام/ورا)
	local agal = meshFor(meleeMesh, "Agal")
	local tipPosition, bottomPosition
	if agal and agal:GetAttribute("Grip") == "Heel" then
		-- الشبشب: نمسكه من الكعب (+Z المحلي) وطرفه (-Z) على امتداد الذراع
		setup(agal, "Agal")
		local length = agal.Size.Z
		attach(hand, agal, grip * CFrame.Angles(math.rad(-90), 0, 0) * CFrame.new(0, 0, -(length / 2 - 0.15)), folder)
		tipPosition, bottomPosition = Vector3.new(0, 0, length * 0.2), Vector3.new(0, 0, -length / 2)
	elseif agal then
		setup(agal, "Agal")
		attach(hand, agal, grip * CFrame.Angles(0, math.rad(90), 0) * CFrame.new(0, -agal.Size.Y / 2 + 0.1, 0), folder)
		tipPosition, bottomPosition = Vector3.new(0, -agal.Size.Y * 0.1, 0), Vector3.new(0, -agal.Size.Y / 2, 0)
	else
		agal = block("Agal", Vector3.new(0.3, 1.3, 0.3), Color3.fromRGB(20, 20, 22), Enum.Material.Fabric)
		attach(hand, agal, grip * CFrame.new(0, -0.65, 0), folder)
		tipPosition, bottomPosition = Vector3.new(0, 0.5, 0), Vector3.new(0, -0.65, 0)
	end
	local tip = Instance.new("Attachment")
	tip.Name = "TrailTop"
	tip.Position = tipPosition
	tip.Parent = agal
	local bottom = Instance.new("Attachment")
	bottom.Name = "TrailBottom"
	bottom.Position = bottomPosition
	bottom.Parent = agal

	-- المسدس: الماسورة على امتداد الذراع، والمقبض في الكف (المقبض ورا وتحت نص المجسم)
	local gun = meshFor(gunMesh, "DartGun")
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	if gun then
		setup(gun, "DartGun")
		-- بعض المجسمات ماسورتها على +X بدال -Z: ForwardYaw يلفها (90 = من +X لـ -Z)
		local yaw = gun:GetAttribute("ForwardYaw") or 0
		local length = if yaw ~= 0 then gun.Size.X else gun.Size.Z
		local height = gun.Size.Y
		attach(hand, gun, grip * CFrame.Angles(math.rad(-90), 0, 0) * CFrame.new(0, height * 0.28, -length * 0.3) * CFrame.Angles(0, math.rad(yaw), 0), folder)
		muzzle.Position = if yaw ~= 0 then Vector3.new(length / 2, height * 0.18, 0) else Vector3.new(0, height * 0.18, -length / 2)
	else
		gun = block("DartGun", Vector3.new(0.3, 0.5, 1.3), Color3.fromRGB(70, 72, 78), Enum.Material.Metal)
		attach(hand, gun, grip * CFrame.Angles(math.rad(-90), 0, 0) * CFrame.new(0, 0.15, -0.4), folder)
		muzzle.Position = Vector3.new(0, 0.1, -0.65)
	end
	muzzle.Parent = gun
	Gear.Hold(character, "Agal")
end

-- "Agal" أو "Gun". المسدس يرجع عقال لحاله بعد GUN_TIME
function Gear.Hold(character: Model, which: string)
	local folder = character:FindFirstChild("HuntGear")
	if not folder then
		return
	end
	setVisible(folder:FindFirstChild("Agal"), which == "Agal")
	setVisible(folder:FindFirstChild("DartGun"), which == "Gun")
	character:SetAttribute("Holding", which)
	local token = (holdToken[character] or 0) + 1
	holdToken[character] = token
	if which == "Gun" then
		task.delay(GUN_TIME, function()
			if holdToken[character] == token and character.Parent then
				Gear.Hold(character, "Agal")
			end
		end)
	end
end

return Gear
