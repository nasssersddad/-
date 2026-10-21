-- طلوع الهبالي في الصحراء، وضربهم ودوختهم (السيرفر بس).
-- السيرفر يقرر كل شي: وين يطلعون، وكم عددهم، وندرتهم، ووين يمشون، وصحتهم.
-- اللاعب يشوف بس. الصيد (CatchService) يكلّم هالملف عن طريق الدوال اللي تحت.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local HabaliRules = require(Shared:WaitForChild("HabaliRules"))
local CatchConfig = require(Shared:WaitForChild("CatchConfig"))
local CatchRules = require(Shared:WaitForChild("CatchRules"))
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
	Health: number, -- من 1 لـ 0
	LastHitAt: number,
	StunnedUntil: number, -- 0 = صاحي
	FleeUntil: number,
	Taken: boolean, -- أحد ماسكه (السحب)، فما نحركه
	Dirty: boolean, -- لازم نحدّث مكانه هالدورة (دوخة أو صحوة)
}

local rules = HabaliRules.new(MapConfig, HabaliConfig)
local catchRules = CatchRules.new(CatchConfig)
local random = Random.new()
local function rng(): number
	return random:NextNumber()
end

local wander = HabaliConfig.Wander
local STUN_TILT = CFrame.Angles(0, 0, math.rad(80)) -- الدايخ يطيح على جنبه
local folder: Folder
local active: { [Model]: State } = {}
local alive: { [string]: number } = {}
local pending: { [string]: number } = {}
local nextId = 0
local started = false
local grabHandler: ((Player, Model) -> ())? = nil

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

-- شريط الصحة وكلمة "دايخ" فوق راسه
local function updateLabel(state: State)
	local root = state.Model.PrimaryPart
	local gui = root and root:FindFirstChild("Label")
	if not gui then
		return
	end
	local bar = gui:FindFirstChild("Bar") :: Frame?
	local status = gui:FindFirstChild("Status") :: TextLabel?
	local stunned = state.StunnedUntil > 0
	if bar then
		bar.Visible = state.Health < 1 and not stunned
		local fill = bar:FindFirstChild("Fill") :: Frame?
		if fill then
			fill.Size = UDim2.fromScale(math.clamp(state.Health, 0, 1), 1)
		end
	end
	if status then
		status.Text = if stunned then "💫 دايخ" else ""
	end
	state.Model:SetAttribute("Stunned", stunned)
end

local function grabPrompt(model: Model): ProximityPrompt?
	local hitbox = model:FindFirstChild("Hitbox")
	return hitbox and hitbox:FindFirstChild("GrabPrompt") :: ProximityPrompt?
end

local spawnRegular: (zoneId: string) -> ()

-- واحد انشال من الصحراء (انصاد أو انمسح): نطلّع بداله بعد شوي
local function forget(state: State)
	if not active[state.Model] then
		return
	end
	active[state.Model] = nil
	if state.Hook then
		return
	end
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
		PromptHold = CatchConfig.Drag.PromptHold,
		PromptDistance = CatchConfig.Drag.PromptDistance,
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
		Health = 1,
		LastHitAt = 0,
		StunnedUntil = 0,
		FleeUntil = 0,
		Taken = false,
		Dirty = false,
	}
	active[model] = state
	model.Destroying:Connect(function()
		forget(state)
	end)
	local prompt = grabPrompt(model)
	if prompt then
		prompt.Triggered:Connect(function(player)
			if grabHandler and active[model] and not state.Taken then
				grabHandler(player, model)
			end
		end)
	end
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

-- يشرد: من كم مشوار ممكن ياخذ الأبعد عن اللي ضربه
local function fleeFrom(state: State, fromX: number, fromZ: number)
	local bestX, bestZ, bestDistance = nil, nil, -1
	for _ = 1, 6 do
		local tx, tz = rules.WanderTarget(state.X, state.Z, state.ZoneId, rng)
		if tx and tz then
			local d = (tx - fromX) ^ 2 + (tz - fromZ) ^ 2
			if d > bestDistance then
				bestX, bestZ, bestDistance = tx, tz, d
			end
		end
	end
	if bestX and bestZ then
		state.TargetX, state.TargetZ = bestX, bestZ
	end
end

local function wake(state: State, health: number)
	state.StunnedUntil = 0
	state.Health = health
	state.LastHitAt = os.clock()
	state.Dirty = true
	if CatchConfig.Flee.Rarities[state.ZoneId] then
		state.FleeUntil = os.clock() + CatchConfig.Flee.Time
	end
	state.IdleUntil = 0
	local prompt = grabPrompt(state.Model)
	if prompt then
		prompt.Enabled = false
	end
	updateLabel(state)
end

-- المشي: كل الهبالي يتحركون بدفعة وحدة (BulkMoveTo)، واللي واقف ما نلمسه
local function step(dt: number)
	local now = os.clock()
	local moveParts, moveFrames = {}, {}
	for _, state in active do
		if state.Taken then
			continue
		end
		local stunned = state.StunnedUntil > 0
		if stunned and now >= state.StunnedUntil then
			wake(state, 1) -- صحى، ويشرد لو نادر وفوق
			stunned = false
		elseif not stunned and state.Health < 1 and now - state.LastHitAt > CatchConfig.RecoverTime then
			state.Health = 1
			updateLabel(state)
		end

		local fleeing = now < state.FleeUntil
		local tx, tz = state.TargetX, state.TargetZ
		if stunned or not tx or not tz then
			if not stunned and now >= state.IdleUntil then
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
			if not state.Dirty then
				continue
			end
		else
			local dx, dz = tx - state.X, tz - state.Z
			local distance = math.sqrt(dx * dx + dz * dz)
			local move = state.Speed * (if fleeing then CatchConfig.Flee.SpeedMultiplier else 1) * dt
			if distance <= move then
				state.X, state.Z = tx, tz
				state.TargetX, state.TargetZ = nil, nil
				state.IdleUntil = now + (if fleeing then 0.1 else idleTime())
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
		end
		state.Dirty = false

		-- هزّة خفيفة وهو يمشي، والدايخ طايح على جنبه
		local bob = if state.TargetX and not stunned then math.abs(math.sin(now * 9 + state.Phase)) * 0.5 else 0
		local pivot = CFrame.new(state.X, state.Y + HabaliModel.RootHeight + bob, state.Z) * CFrame.Angles(0, state.Yaw, 0)
		if stunned then
			pivot *= STUN_TILT
		end
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

