-- طلوع الهبالي في الصحراء (السيرفر بس).
-- السيرفر يقرر كل شي: وين يطلعون، وكم عددهم، وندرتهم، ووين يمشون. اللاعب يشوف بس،
-- وما فيه أي Remote يخلي اللاعب يطلّع أو يحرك هبالي.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local HabaliRules = require(Shared:WaitForChild("HabaliRules"))
local HabaliModel = require(script.Parent:WaitForChild("HabaliModel"))

local HabaliService = {}

type State = {
	Model: Model,
	Parts: { BasePart },
	Offsets: { CFrame },
	ZoneId: string,
	X: number,
	Z: number,
	Y: number,
	Yaw: number,
	Speed: number,
	TargetX: number?,
	TargetZ: number?,
	IdleUntil: number,
	Phase: number,
	Hook: boolean,
}

local rules = HabaliRules.new(MapConfig, HabaliConfig)
local random = Random.new()
local function rng(): number
	return random:NextNumber()
end

local wander = HabaliConfig.Wander
local folder: Folder
local active: { [Model]: State } = {}
local alive: { [string]: number } = {}
local pending: { [string]: number } = {}
local nextId = 0
local started = false

local zonesById = {}
for _, zone in MapConfig.Zones do
	zonesById[zone.Id] = zone
	alive[zone.Id] = 0
	pending[zone.Id] = 0
end
local charactersById = {}
for _, character in HabaliConfig.Characters do
	charactersById[character.Id] = character
end
local variantsById = {}
for _, variant in HabaliConfig.Variants do
	variantsById[variant.Id] = variant
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Include
rayParams.FilterDescendantsInstances = { Workspace.Terrain }
rayParams.IgnoreWater = false

-- ارتفاع الرمل تحت النقطة، و nil لو موية أو منحدر قوي
local function groundAt(x: number, z: number): (number?, boolean)
	local origin = Vector3.new(x, MapConfig.MaxY, z)
	local result = Workspace:Raycast(origin, Vector3.new(0, MapConfig.MinY - MapConfig.MaxY, 0), rayParams)
	if not result then
		return nil, false
	end
	local standable = result.Material ~= Enum.Material.Water and result.Normal.Y >= wander.MinGroundNormalY
	return result.Position.Y, standable
end

local function idleTime(): number
	return wander.IdleMin + rng() * (wander.IdleMax - wander.IdleMin)
end

local spawnRegular: (zoneId: string) -> ()

local function onRemoved(state: State)
	if not active[state.Model] then
		return
	end
	active[state.Model] = nil
	if state.Hook then
		return
	end
	-- واحد انشال: نطلّع بداله بعد شوي
	local zoneId = state.ZoneId
	alive[zoneId] -= 1
	pending[zoneId] += 1
	task.delay(HabaliConfig.RespawnDelay[zoneId], function()
		pending[zoneId] -= 1
		spawnRegular(zoneId)
	end)
end

export type SpawnOptions = { Hook: boolean?, Variant: string?, Beam: number? }

