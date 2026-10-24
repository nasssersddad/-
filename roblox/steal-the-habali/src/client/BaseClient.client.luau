-- القواعد عند اللاعب: عدّاد الفلوس، وأزرار القاعدة (لصاحبها بس)، وأزرار السرقة (لغير صاحبها
-- لما تكون مفتوحة)، وعلامة "مطلوب ثأرك" فوق اللي سرق منك.
-- تشغيل الأزرار هنا للشكل بس، والسيرفر يتحقق من كل شي.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local player = Players.LocalPlayer

-- ===== عدّاد الفلوس =====

local gui = Instance.new("ScreenGui")
gui.Name = "MoneyHud"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local moneyLabel = Instance.new("TextLabel")
moneyLabel.Name = "Money"
moneyLabel.AnchorPoint = Vector2.new(0.5, 0)
moneyLabel.Position = UDim2.new(0.5, 0, 0, 6)
moneyLabel.Size = UDim2.fromOffset(200, 40)
moneyLabel.BackgroundColor3 = Color3.fromRGB(30, 22, 18)
moneyLabel.BackgroundTransparency = 0.35
moneyLabel.TextScaled = true
moneyLabel.Font = Enum.Font.GothamBlack
moneyLabel.TextColor3 = Color3.fromRGB(150, 255, 160)
moneyLabel.Text = "💰 0"
moneyLabel.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0.3, 0)
corner.Parent = moneyLabel
local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0.12, 0)
padding.PaddingBottom = UDim.new(0.12, 0)
padding.Parent = moneyLabel

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function updateMoney()
	moneyLabel.Text = "💰 " .. formatMoney(player:GetAttribute("Money") or 0)
end
player:GetAttributeChangedSignal("Money"):Connect(updateMoney)
updateMoney()

-- ===== الأزرار =====

local function setPrompt(parent: Instance?, name: string, enabled: boolean)
	local prompt = parent and parent:FindFirstChild(name)
	if prompt and prompt:IsA("ProximityPrompt") then
		prompt.Enabled = enabled
	end
end

local function busy(): boolean
	return player:GetAttribute("Dragging") ~= nil or player:GetAttribute("Carrying") ~= nil
end

local function refreshPrompts()
	local serverNow = Workspace:GetServerTimeNow()
	local me = player.UserId
	local map = Workspace:FindFirstChild("Map")
	local plots = map and map:FindFirstChild("Plots")
	if plots then
		for _, plot in plots:GetChildren() do
			local owner = plot:GetAttribute("OwnerUserId")
			local mine = owner == me
			local kit = plot:FindFirstChild("BaseKit")
			setPrompt(plot:FindFirstChild("DropZone"), "UnloadPrompt", mine)
			setPrompt(kit and kit:FindFirstChild("CollectPad"), "CollectPrompt", mine)
			setPrompt(kit and kit:FindFirstChild("LockButton"), "LockPrompt", mine)
			-- السرقة: قاعدة غيرك، صاحبها في الديرة، ومو مقفلة
			local open = owner ~= nil and not mine and not plot:GetAttribute("Shielded") and serverNow >= (plot:GetAttribute("LockedUntil") or 0) and not busy()
			local display = plot:FindFirstChild("Display")
			if display then
				for _, model in display:GetChildren() do
					setPrompt(model:FindFirstChild("Hitbox"), "StealPrompt", open)
				end
			end
		end
	end
	-- حوض سيارة غيرك: لو واقفة ومحد فيها وفيها هبالي
	local cars = Workspace:FindFirstChild("Cars")
	if cars then
		for _, car in cars:GetChildren() do
			local seat = car:FindFirstChild("DriverSeat") :: VehicleSeat?
			local open = car:GetAttribute("OwnerUserId") ~= me and (car:GetAttribute("Load") or 0) > 0 and seat ~= nil and seat.Occupant == nil and not busy()
			setPrompt(car:FindFirstChild("Bed"), "StealPrompt", open)
		end
	end
end

-- ===== الثأر =====

local markedCharacter: Model? = nil
local highlight: Highlight? = nil
local billboard: BillboardGui? = nil

local function clearMark()
	if highlight then
		highlight:Destroy()
		highlight = nil
	end
	if billboard then
		billboard:Destroy()
		billboard = nil
	end
	markedCharacter = nil
end

local function refreshRevenge()
	local targetId = player:GetAttribute("RevengeTarget")
	local untilTime = player:GetAttribute("RevengeUntil") or 0
	local remaining = untilTime - Workspace:GetServerTimeNow()
	local target = targetId and Players:GetPlayerByUserId(targetId)
	local character = target and target.Character
	local head = character and character:FindFirstChild("Head") :: BasePart?
	if not character or not head or remaining <= 0 then
		clearMark()
		return
	end
	if markedCharacter ~= character then
		clearMark()
		markedCharacter = character
		local h = Instance.new("Highlight")
		h.FillColor = Color3.fromRGB(255, 40, 40)
		h.FillTransparency = 0.5
		h.OutlineColor = Color3.fromRGB(255, 220, 220)
		h.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
		h.Parent = character
		highlight = h
		local b = Instance.new("BillboardGui")
		b.Name = "RevengeMark"
		b.Size = UDim2.fromOffset(200, 44)
		b.StudsOffsetWorldSpace = Vector3.new(0, 4, 0)
		b.AlwaysOnTop = true
		b.Adornee = head
		b.Parent = player.PlayerGui
		local label = Instance.new("TextLabel")
		label.Name = "Text"
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundTransparency = 1
		label.TextScaled = true
		label.Font = Enum.Font.GothamBlack
		label.TextColor3 = Color3.fromRGB(255, 80, 80)
		label.TextStrokeTransparency = 0
		label.Parent = b
		billboard = b
	end
	local label = billboard and billboard:FindFirstChild("Text") :: TextLabel?
	if label then
		label.Text = string.format("🎯 مطلوب ثأرك %d", math.ceil(remaining))
	end
end

task.spawn(function()
	while true do
		refreshPrompts()
		refreshRevenge()
		task.wait(0.5)
	end
end)
