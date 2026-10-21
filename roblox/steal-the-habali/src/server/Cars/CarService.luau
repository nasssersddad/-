-- سيارات اللاعبين: زر "سيارتي" يطلّع ربعك في موقف الديرة، والسيرفر يحوّل الدعسة لمواتير الكفرات.
-- السيارة يسوقها جوال اللاعب (عشان تكون ناعمة)، بس السيرفر يراقب سرعتها ومكانها.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local CatchConfig = require(Shared:WaitForChild("CatchConfig"))
local CatchRules = require(Shared:WaitForChild("CatchRules"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local FxConfig = require(Shared:WaitForChild("FxConfig"))
local CarModel = require(script.Parent:WaitForChild("CarModel"))
local Net = require(script.Parent.Parent:WaitForChild("Net"))

local CarService = {}

local catchRules = CatchRules.new(CatchConfig)
local carConfig = CatchConfig.Car

type CarState = CarModel.Car & {
	Owner: Player,
	Load: number,
	Cargo: { Model },
	LastPosition: Vector3,
}

local cars: { [Player]: CarState } = {}
local lastSpawn: { [Player]: number } = {}
local lastHorn: { [Player]: number } = {}
local folder: Folder
local loadHandler: ((Player, CarState) -> ())? = nil

-- أماكن الموقف: داخل الديرة قدام الفتحات اللي بين القواعد (45° و135°...)،
-- والسيارة تطالع برا للصحرا من الفتحة. كل فتحة فيها 3 مواقف جنب بعض
local PARKING_RADIUS = 80
local PARKING_ANGLES = { 45, 135, 225, 315 }
local PARKING_LANES = { 0, -11, 11 }
local CAR_BOX = Vector3.new(9.5, 8, 16)

local function overlapParams(): OverlapParams
	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { Workspace.Terrain }
	return params
end

local function findParking(): CFrame?
	local params = overlapParams()
	for _, lane in PARKING_LANES do
		for _, degrees in PARKING_ANGLES do
			local angle = math.rad(degrees)
			local outward = Vector3.new(math.cos(angle), 0, math.sin(angle))
			local side = Vector3.new(-outward.Z, 0, outward.X)
			local position = outward * PARKING_RADIUS + side * lane + Vector3.new(0, MapConfig.BaseHeight, 0)
			local cframe = CFrame.lookAt(position, position + outward) -- يطالع برا
			local hits = Workspace:GetPartBoundsInBox(cframe * CFrame.new(0, CAR_BOX.Y / 2 + 0.6, 0), CAR_BOX, params)
			if #hits == 0 then
				return cframe
			end
		end
	end
	return nil
end

-- محور الكفر يطالع يمين (+X) والقدام -Z، فالدوران للقدام سالب حول المحور.
-- واللف يمين (SteerFloat = 1) زاوية سالبة حول المحور العمودي
CarService.WheelDirection = -1
CarService.SteerDirection = -1

local function applyInput(car: CarState)
	local seat = car.Seat
	local throttle = math.clamp(seat.ThrottleFloat, -1, 1)
	local steer = math.clamp(seat.SteerFloat, -1, 1)
	local speed = catchRules.CarSpeed(car.Load)
	if throttle < 0 then
		speed *= carConfig.Reverse
	end
	local angular = throttle * speed / CarModel.Tuning.WheelRadius
	for _, w in car.Wheels do
		-- كل الكفرات مرفقاتها بنفس الاتجاه، فكلها نفس السرعة
		w.Axle.AngularVelocity = angular * CarService.WheelDirection
		w.Axle.MotorMaxTorque = if throttle ~= 0 then CarModel.Tuning.MotorTorque else CarModel.Tuning.BrakeTorque
		if w.Steer then
			w.Steer.TargetAngle = steer * carConfig.SteerAngle * CarService.SteerDirection
		end
	end
end

local function ownerOf(seat: VehicleSeat): Player?
	local humanoid = seat.Occupant
	return humanoid and Players:GetPlayerFromCharacter(humanoid.Parent)
end

local function onOccupant(car: CarState)
	local seat = car.Seat
	local driver = ownerOf(seat)
	if seat.Occupant and driver ~= car.Owner then
		-- بس صاحب السيارة يسوقها (لين نسوي العصابة)
		local weld = seat:FindFirstChild("SeatWeld")
		if weld then
			weld:Destroy()
		end
		return
	end
	if driver then
		car.Chassis:SetNetworkOwner(driver)
	else
		-- واقفة: السيرفر يمسكها عشان محد يدفّها من جواله
		car.Chassis:SetNetworkOwner(nil)
		seat.ThrottleFloat = 0
		seat.SteerFloat = 0
	end
	applyInput(car)
end

local function destroyCar(player: Player)
	local car = cars[player]
	cars[player] = nil
	if car then
		car.Model:Destroy()
	end
end

local function spawnCar(player: Player)
	local now = os.clock()
	if lastSpawn[player] and now - lastSpawn[player] < carConfig.SpawnCooldown then
		Net.Notify(player, "استنى شوي قبل ما تطلّع سيارة ثانية")
		return
	end
	local old = cars[player]
	if old and #old.Cargo > 0 then
		Net.Notify(player, "سيارتك فيها هبالي! ما أقدر أطلّع لك وحدة جديدة")
		return
	end
	local parking = findParking()
	if not parking then
		Net.Notify(player, "الموقف مليان، جرّب بعد شوي")
		return
	end
	lastSpawn[player] = now
	destroyCar(player)

	local built = CarModel.Build(parking, player.Name, carConfig.Slots)
	local car = built :: CarState
	car.Owner = player
	car.Load = 0
	car.Cargo = {}
	car.LastPosition = car.Chassis.Position
	car.Model:SetAttribute("OwnerUserId", player.UserId)
	car.Model:SetAttribute("Load", 0)
	car.Model:SetAttribute("Capacity", carConfig.Capacity)
	car.Model.Parent = folder
	CarModel.TuneSuspension(car)
	car.Chassis:SetNetworkOwner(nil)
	cars[player] = car

	car.Seat:GetPropertyChangedSignal("ThrottleFloat"):Connect(function()
		applyInput(car)
	end)
	car.Seat:GetPropertyChangedSignal("SteerFloat"):Connect(function()
		applyInput(car)
	end)
	car.Seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		onOccupant(car)
	end)
	car.LoadPrompt.Triggered:Connect(function(who)
		if loadHandler then
			loadHandler(who, car)
		end
	end)
	Net.Notify(player, "سيارتك الربع في موقف الديرة 🚙")
end

-- السيرفر يراقب: لو السيارة أسرع من حدها أو انتقلت فجأة، يرجّعها
local function watch(dt: number)
	for _, car in cars do
		local chassis = car.Chassis
		if not chassis.Parent then
			continue
		end
		local limit = catchRules.CarSpeed(car.Load) * carConfig.SpeedTolerance
		local velocity = chassis.AssemblyLinearVelocity
		local flat = Vector3.new(velocity.X, 0, velocity.Z)
		local position = chassis.Position
		local jump = (position - car.LastPosition).Magnitude
		if jump > limit * dt * 2 + 25 then
			-- انتقال مستحيل: نرجّعها لآخر مكان سليم
			car.Model:PivotTo(CFrame.new(car.LastPosition) * chassis.CFrame.Rotation) -- محور الموديل = نص الهيكل
			chassis.AssemblyLinearVelocity = Vector3.zero
			car.Model:SetAttribute("Violations", (car.Model:GetAttribute("Violations") or 0) + 1)
			continue
		end
		if flat.Magnitude > limit then
			chassis.AssemblyLinearVelocity = flat.Unit * limit + Vector3.new(0, velocity.Y, 0)
			car.Model:SetAttribute("Violations", (car.Model:GetAttribute("Violations") or 0) + 1)
		end
		car.LastPosition = position
	end
end

function CarService.Start()
	folder = Workspace:FindFirstChild("Cars") :: Folder
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = "Cars"
		folder.Parent = Workspace
	end
	Net.On("SpawnCar", function(player)
		spawnCar(player)
	end)
	-- الهرن: بس لو أنت سايق سيارتك
	Net.On("Horn", function(player)
		local car = cars[player]
		local now = os.clock()
		if not car or ownerOf(car.Seat) ~= player then
			return
		end
		if lastHorn[player] and now - lastHorn[player] < FxConfig.HornCooldown then
			return
		end
		lastHorn[player] = now
		Net.FireNear("Fx", car.Chassis.Position, FxConfig.Radius, "Horn", car.Model)
	end)
	Players.PlayerRemoving:Connect(function(player)
		destroyCar(player)
		lastSpawn[player] = nil
		lastHorn[player] = nil
	end)
	task.spawn(function()
		while true do
			local dt = task.wait(0.5)
			watch(dt)
		end
	end)
end

function CarService.GetCar(player: Player): CarState?
	return cars[player]
end

-- يحط الهبالي في الحوض (الموديل لازم يكون Unanchored وملحوم على Hitbox). يرجّع رقم المكان
function CarService.AddCargo(car: CarState, model: Model, rarity: string): number?
	local index = #car.Cargo + 1
	local slot = car.Slots[index]
	if not slot then
		return nil
	end
	model:ScaleTo(0.6) -- يصغر عشان ثلاثة يدخلون الحوض
	model:PivotTo(slot.WorldCFrame)
	local hitbox = model:FindFirstChild("Hitbox") :: BasePart
	local weld = Instance.new("WeldConstraint")
	weld.Name = "CargoWeld"
	weld.Part0 = car.Chassis
	weld.Part1 = hitbox
	weld.Parent = hitbox
	model.Parent = car.Model
	table.insert(car.Cargo, model)
	car.Load += CatchConfig.Weight[rarity]
	car.Model:SetAttribute("Load", car.Load)
	CarModel.TuneSuspension(car)
	applyInput(car)
	return index
end

function CarService.SetLoadHandler(handler: (Player, CarState) -> ())
	loadHandler = handler
end

return CarService
