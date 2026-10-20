-- شكل سيارة الربع وفيزياءها: هيكل، كبينة، حوض ورا، 4 كفرات بمساعدات.
-- كل الكفرات تمشي (دفع رباعي عشان الرمل)، والقدام تلف.
-- الأرقام اللي تحتاج ضبط مع التجربة (العزم، المساعدات) فوق في TUNING.

local CarModel = {}

-- القدام = -Z، اليمين = +X، والأصل على الأرض تحت نص السيارة
local TUNING = {
	WheelRadius = 1.6,
	WheelWidth = 1.2,
	WheelX = 3.9,
	WheelZ = 5.2,
	ChassisSize = Vector3.new(6.5, 1.2, 15),
	ChassisY = 2.6,
	ChassisDensity = 1.2,
	WheelDensity = 0.8,
	WheelFriction = 1.4,
	SuspensionTravel = 0.8, -- كم يطلع وينزل الكفر
	SuspensionSag = 0.45, -- كم تنزل السيارة على المساعدات وهي واقفة
	SuspensionDampingRatio = 0.35,
	MotorTorque = 30000,
	BrakeTorque = 12000,
	SteerSpeed = 5, -- راديان بالثانية
	SteerTorque = 50000,
}
CarModel.Tuning = TUNING

local WHITE = Color3.fromRGB(236, 236, 230)
local GLASS = Color3.fromRGB(120, 160, 190)
local DARK = Color3.fromRGB(40, 40, 44)

local function newPart(name: string, size: Vector3, cframe: CFrame, color: Color3, parent: Instance): Part
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.CFrame = cframe
	part.Color = color
	part.Material = Enum.Material.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function attach(name: string, part: BasePart, worldCFrame: CFrame): Attachment
	local attachment = Instance.new("Attachment")
	attachment.Name = name
	attachment.Parent = part
	attachment.WorldCFrame = worldCFrame
	return attachment
end

-- الهيكل والجسم: كل قطع الجسم ملحومة بالهيكل وبدون وزن (الوزن كله في الهيكل)
local function body(chassis: BasePart, model: Model, name: string, size: Vector3, offset: Vector3, color: Color3): Part
	local part = newPart(name, size, chassis.CFrame * CFrame.new(offset - Vector3.new(0, TUNING.ChassisY, 0)), color, model)
	part.Massless = true
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = chassis
	weld.Part1 = part
	weld.Parent = part
	return part
end

export type Wheel = {
	Part: BasePart,
	Axle: CylindricalConstraint,
	Steer: HingeConstraint?,
	Side: number, -- -1 يسار، 1 يمين
}

-- اتجاه المساعدات: محور X للمرفق فوق (السلايدر)، ومحور Y على جنب (محور الكفر)
local SUSPENSION_ROTATION = CFrame.fromMatrix(Vector3.zero, Vector3.yAxis, Vector3.xAxis)

