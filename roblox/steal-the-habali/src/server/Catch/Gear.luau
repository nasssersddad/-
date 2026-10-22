-- العدّة في يد اللاعب: وحدة بس في اليد اليمين. العقال افتراضي، والمسدس يطلع لما يطلق
-- وبعدها يرجع العقال. شكل بس (بدون وزن ولا اصطدام)، والسيرفر يحطها عشان الكل يشوفها.
-- المجسمات في ServerStorage.GearMeshes (Agal و DartGun، مسوية بـ AI حق Studio):
--   Agal: حلقة مسطحة في XY المحلي (سماكتها على Z).  DartGun: الماسورة على -Z المحلي وفوقه +Y.
-- لو المجسمات مو موجودة نرجع لقطع بسيطة.

local ServerStorage = game:GetService("ServerStorage")

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

function Gear.Equip(character: Model)
	if not character.Parent or character:FindFirstChild("HuntGear") then
		return
	end
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
	local agal = template("Agal")
	if agal then
		setup(agal, "Agal")
		attach(hand, agal, grip * CFrame.Angles(0, math.rad(90), 0) * CFrame.new(0, -agal.Size.Y / 2 + 0.1, 0), folder)
	else
		agal = block("Agal", Vector3.new(0.3, 1.3, 0.3), Color3.fromRGB(20, 20, 22), Enum.Material.Fabric)
		attach(hand, agal, grip * CFrame.new(0, -0.65, 0), folder)
	end
	local tip = Instance.new("Attachment")
	tip.Name = "TrailTop"
	tip.Position = Vector3.new(0, -agal.Size.Y * 0.1, 0)
	tip.Parent = agal
	local bottom = Instance.new("Attachment")
	bottom.Name = "TrailBottom"
	bottom.Position = Vector3.new(0, -agal.Size.Y / 2, 0)
	bottom.Parent = agal

	-- المسدس: الماسورة على امتداد الذراع، والمقبض في الكف (المقبض ورا وتحت نص المجسم)
	local gun = template("DartGun")
	local muzzle = Instance.new("Attachment")
	muzzle.Name = "Muzzle"
	if gun then
		setup(gun, "DartGun")
		local length, height = gun.Size.Z, gun.Size.Y
		attach(hand, gun, grip * CFrame.Angles(math.rad(-90), 0, 0) * CFrame.new(0, height * 0.28, -length * 0.3), folder)
		muzzle.Position = Vector3.new(0, height * 0.18, -length / 2)
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