local function spawnAt(zoneId: string, x: number, z: number, options: SpawnOptions?): Model?
	local opts = options or {}
	local y, standable = groundAt(x, z)
	if not y or not standable then
		return nil
	end
	local zone = zonesById[zoneId]
	local variantId = opts.Variant or rules.RollVariant(rng)
	local variant = variantsById[variantId]
	local character = charactersById[rules.PickCharacter(rng)]

	local model, parts = HabaliModel.Build({
		CharacterId = character.Id,
		DisplayName = character.DisplayName,
		RarityText = zone.Rarity,
		RarityColor = HabaliConfig.RarityColors[zoneId],
		Glow = zoneId ~= "Common" or variant ~= nil,
		Variant = variant,
		LabelDistance = if opts.Beam then 2500 else HabaliConfig.LabelDistance[zoneId],
		Beam = opts.Beam,
		BeamWidth = HabaliConfig.Hook.BeamWidth,
	})

	local yaw = rng() * 2 * math.pi
	local pivot = CFrame.new(x, y + HabaliModel.RootHeight, z) * CFrame.Angles(0, yaw, 0)
	local offsets = table.create(#parts)
	for i, part in parts do
		offsets[i] = parts[1].CFrame:ToObjectSpace(part.CFrame) -- مكان القطعة من Root
	end
	model:PivotTo(pivot)

	nextId += 1
	model:SetAttribute("HabaliId", nextId)
	model:SetAttribute("Character", character.Id)
	model:SetAttribute("Rarity", zoneId)
	model:SetAttribute("Variant", variantId)
	model:SetAttribute("Hook", opts.Hook == true)
	model.Name = string.format("%s_%s_%d", zoneId, character.Id, nextId)

	local state: State = {
		Model = model,
		Parts = parts,
		Offsets = offsets,
		ZoneId = zoneId,
		X = x,
		Z = z,
		Y = y,
		Yaw = yaw,
		Speed = HabaliConfig.WalkSpeed[zoneId],
		TargetX = nil,
		TargetZ = nil,
		IdleUntil = os.clock() + idleTime(),
		Phase = rng() * 10,
		Hook = opts.Hook == true,
	}
	active[model] = state
	model.Destroying:Connect(function()
		onRemoved(state)
	end)
	model.Parent = folder
	return model
end

function spawnRegular(zoneId: string)
	if alive[zoneId] + pending[zoneId] >= HabaliConfig.Caps[zoneId] then
		return
	end
	for _ = 1, 10 do
		local x, z = rules.SamplePoint(zoneId, rng)
		if x and z and spawnAt(zoneId, x, z) then
			alive[zoneId] += 1
			return
		end
	end
	-- ما لقينا مكان هالمرة، نحاول بعد شوي
	pending[zoneId] += 1
	task.delay(2, function()
		pending[zoneId] -= 1
		spawnRegular(zoneId)
	end)
end

-- المشي: كل الهبالي يتحركون بدفعة وحدة (BulkMoveTo)، واللي واقف ما نلمسه
local function step(dt: number)
	local now = os.clock()
	local moveParts, moveFrames = {}, {}
	for _, state in active do
		local tx, tz = state.TargetX, state.TargetZ
		if not tx or not tz then
			if now >= state.IdleUntil then
				local nx, nz = rules.WanderTarget(state.X, state.Z, state.ZoneId, rng)
				local standable = false
				if nx and nz then
					local _, ok = groundAt(nx, nz)
					standable = ok
				end
				if nx and nz and standable then
					state.TargetX, state.TargetZ = nx, nz
				else
					state.IdleUntil = now + 1
				end
			end
			continue
		end

		local dx, dz = tx - state.X, tz - state.Z
		local distance = math.sqrt(dx * dx + dz * dz)
		local move = state.Speed * dt
		if distance <= move then
			state.X, state.Z = tx, tz
			state.TargetX, state.TargetZ = nil, nil
			state.IdleUntil = now + idleTime()
		else
			state.X += dx / distance * move
			state.Z += dz / distance * move
		end
		if distance > 0.01 then
			state.Yaw = math.atan2(-dx, -dz) -- يطالع وين رايح
		end
		local y = groundAt(state.X, state.Z)
		if y then
			state.Y = y
		end

		-- هزّة خفيفة وهو يمشي
		local bob = if state.TargetX then math.abs(math.sin(now * 9 + state.Phase)) * 0.5 else 0
		local pivot = CFrame.new(state.X, state.Y + HabaliModel.RootHeight + bob, state.Z) * CFrame.Angles(0, state.Yaw, 0)
		for i, part in state.Parts do
			table.insert(moveParts, part)
			table.insert(moveFrames, pivot * state.Offsets[i])
		end
	end
	if #moveParts > 0 then
		Workspace:BulkMoveTo(moveParts, moveFrames, Enum.BulkMoveMode.FireCFrameChanged)
	end
end

-- هوك أول دقيقة: شعبي قريب من طرف الديرة باتجاه اللاعب، ونادر يلمع بعيد بنفس الاتجاه
local hooksByPlayer: { [Player]: { Model } } = {}

local function spawnHook(player: Player, character: Model)
	if hooksByPlayer[player] then
		return
	end
	local hook = HabaliConfig.Hook
	local position = character:GetPivot().Position
	local angle = if Vector2.new(position.X, position.Z).Magnitude > 20
		then math.atan2(position.Z, position.X)
		else rng() * 2 * math.pi
	local models = {}
	hooksByPlayer[player] = models

	local cx, cz = rules.PointNear("Common", angle, hook.CommonRadius)
	local common = if cx and cz then spawnAt("Common", cx, cz, { Hook = true, Variant = HabaliConfig.NormalVariant }) else nil
	if common then
		table.insert(models, common)
	end

	local rx, rz = rules.PointNear("Rare", angle, hook.RareRadius)
	local rare = if rx and rz then spawnAt("Rare", rx, rz, { Hook = true, Beam = hook.BeamHeight }) else nil
	if rare then
		table.insert(models, rare)
		-- بعيد عن اللاعب (أبعد من مدى التحميل)، فنخليه محمّل عنده دايم عشان يشوفه
		rare.ModelStreamingMode = Enum.ModelStreamingMode.PersistentPerPlayer
		rare:AddPersistentPlayer(player)
	end
	if not common or not rare then
		warn("[Habali] هوك أول دقيقة ناقص للاعب", player.Name)
	end

	task.delay(hook.Lifetime, function()
		for _, model in models do
			if model.Parent then
				model:Destroy()
			end
		end
	end)
end

local function onPlayerAdded(player: Player)
	local function onCharacter(character: Model)
		task.wait(1) -- لين يستقر مكانه
		if character.Parent then
			spawnHook(player, character)
		end
	end
	if player.Character then
		task.spawn(onCharacter, player.Character)
	else
		player.CharacterAdded:Once(onCharacter)
	end
end

local function onPlayerRemoving(player: Player)
	local models = hooksByPlayer[player]
	hooksByPlayer[player] = nil
	if models then
		for _, model in models do
			if model.Parent then
				model:Destroy()
			end
		end
	end
end

function HabaliService.Start()
	if started then
		return
	end
	started = true

	local old = Workspace:FindFirstChild("Habali")
	if old then
		old:Destroy()
	end
	folder = Instance.new("Folder")
	folder.Name = "Habali"
	folder.Parent = Workspace

	-- نعبي الطبقات واحد واحد عشان ما يصير تعليق
	task.spawn(function()
		for _, zone in MapConfig.Zones do
			for _ = 1, HabaliConfig.Caps[zone.Id] do
				spawnRegular(zone.Id)
				task.wait()
			end
		end
	end)

	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in Players:GetPlayers() do
		task.spawn(onPlayerAdded, player)
	end

	task.spawn(function()
		while true do
			local dt = task.wait(wander.Tick)
			debug.profilebegin("HabaliWander")
			step(math.min(dt, 0.5))
			debug.profileend()
		end
	end)
end

-- للمرحلة الجاية (الصيد): يشيل الهبالي، والبديل يطلع لحاله بعد التأخير
function HabaliService.Remove(model: Model)
	if active[model] then
		model:Destroy()
	end
end

-- كم هبالي عايشين في كل طبقة (بدون الهوك)
function HabaliService.GetCounts(): { [string]: number }
	return table.clone(alive)
end

return HabaliService
