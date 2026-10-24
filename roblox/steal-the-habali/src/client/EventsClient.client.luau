-- المرحلة 6 عند اللاعب: بانر التنبيهات، والعلامة اللي تنشاف من بعيد، وغبار العاصفة، والعدّادات.
-- كله عرض بس: الأوقات من السيرفر (ReplicatedStorage)، والسيرفر هو اللي يطلّع الهبالي.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local EventsConfig = require(Shared:WaitForChild("EventsConfig"))
local EventRules = require(Shared:WaitForChild("EventRules"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local FxConfig = require(Shared:WaitForChild("FxConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local rules = EventRules.new(EventsConfig)

local function rgb(values: { number }?): Color3
	if not values then
		return Color3.fromRGB(255, 220, 120)
	end
	return Color3.fromRGB(values[1], values[2], values[3])
end

local EVENT_COLORS: { [string]: Color3 } = {
	Storm = Color3.fromRGB(230, 170, 90),
	Event = Color3.fromRGB(255, 220, 120),
}

local function colorFor(rarity: string?, variant: string?): Color3
	if variant then
		for _, v in HabaliConfig.Variants do
			if v.Id == variant then
				return rgb(v.Color)
			end
		end
	end
	if rarity and EVENT_COLORS[rarity] then
		return EVENT_COLORS[rarity]
	end
	return rgb(rarity and HabaliConfig.RarityColors[rarity])
end

-- ===== الواجهة =====

local gui = Instance.new("ScreenGui")
gui.Name = "EventsHud"
gui.ResetOnSpawn = false
gui.DisplayOrder = 4
gui.Parent = player:WaitForChild("PlayerGui")

local banner = Instance.new("TextLabel")
banner.Name = "Alert"
banner.AnchorPoint = Vector2.new(0.5, 0)
banner.Position = UDim2.new(0.5, 0, 0, 120)
banner.Size = UDim2.new(0.62, 0, 0, 40) -- ضيق شوي عشان ما يغطي أزرار الجوال اللي يمين
banner.BackgroundColor3 = Color3.fromRGB(25, 20, 18)
banner.BackgroundTransparency = 0.15
banner.TextScaled = true
banner.Font = Enum.Font.GothamBlack
banner.TextColor3 = Color3.new(1, 1, 1)
banner.TextStrokeTransparency = 0.4
banner.Visible = false
banner.Parent = gui
local bannerLimit = Instance.new("UISizeConstraint")
bannerLimit.MaxSize = Vector2.new(640, 44)
bannerLimit.Parent = banner
local bannerCorner = Instance.new("UICorner")
bannerCorner.CornerRadius = UDim.new(0, 12)
bannerCorner.Parent = banner
local bannerStroke = Instance.new("UIStroke")
bannerStroke.Thickness = 3
bannerStroke.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
bannerStroke.Parent = banner
local bannerPad = Instance.new("UIPadding")
bannerPad.PaddingLeft = UDim.new(0, 12)
bannerPad.PaddingRight = UDim.new(0, 12)
bannerPad.PaddingTop = UDim.new(0, 6)
bannerPad.PaddingBottom = UDim.new(0, 6)
bannerPad.Parent = banner

-- عدّاد صغير: العاصفة والإنفنتي
local pill = Instance.new("TextLabel")
pill.Name = "Countdown"
pill.AnchorPoint = Vector2.new(0.5, 0)
pill.Position = UDim2.new(0.5, 0, 0, 82)
pill.Size = UDim2.fromOffset(300, 26)
pill.BackgroundColor3 = Color3.fromRGB(25, 20, 18)
pill.BackgroundTransparency = 0.35
pill.TextScaled = true
pill.Font = Enum.Font.GothamBold
pill.TextColor3 = Color3.fromRGB(255, 235, 190)
pill.Text = ""
pill.Visible = false
pill.Parent = gui
local pillCorner = Instance.new("UICorner")
pillCorner.CornerRadius = UDim.new(0, 10)
pillCorner.Parent = pill

local alertSound = Instance.new("Sound")
alertSound.SoundId = "rbxassetid://" .. FxConfig.Sounds.Alert.Id
alertSound.Volume = FxConfig.Sounds.Alert.Volume
alertSound.PlaybackSpeed = FxConfig.Sounds.Alert.Pitch or 1
alertSound.Parent = gui

local bannerToken = 0
local function showBanner(text: string, color: Color3)
	bannerToken += 1
	local token = bannerToken
	banner.Text = text
	bannerStroke.Color = color
	banner.Visible = true
	banner.TextTransparency = 0
	banner.BackgroundTransparency = 0.15
	alertSound:Play()
	task.delay(5, function()
		if token == bannerToken then
			TweenService:Create(banner, TweenInfo.new(0.5), { TextTransparency = 1, BackgroundTransparency = 1 }):Play()
			task.delay(0.5, function()
				if token == bannerToken then
					banner.Visible = false
				end
			end)
		end
	end)
end

-- علامة فوق المكان تنشاف من أي مكان في الماب (بدال خريطة صغيرة)
local function beacon(position: Vector3, color: Color3)
	local anchor = Instance.new("Part")
	anchor.Name = "AlertBeacon"
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.CanTouch = false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.Position = position + Vector3.new(0, 12, 0)
	anchor.Parent = Workspace
	local board = Instance.new("BillboardGui")
	board.Size = UDim2.fromOffset(46, 46)
	board.AlwaysOnTop = true
	board.MaxDistance = 6000
	board.Adornee = anchor
	board.Parent = anchor
	local icon = Instance.new("TextLabel")
	icon.Size = UDim2.fromScale(1, 1)
	icon.BackgroundColor3 = color
	icon.BackgroundTransparency = 0.1
	icon.Text = "🚨"
	icon.TextScaled = true
	icon.Parent = board
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = icon
	TweenService:Create(icon, TweenInfo.new(0.6, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { BackgroundTransparency = 0.6 }):Play()
	Debris:AddItem(anchor, EventsConfig.Alerts.BeaconTime)
end

Remotes:WaitForChild("Alert").OnClientEvent:Connect(function(text, rarity, variant, position)
	if type(text) ~= "string" then
		return
	end
	local color = colorFor(if type(rarity) == "string" then rarity else nil, if type(variant) == "string" then variant else nil)
	showBanner(text, color)
	if typeof(position) == "Vector3" then
		beacon(position, color)
	end
end)

-- ===== العاصفة والعدّادات =====

local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
local calm = if atmosphere then { Density = atmosphere.Density, Haze = atmosphere.Haze, Color = atmosphere.Color } else nil
local STORM = { Density = 0.55, Haze = 3, Color = Color3.fromRGB(214, 170, 110) }
local stormShown = false

local function setStorm(on: boolean)
	if on == stormShown or not atmosphere or not calm then
		return
	end
	stormShown = on
	TweenService:Create(atmosphere, TweenInfo.new(4), if on then STORM else calm):Play()
end

local function clock(): number
	local offset = ReplicatedStorage:GetAttribute("EventClockOffset")
	return Workspace:GetServerTimeNow() + (if type(offset) == "number" then offset else 0)
end

task.spawn(function()
	while true do
		task.wait(0.5)
		local t = clock()
		local stormStart = ReplicatedStorage:GetAttribute("SandstormStart")
		local stormEnd = ReplicatedStorage:GetAttribute("SandstormEnd")
		local infStart = ReplicatedStorage:GetAttribute("InfinityStart")
		local infEnd = ReplicatedStorage:GetAttribute("InfinityEnd")
		local lines = {}
		if type(stormStart) == "number" and type(stormEnd) == "number" then
			local active = t >= stormStart and t < stormEnd
			setStorm(active)
			if active then
				table.insert(lines, "🌪️ العاصفة: باقي " .. rules.FormatIn(stormEnd - t))
			elseif stormStart - t <= EventsConfig.Sandstorm.Warning then
				table.insert(lines, "🌪️ عاصفة بعد " .. rules.FormatIn(stormStart - t))
			end
		end
		if type(infStart) == "number" and type(infEnd) == "number" then
			if t >= infStart and t < infEnd then
				local where = ReplicatedStorage:GetAttribute("InfinityWhere")
				table.insert(lines, if type(where) == "string" then "♾️ الإنفنتي عند " .. where else "♾️ الإنفنتي طلع!")
			elseif #lines == 0 then
				table.insert(lines, "♾️ الإنفنتي بعد " .. rules.FormatIn(infStart - t))
			end
		end
		pill.Visible = #lines > 0
		pill.Text = table.concat(lines, "  ·  ")
	end
end)