local function wheel(model: Model, chassis: BasePart, x: number, z: number, steer: boolean): Wheel
	local center = chassis.CFrame * CFrame.new(x, TUNING.WheelRadius - TUNING.ChassisY, z)
	local tire = newPart(if steer then "FrontWheel" else "RearWheel", Vector3.new(TUNING.WheelWidth, TUNING.WheelRadius * 2, TUNING.WheelRadius * 2), center, DARK, model)
	tire.Shape = Enum.PartType.Cylinder
	tire.Material = Enum.Material.Rubber
	tire.CustomPhysicalProperties = PhysicalProperties.new(TUNING.WheelDensity, TUNING.WheelFriction, 0, 100, 1)

	local mount: BasePart = chassis
	local steerHinge: HingeConstraint? = nil
	if steer then
		-- مفصل اللف: قطعة صغيرة بين الهيكل والكفر تدور حول محور عمودي
		local knuckle = newPart("Knuckle", Vector3.new(0.6, 0.6, 0.6), center, DARK, model)
		knuckle.CanCollide = false
		knuckle.Transparency = 1
		knuckle.CustomPhysicalProperties = PhysicalProperties.new(0.7, 0.3, 0, 1, 1)
		local hinge = Instance.new("HingeConstraint")
		hinge.Attachment0 = attach("SteerChassis", chassis, center * SUSPENSION_ROTATION)
		hinge.Attachment1 = attach("SteerKnuckle", knuckle, center * SUSPENSION_ROTATION)
		hinge.ActuatorType = Enum.ActuatorType.Servo
		hinge.AngularSpeed = TUNING.SteerSpeed
		hinge.ServoMaxTorque = TUNING.SteerTorque
		hinge.LimitsEnabled = true
		hinge.LowerAngle = -45
		hinge.UpperAngle = 45
		hinge.Parent = knuckle
		mount = knuckle
		steerHinge = hinge
	end

	local axle = Instance.new("CylindricalConstraint")
	axle.Attachment0 = attach("Axle0", mount, center * SUSPENSION_ROTATION)
	-- مرفق الكفر: محور X هو محور الدوران (يمين)، مثل اتجاه الأسطوانة نفسها
	axle.Attachment1 = attach("Axle1", tire, center)
	axle.InclinationAngle = 90 -- محور الدوران على جنب (عمودي على السلايدر)
	axle.LimitsEnabled = true
	axle.LowerLimit = -TUNING.SuspensionTravel
	axle.UpperLimit = TUNING.SuspensionTravel
	axle.AngularActuatorType = Enum.ActuatorType.Motor
	axle.MotorMaxTorque = TUNING.BrakeTorque
	axle.AngularVelocity = 0
	axle.Parent = tire

	-- المساعد: سبرنق من الهيكل لنص الكفر
	local spring = Instance.new("SpringConstraint")
	spring.Name = "Suspension"
	spring.Attachment0 = attach("SpringTop", chassis, center * CFrame.new(0, 2, 0))
	spring.Attachment1 = attach("SpringBottom", tire, center)
	spring.FreeLength = 2 + TUNING.SuspensionSag
	spring.Parent = tire

	-- الكفر ما يصطدم بالهيكل
	local noCollide = Instance.new("NoCollisionConstraint")
	noCollide.Part0 = tire
	noCollide.Part1 = chassis
	noCollide.Parent = tire

	return { Part = tire, Axle = axle, Steer = steerHinge, Side = if x < 0 then -1 else 1 }
end

export type Car = {
	Model: Model,
	Chassis: BasePart,
	Seat: VehicleSeat,
	Bed: BasePart,
	LoadPrompt: ProximityPrompt,
	Slots: { Attachment },
	Wheels: { Wheel },
}