-- الهوك يختفي بس لو محد ماسكه
local function removeHook(model: Model)
	local state = active[model]
	if state and not state.Taken and model.Parent then
		model:Destroy()
	end
end

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
			removeHook(model)
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
			removeHook(model)
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

-- ===== للصيد (CatchService) =====

export type Nearby = { Model: Model, Position: Vector3 }

-- الهبالي اللي في الصحراء (مو ممسوكين) قريب من نقطة، ومكان نص صندوق الصيد
function HabaliService.GetNearby(position: Vector3, range: number): { Nearby }
	local result = {}
	local half = HabaliModel.HitboxSize.Y / 2
	for model, state in active do
		if not state.Taken then
			local center = Vector3.new(state.X, state.Y + half, state.Z)
			if (center - position).Magnitude <= range then
				table.insert(result, { Model = model, Position = center })
			end
		end
	end
	return result
end

-- ضربة (عقال أو تنويم). يرجّع "Hit" أو "Stunned"، أو nil لو ما ينفع ينضرب
function HabaliService.Damage(model: Model, kind: string, from: Vector3): string?
	local state = active[model]
	if not state or state.Taken or state.StunnedUntil > 0 then
		return nil
	end
	local damage = catchRules.Damage(kind, state.ZoneId)
	if damage <= 0 then
		return nil
	end
	local now = os.clock()
	local stunned
	state.Health, stunned = catchRules.ApplyDamage(state.Health, damage)
	state.LastHitAt = now
	if stunned then
		state.StunnedUntil = now + CatchConfig.StunTime[state.ZoneId]
		model:SetAttribute("StunKind", kind) -- نجوم للعقال، Zzz للتنويم
		state.TargetX, state.TargetZ = nil, nil
		state.FleeUntil = 0
		state.Dirty = true
		local prompt = grabPrompt(model)
		if prompt then
			prompt.Enabled = true
		end
	elseif CatchConfig.Flee.Rarities[state.ZoneId] then
		state.FleeUntil = now + CatchConfig.Flee.Time
		fleeFrom(state, from.X, from.Z)
	end
	updateLabel(state)
	return if stunned then "Stunned" else "Hit"
end

function HabaliService.IsStunned(model: Model): boolean
	local state = active[model]
	return state ~= nil and not state.Taken and state.StunnedUntil > 0
end

-- قاوم وصحى (يصير له صحة أقل، فيحتاج ضربات أقل)
function HabaliService.Wake(model: Model, health: number)
	local state = active[model]
	if state and not state.Taken then
		wake(state, health)
	end
end

-- أحد مسكه: نوقف تحريكه. يرجّع قائمة القطع (بدون عمود النور)
function HabaliService.Take(model: Model): { BasePart }?
	local state = active[model]
	if not state or state.Taken or state.StunnedUntil <= 0 then
		return nil
	end
	state.Taken = true
	local prompt = grabPrompt(model)
	if prompt then
		prompt.Enabled = false
	end
	-- عمود نور الهوك ما يتسحب
	local beam = model:FindFirstChild("Beam")
	if beam then
		local kept, keptOffsets = {}, {}
		for i, part in state.Parts do
			if part ~= beam then
				table.insert(kept, part)
				table.insert(keptOffsets, state.Offsets[i])
			end
		end
		state.Parts, state.Offsets = kept, keptOffsets
		beam:Destroy()
	end
	model:SetAttribute("Hook", false)
	return state.Parts
end

-- فلت من اللي ماسكه: يرجع للصحراء دايخ شوي. لازم القطع ترجع Anchored قبلها
function HabaliService.Return(model: Model)
	local state = active[model]
	if not state or not state.Taken then
		return
	end
	local position = model:GetPivot().Position
	state.X, state.Z = position.X, position.Z
	state.Y = groundAt(position.X, position.Z) or position.Y
	state.Taken = false
	state.TargetX, state.TargetZ = nil, nil
	state.Health = 0
	state.StunnedUntil = os.clock() + 4
	state.Dirty = true
	local prompt = grabPrompt(model)
	if prompt then
		prompt.Enabled = true
	end
	updateLabel(state)
end

-- انصاد (انحط في السيارة): يطلع من الصحراء ويطلع بداله. الموديل صار ملك الصيد
function HabaliService.Caught(model: Model)
	local state = active[model]
	if state then
		forget(state)
		local gui = model.PrimaryPart and model.PrimaryPart:FindFirstChild("Label")
		local status = gui and gui:FindFirstChild("Status") :: TextLabel?
		local bar = gui and gui:FindFirstChild("Bar") :: Frame?
		if status then
			status.Text = "🚙 انصاد"
		end
		if bar then
			bar.Visible = false
		end
	end
end

function HabaliService.SetGrabHandler(handler: (Player, Model) -> ())
	grabHandler = handler
end

-- كم هبالي عايشين في كل طبقة (بدون الهوك)
function HabaliService.GetCounts(): { [string]: number }
	return table.clone(alive)
end

return HabaliService
