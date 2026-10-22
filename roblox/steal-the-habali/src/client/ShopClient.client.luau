-- شاشة المحلات، وعدّاد البنزين، وزر صب الجالون.
-- الشاشة تعرض بس: الأسعار والليفلات من نفس الإعدادات، والسيرفر هو اللي يقرر كل شراء.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ShopConfig = require(Shared:WaitForChild("ShopConfig"))
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local ShopRules = require(Shared:WaitForChild("ShopRules"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local rules = ShopRules.new(ShopConfig, BaseConfig)

local function remote(name: string): RemoteEvent
	return Remotes:WaitForChild(name) :: RemoteEvent
end

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function money(): number
	return player:GetAttribute("Money") or 0
end

local function myGear(): ShopRules.Gear
	local raw = {}
	for _, key in rules.Keys() do
		raw[key] = player:GetAttribute("Gear_" .. key)
	end
	return rules.SanitizeGear(raw)
end

local function myCar(): Model?
	local cars = Workspace:FindFirstChild("Cars")
	if not cars then
		return nil
	end
	for _, car in cars:GetChildren() do
		if car:GetAttribute("OwnerUserId") == player.UserId then
			return car :: Model
		end
	end
	return nil
end

-- ===== الشاشة =====

local gui = Instance.new("ScreenGui")
gui.Name = "ShopGui"
gui.ResetOnSpawn = false
gui.DisplayOrder = 5
gui.Enabled = false
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(parent: Instance, radius: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius)
	c.Parent = parent
end

local function label(parent: Instance, text: string, size: UDim2, position: UDim2, font: Enum.Font, color: Color3, maxText: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = size
	l.Position = position
	l.Font = font
	l.TextColor3 = color
	l.TextScaled = true
	l.Text = text
	l.TextXAlignment = Enum.TextXAlignment.Right -- عربي
	l.Parent = parent
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = maxText
	limit.MinTextSize = 10
	limit.Parent = l
	return l
end

-- اللوحة في النص، عرضها 92% من الشاشة لين 560
local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.fromScale(0.92, 0.86)
panel.BackgroundColor3 = Color3.fromRGB(32, 28, 24)
panel.BackgroundTransparency = 0.05
panel.Parent = gui
corner(panel, 16)
local sizeLimit = Instance.new("UISizeConstraint")
sizeLimit.MaxSize = Vector2.new(560, 460)
sizeLimit.Parent = panel

local title = label(panel, "", UDim2.new(1, -90, 0, 40), UDim2.fromOffset(16, 8), Enum.Font.GothamBlack, Color3.fromRGB(255, 225, 120), 30)
local wallet = label(panel, "", UDim2.new(1, -90, 0, 24), UDim2.fromOffset(16, 46), Enum.Font.GothamBold, Color3.fromRGB(150, 255, 160), 20)

local close = Instance.new("TextButton")
close.Name = "Close"
close.Size = UDim2.fromOffset(52, 52)
close.Position = UDim2.fromOffset(10, 10)
close.BackgroundColor3 = Color3.fromRGB(190, 60, 60)
close.Text = "X"
close.TextScaled = true
close.Font = Enum.Font.GothamBlack
close.TextColor3 = Color3.new(1, 1, 1)
close.Parent = panel
corner(close, 12)

local list = Instance.new("ScrollingFrame")
list.Name = "List"
list.Position = UDim2.fromOffset(12, 78)
list.Size = UDim2.new(1, -24, 1, -90)
list.BackgroundTransparency = 1
list.BorderSizePixel = 0
list.ScrollBarThickness = 6
list.AutomaticCanvasSize = Enum.AutomaticSize.Y
list.CanvasSize = UDim2.new()
list.Parent = panel
local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 8)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = list

local openShop: string? = nil
local render: () -> ()

-- صف: عنوان وسطر تحته، وزر على اليسار
local function row(order: number, heading: string, detail: string, buttonText: string, enabled: boolean, onPress: () -> ())
	local frame = Instance.new("Frame")
	frame.LayoutOrder = order
	frame.Size = UDim2.new(1, -8, 0, 80)
	frame.BackgroundColor3 = Color3.fromRGB(58, 50, 42)
	frame.Parent = list
	corner(frame, 12)
	label(frame, heading, UDim2.new(1, -170, 0, 32), UDim2.fromOffset(10, 6), Enum.Font.GothamBlack, Color3.new(1, 1, 1), 24)
	label(frame, detail, UDim2.new(1, -170, 0, 30), UDim2.fromOffset(10, 40), Enum.Font.GothamBold, Color3.fromRGB(230, 220, 200), 20)
	local button = Instance.new("TextButton")
	button.Size = UDim2.fromOffset(146, 56)
	button.Position = UDim2.new(0, 10, 0.5, -28)
	button.BackgroundColor3 = if enabled then Color3.fromRGB(60, 170, 90) else Color3.fromRGB(90, 90, 90)
	button.AutoButtonColor = enabled
	button.Text = buttonText
	button.TextScaled = true
	button.Font = Enum.Font.GothamBlack
	button.TextColor3 = Color3.new(1, 1, 1)
	button.Parent = frame
	corner(button, 12)
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.PaddingTop = UDim.new(0, 8)
	pad.PaddingBottom = UDim.new(0, 8)
	pad.Parent = button
	button.Activated:Connect(function()
		if enabled then
			onPress()
		end
	end)
end

local UPGRADE_TEXT: { [string]: (any, any) -> string } = {
	Melee = function(now, nextLevel)
		return string.format("ضربات الأسطوري: %d ← %d", now.Hits.Legendary, nextLevel.Hits.Legendary)
	end,
	Gun = function(now, nextLevel)
		local cloud = if nextLevel.Cloud > 0 then "، غيمة نوم 💤" else ""
		return string.format("المدى %d ← %d، طلقات الأسطوري %d ← %d%s", now.Range, nextLevel.Range, now.Shots.Legendary, nextLevel.Shots.Legendary, cloud)
	end,
	Engine = function(now, nextLevel)
		return string.format("السرعة %d ← %d", now.Speed, nextLevel.Speed)
	end,
	Load = function(now, nextLevel)
		return string.format("الحمولة %d ← %d", now.Capacity, nextLevel.Capacity)
	end,
	Tank = function(now, nextLevel)
		return string.format("التانكي %s ← %s", formatMoney(now.Size), formatMoney(nextLevel.Size))
	end,
}

local UPGRADE_ORDER = { "Melee", "Gun", "Engine", "Load", "Tank" }

local function upgradeRows()
	local gear = myGear()
	local order = 0
	for _, key in UPGRADE_ORDER do
		if ShopConfig.Upgrades[key] == openShop then
			order += 1
			local level = (gear :: any)[key]
			local now = rules.Level(key, level)
			local nextLevel, price = rules.Next(gear, key)
			if nextLevel then
				local affordable = money() >= (price :: number)
				row(order, nextLevel.Name, UPGRADE_TEXT[key](now, nextLevel), "💰 " .. formatMoney(price :: number), affordable, function()
					remote("ShopBuy"):FireServer(key)
				end)
			else
				row(order, now.Name, "✅ عندك أقوى شي", "الأقوى", false, function() end)
			end
		end
	end
end

function render()
	for _, child in list:GetChildren() do
		if child:IsA("Frame") then
			child:Destroy()
		end
	end
	if not openShop then
		return
	end
	local shop
	for _, s in ShopConfig.Shops do
		if s.Id == openShop then
			shop = s
		end
	end
	title.Text = if shop then shop.Name .. " · " .. shop.Title else ""
	wallet.Text = "💰 " .. formatMoney(money())
	if openShop == "Habal" then
		local car = myCar()
		local load = car and car:GetAttribute("Load") or 0
		row(1, "بيع اللي في سيارتك", if load > 0 then "قرّب السيارة من الدكان، وانزل منها" else "سيارتك فاضية", "بيع 🚙", load > 0, function()
			remote("ShopSell"):FireServer("Cargo")
		end)
		local carrying = player:GetAttribute("Carrying") == true
		row(2, "بيع اللي فوق راسك", if carrying then "الهبالي اللي شايله" else "ما تشيل شي", "بيع 🦹", carrying, function()
			remote("ShopSell"):FireServer("Carried")
		end)
		row(3, "الأسعار", "دخل 5 دقايق: شعبي 300، نادر 1,200، نادر مرة 4,500، أسطوري 15,000", "", false, function() end)
	elseif openShop == "Fuel" then
		local car = myCar()
		local fuel = car and car:GetAttribute("Fuel") or 0
		local tank = car and car:GetAttribute("Tank") or 0
		local cost = rules.RefillCost(fuel, tank)
		local detail = if not car then "طلّع سيارتك وجيبها عند المضخة" else string.format("⛽ %s / %s", formatMoney(fuel), formatMoney(tank))
		row(1, "عبّي البنزين", detail, if car and cost > 0 then "💰 " .. formatMoney(cost) else "مليان", car ~= nil and cost > 0 and money() > 0, function()
			remote("ShopFuel"):FireServer()
		end)
		local jerries = player:GetAttribute("Jerries") or 0
		local canBuy = jerries < ShopConfig.Fuel.MaxJerries and money() >= ShopConfig.Fuel.JerryPrice
		row(2, "جالون احتياط 🛢️", string.format("يعطيك %s stud · معك %d من %d", formatMoney(ShopConfig.Fuel.JerryAmount), jerries, ShopConfig.Fuel.MaxJerries), "💰 " .. formatMoney(ShopConfig.Fuel.JerryPrice), canBuy, function()
			remote("ShopJerry"):FireServer()
		end)
	else
		upgradeRows()
	end
end

local function closeShop()
	openShop = nil
	gui.Enabled = false
end

close.Activated:Connect(closeShop)

remote("ShopOpen").OnClientEvent:Connect(function(shopId)
	if type(shopId) ~= "string" then
		return
	end
	openShop = shopId
	gui.Enabled = true
	render()
end)

-- أي تغيير في الفلوس أو العدّة أو السيارة: نحدّث الشاشة
for _, name in { "Money", "Jerries", "Carrying" } do
	player:GetAttributeChangedSignal(name):Connect(function()
		if openShop then
			render()
		end
	end)
end
for _, key in rules.Keys() do
	player:GetAttributeChangedSignal("Gear_" .. key):Connect(function()
		if openShop then
			render()
		end
	end)
end

-- ===== عدّاد البنزين (فوق في النص لما تكون سايق سيارتك) =====

local hud = Instance.new("ScreenGui")
hud.Name = "FuelHud"
hud.ResetOnSpawn = false
hud.Parent = player:WaitForChild("PlayerGui")

local gauge = Instance.new("Frame")
gauge.Name = "Fuel"
gauge.AnchorPoint = Vector2.new(0.5, 0)
gauge.Position = UDim2.new(0.5, 0, 0, 44)
gauge.Size = UDim2.fromOffset(220, 30)
gauge.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
gauge.BackgroundTransparency = 0.25
gauge.Visible = false
gauge.Parent = hud
corner(gauge, 10)
local fill = Instance.new("Frame")
fill.Name = "Fill"
fill.Size = UDim2.fromScale(1, 1)
fill.BackgroundColor3 = Color3.fromRGB(80, 200, 100)
fill.Parent = gauge
corner(fill, 10)
local gaugeText = Instance.new("TextLabel")
gaugeText.Size = UDim2.fromScale(1, 1)
gaugeText.BackgroundTransparency = 1
gaugeText.TextScaled = true
gaugeText.Font = Enum.Font.GothamBold
gaugeText.TextColor3 = Color3.new(1, 1, 1)
gaugeText.TextStrokeTransparency = 0.3
gaugeText.Parent = gauge

local function seatedInMine(car: Model?): boolean
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local seat = car and car:FindFirstChild("DriverSeat") :: VehicleSeat?
	return seat ~= nil and humanoid ~= nil and seat.Occupant == humanoid
end

task.spawn(function()
	while true do
		task.wait(0.25)
		local car = myCar()
		local seated = seatedInMine(car)
		local fuel = car and car:GetAttribute("Fuel") or 0
		local tank = car and car:GetAttribute("Tank") or 1
		gauge.Visible = seated
		if seated then
			local ratio = math.clamp(fuel / math.max(tank, 1), 0, 1)
			fill.Size = UDim2.fromScale(ratio, 1)
			fill.BackgroundColor3 = if ratio < 0.2 then Color3.fromRGB(220, 60, 50) elseif ratio < 0.45 then Color3.fromRGB(230, 170, 40) else Color3.fromRGB(80, 200, 100)
			local jerries = player:GetAttribute("Jerries") or 0
			gaugeText.Text = string.format("⛽ %d%%%s", math.floor(ratio * 100), if jerries > 0 then "  🛢️×" .. jerries else "")
		end
		-- زر صب الجالون: لصاحب السيارة لو معه جالون وهو نازل منها
		local prompt = car and car:FindFirstChild("Chassis") and car.Chassis:FindFirstChild("JerryPrompt") :: ProximityPrompt?
		if prompt then
			prompt.Enabled = not seated and (player:GetAttribute("Jerries") or 0) > 0 and fuel < tank
		end
		-- نسكّر المحل لو بعدت عن البياع
		if openShop then
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			local shops = Workspace:FindFirstChild("Map") and Workspace.Map:FindFirstChild("Shops")
			local near = false
			if root and shops then
				for _, keeper in shops:GetChildren() do
					local keeperRoot = keeper:FindFirstChild("HumanoidRootPart") :: BasePart?
					local prompt2 = keeperRoot and keeperRoot:FindFirstChild("OpenShop") :: ProximityPrompt?
					if prompt2 and (keeperRoot :: BasePart).Position and (root.Position - (keeperRoot :: BasePart).Position).Magnitude <= ShopConfig.ShopDistance + 8 then
						near = true
					end
				end
			end
			if not near then
				closeShop()
			end
		end
	end
end)