-- يبني السيارة عند cframe (على الأرض). الموديل ما ينحط في Workspace هنا
function CarModel.Build(cframe: CFrame, ownerName: string, slots: number): Car
	local model = Instance.new("Model")
	model.Name = "Ruba_" .. ownerName

	local chassis = newPart("Chassis", TUNING.ChassisSize, cframe * CFrame.new(0, TUNING.ChassisY, 0), WHITE, model)
	chassis.CustomPhysicalProperties = PhysicalProperties.new(TUNING.ChassisDensity, 0.3, 0, 1, 1)
	model.PrimaryPart = chassis

	local top = TUNING.ChassisY + TUNING.ChassisSize.Y / 2
	local half = TUNING.ChassisSize.Z / 2
	-- الكبوت، والكبينة (سقف وقزاز وجدار ورا)، والحوض
	body(chassis, model, "Hood", Vector3.new(6.5, 1.4, 2.3), Vector3.new(0, top + 0.7, -half + 1.15), WHITE)
	body(chassis, model, "Roof", Vector3.new(6.5, 0.4, 4.2), Vector3.new(0, top + 4.4, -3.1), WHITE)
	local windshield = body(chassis, model, "Windshield", Vector3.new(6.1, 3.8, 0.2), Vector3.new(0, top + 2.4, -5.15), GLASS)
	windshield.Transparency = 0.5
	body(chassis, model, "CabBack", Vector3.new(6.5, 4.2, 0.4), Vector3.new(0, top + 2.1, -1.0), WHITE)
	for _, x in { -3.05, 3.05 } do
		body(chassis, model, "Pillar", Vector3.new(0.4, 4.2, 0.4), Vector3.new(x, top + 2.1, -5.1), WHITE)
		body(chassis, model, "Door", Vector3.new(0.4, 1.8, 4.2), Vector3.new(x, top + 0.9, -3.1), WHITE)
		body(chassis, model, "BedSide", Vector3.new(0.4, 1.6, 8.3), Vector3.new(x, top + 0.8, 3.35), WHITE)
	end
	body(chassis, model, "Tailgate", Vector3.new(6.5, 1.6, 0.4), Vector3.new(0, top + 0.8, half - 0.2), WHITE)
	local bed = body(chassis, model, "Bed", Vector3.new(5.7, 0.2, 8.1), Vector3.new(0, top + 0.1, 3.35), Color3.fromRGB(70, 70, 74))
	bed.CanCollide = false
	for _, x in { -2.2, 2.2 } do
		local light = body(chassis, model, "Headlight", Vector3.new(1.2, 0.6, 0.2), Vector3.new(x, top + 0.9, -half - 0.05), Color3.fromRGB(255, 250, 220))
		light.Material = Enum.Material.Neon
	end

	-- كرسي السواق (يسار مثل السعودية). VehicleSeat يعطينا تحكم الكيبورد والجوال والجويستك
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriverSeat"
	seat.Size = Vector3.new(2, 1, 2)
	seat.CFrame = cframe * CFrame.new(-1.4, top + 0.5, -2.8)
	seat.Color = DARK
	seat.Massless = true
	seat.HeadsUpDisplay = false
	seat.MaxSpeed = 0 -- السرعة نتحكم فيها بالمواتير، مو بالكرسي
	seat.Torque = 0
	seat.Parent = model
	local seatWeld = Instance.new("WeldConstraint")
	seatWeld.Part0 = chassis
	seatWeld.Part1 = seat
	seatWeld.Parent = seat

	-- مكان الهبالي في الحوض، وزر "حطه في السيارة"
	local slotList = {}
	for i = 1, slots do
		local z = 0.4 + (i - 0.5) * (8.1 / slots)
		local slot = attach("Slot" .. i, chassis, cframe * CFrame.new(0, top + 0.2, z) * CFrame.Angles(0, math.rad(90), 0))
		table.insert(slotList, slot)
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "LoadPrompt"
	prompt.ActionText = "حطه في السيارة"
	prompt.ObjectText = "الربع"
	prompt.HoldDuration = 0.3
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt.Enabled = false -- الجوال يشغّله بس لصاحب السيارة وهو ساحب هبالي
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.Parent = bed

	local wheels = {}
	for _, spec in { { -1, -1 }, { 1, -1 }, { -1, 1 }, { 1, 1 } } do
		local x, z = spec[1] * TUNING.WheelX, spec[2] * TUNING.WheelZ
		table.insert(wheels, wheel(model, chassis, x, z, spec[2] < 0))
	end

	-- كل السيارة تتحمل مع بعض في الجوال
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic

	return {
		Model = model,
		Chassis = chassis,
		Seat = seat,
		Bed = bed,
		LoadPrompt = prompt,
		Slots = slotList,
		Wheels = wheels,
	}
end

-- قوة المساعدات حسب وزن السيارة (لازم بعد ما تنحط في Workspace عشان AssemblyMass)
function CarModel.TuneSuspension(car: Car)
	local gravity = workspace.Gravity
	local mass = car.Chassis.AssemblyMass
	local perWheel = mass / #car.Wheels
	local stiffness = perWheel * gravity / TUNING.SuspensionSag
	local damping = TUNING.SuspensionDampingRatio * 2 * math.sqrt(stiffness * perWheel)
	for _, w in car.Wheels do
		local spring = w.Part:FindFirstChild("Suspension") :: SpringConstraint?
		if spring then
			spring.Stiffness = stiffness
			spring.Damping = damping
		end
	end
end

return CarModel
