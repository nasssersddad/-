-- الواجهة: المرحلة والعالم، المؤقت، لافتة العالم الجديد، زر البداية، وشاشة الفوز

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Format = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Format"))

local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local restartRemote = remotes:WaitForChild("Restart") :: RemoteEvent
local notifyRemote = remotes:WaitForChild("Notify") :: RemoteEvent

local FONT = Enum.Font.GothamBold
local WHITE = Color3.new(1, 1, 1)
local DARK = Color3.fromRGB(20, 20, 30)

-- ========== أدوات صغيرة ==========

local function corner(parent: GuiObject, radius: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius)
	c.Parent = parent
end

local function stroke(parent: GuiObject, color: Color3, thickness: number)
	local s = Instance.new("UIStroke")
	s.Color = color
	s.Thickness = thickness
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = parent
end

local function label(parent: Instance, text: string, size: UDim2, position: UDim2, textColor: Color3?): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = size
	l.Position = position
	l.Text = text
	l.TextScaled = true
	l.Font = FONT
	l.TextColor3 = textColor or WHITE
	l.Parent = parent
	return l
end

local function button(parent: Instance, text: string, size: UDim2, position: UDim2, color: Color3): TextButton
	local b = Instance.new("TextButton")
	b.Size = size
	b.Position = position
	b.BackgroundColor3 = color
	b.Text = text
	b.TextScaled = true
	b.Font = FONT
	b.TextColor3 = WHITE
	b.AutoButtonColor = true
	b.Parent = parent
	corner(b, 12)
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 6)
	pad.PaddingBottom = UDim.new(0, 6)
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.Parent = b
	return b
end

local function playSound(id: string, volume: number)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume
	s.Parent = SoundService
	s:Play()
	s.Ended:Once(function()
		s:Destroy()
	end)
end

-- ========== الشاشة ==========

local gui = Instance.new("ScreenGui")
gui.Name = "ObbyHud"
gui.ResetOnSpawn = false
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

-- لوحة فوق: العالم والمرحلة
local top = Instance.new("Frame")
top.AnchorPoint = Vector2.new(0.5, 0)
top.Position = UDim2.new(0.5, 0, 0, 8)
top.Size = UDim2.new(0.5, 0, 0, 78)
top.BackgroundColor3 = DARK
top.BackgroundTransparency = 0.25
top.Parent = gui
corner(top, 14)
local topLimit = Instance.new("UISizeConstraint")
topLimit.MinSize = Vector2.new(260, 78)
topLimit.MaxSize = Vector2.new(460, 78)
topLimit.Parent = top

local worldLabel = label(top, "", UDim2.new(1, -16, 0, 30), UDim2.fromOffset(8, 6))
local descLabel = label(top, "", UDim2.new(1, -16, 0, 18), UDim2.fromOffset(8, 36), Color3.fromRGB(210, 210, 225))
local timerLabel = label(top, "", UDim2.new(1, -16, 0, 16), UDim2.fromOffset(8, 56), Color3.fromRGB(255, 220, 120))

-- شريط التقدّم تحت اللوحة
local progressBack = Instance.new("Frame")
progressBack.AnchorPoint = Vector2.new(0.5, 0)
progressBack.Position = UDim2.new(0.5, 0, 0, 90)
progressBack.Size = UDim2.new(0.5, 0, 0, 8)
progressBack.BackgroundColor3 = DARK
progressBack.BackgroundTransparency = 0.3
progressBack.Parent = gui
corner(progressBack, 4)
local progressLimit = topLimit:Clone()
progressLimit.MinSize = Vector2.new(260, 8)
progressLimit.MaxSize = Vector2.new(460, 8)
progressLimit.Parent = progressBack
local progressFill = Instance.new("Frame")
progressFill.Size = UDim2.fromScale(0, 1)
progressFill.BackgroundColor3 = Color3.fromRGB(90, 255, 130)
progressFill.Parent = progressBack
corner(progressFill, 4)

-- لافتة كبيرة بالنص
local banner = Instance.new("Frame")
banner.AnchorPoint = Vector2.new(0.5, 0.5)
banner.Position = UDim2.fromScale(0.5, 0.35)
banner.Size = UDim2.fromScale(0.7, 0.18)
banner.BackgroundTransparency = 1
banner.Visible = false
banner.Parent = gui
local bannerTitle = label(banner, "", UDim2.fromScale(1, 0.62), UDim2.fromScale(0, 0))
bannerTitle.Font = Enum.Font.GothamBlack
local bannerStroke = Instance.new("UIStroke")
bannerStroke.Thickness = 3
bannerStroke.Color = DARK
bannerStroke.Parent = bannerTitle
local bannerDesc = label(banner, "", UDim2.fromScale(1, 0.32), UDim2.fromScale(0, 0.66))
local descStroke = bannerStroke:Clone()
descStroke.Thickness = 2
descStroke.Parent = bannerDesc

-- رسالة صغيرة (نقطة حفظ / أخبار)
local toast = label(gui, "", UDim2.new(0.6, 0, 0, 34), UDim2.new(0.2, 0, 0, 108), WHITE)
toast.TextTransparency = 1
local toastStroke = bannerStroke:Clone()
toastStroke.Thickness = 2
toastStroke.Parent = toast

-- زر "من البداية"
local restartButton = button(gui, "↩️ من البداية", UDim2.fromOffset(150, 46), UDim2.fromOffset(12, 8), Color3.fromRGB(70, 70, 90))
stroke(restartButton, WHITE, 1)

-- نافذة تأكيد
local confirm = Instance.new("Frame")
confirm.AnchorPoint = Vector2.new(0.5, 0.5)
confirm.Position = UDim2.fromScale(0.5, 0.5)
confirm.Size = UDim2.fromOffset(320, 170)
confirm.BackgroundColor3 = DARK
confirm.Visible = false
confirm.Parent = gui
corner(confirm, 16)
stroke(confirm, Color3.fromRGB(255, 220, 80), 2)
label(confirm, "ترجع للمرحلة 1؟", UDim2.new(1, -20, 0, 36), UDim2.fromOffset(10, 14))
label(confirm, "المؤقت يبدأ من جديد عشان تسجّل أفضل وقت", UDim2.new(1, -20, 0, 22), UDim2.fromOffset(10, 54), Color3.fromRGB(210, 210, 225))
local yesButton = button(confirm, "✅ إيه", UDim2.fromOffset(130, 46), UDim2.fromOffset(20, 106), Color3.fromRGB(60, 170, 90))
local noButton = button(confirm, "❌ لا", UDim2.fromOffset(130, 46), UDim2.fromOffset(170, 106), Color3.fromRGB(170, 60, 70))

-- شاشة الفوز
local winPanel = Instance.new("Frame")
winPanel.AnchorPoint = Vector2.new(0.5, 0.5)
winPanel.Position = UDim2.fromScale(0.5, 0.5)
winPanel.Size = UDim2.fromOffset(360, 260)
winPanel.BackgroundColor3 = DARK
winPanel.Visible = false
winPanel.Parent = gui
corner(winPanel, 18)
stroke(winPanel, Color3.fromRGB(255, 215, 80), 3)
label(winPanel, "🏆 خلّصت أوبي المقلوب!", UDim2.new(1, -20, 0, 44), UDim2.fromOffset(10, 16), Color3.fromRGB(255, 220, 80))
local winTime = label(winPanel, "", UDim2.new(1, -20, 0, 30), UDim2.fromOffset(10, 70))
local winBest = label(winPanel, "", UDim2.new(1, -20, 0, 24), UDim2.fromOffset(10, 106), Color3.fromRGB(210, 210, 225))
local winCount = label(winPanel, "", UDim2.new(1, -20, 0, 24), UDim2.fromOffset(10, 136), Color3.fromRGB(210, 210, 225))
local againButton = button(winPanel, "🔁 العب من جديد", UDim2.fromOffset(200, 50), UDim2.new(0.5, -100, 1, -70), Color3.fromRGB(60, 170, 90))

-- ========== التحديث ==========

local shownStage: number? = nil
local finishedTime: number? = nil

local function showToast(text: string)
	toast.Text = text
	toast.TextTransparency = 0
	toastStroke.Transparency = 0
	local info = TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, 2.2)
	TweenService:Create(toast, info, { TextTransparency = 1 }):Play()
	TweenService:Create(toastStroke, info, { Transparency = 1 }):Play()
end

local function showBanner(title: string, desc: string, color: Color3)
	bannerTitle.Text = title
	bannerTitle.TextColor3 = color
	bannerDesc.Text = desc
	banner.Visible = true
	banner.Size = UDim2.fromScale(0.35, 0.09)
	TweenService:Create(banner, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Size = UDim2.fromScale(0.7, 0.18) }):Play()
	task.delay(3.2, function()
		if bannerTitle.Text == title then
			banner.Visible = false
		end
	end)
end

local function updateStage()
	local stage = player:GetAttribute("Stage") or 1
	local finished = stage >= Config.FinishedStage
	local worldIndex = Config.worldIndexForStage(math.min(stage, Config.FinalStage)) or 1
	local world = Config.Worlds[worldIndex]

	if finished then
		worldLabel.Text = "🏆 خلّصت كل العوالم!"
		descLabel.Text = "تقدر تلعب من جديد وتكسر وقتك"
	else
		worldLabel.Text = string.format("%s %s — المرحلة %d / %d", world.icon, world.name, stage, Config.FinalStage)
		descLabel.Text = world.desc
	end
	worldLabel.TextColor3 = if finished then Color3.fromRGB(255, 220, 80) else world.colors[1]
	local done = math.clamp((stage - 1) / Config.FinalStage, 0, 1)
	TweenService:Create(progressFill, TweenInfo.new(0.4), { Size = UDim2.fromScale(done, 1) }):Play()

	restartButton.Visible = stage > 1
	if not finished then
		winPanel.Visible = false
		finishedTime = nil
	end

	-- أول مرة نعرض المرحلة (لما يدخل اللعبة) ما نعرض رسايل
	if shownStage ~= nil and stage > shownStage and not finished then
		playSound("rbxasset://sounds/electronicpingshort.wav", 0.6)
		if Config.isWorldStart(stage) then
			showBanner(string.format("%s العالم %d: %s", world.icon, worldIndex, world.name), world.desc, world.colors[1])
		else
			showToast(string.format("✅ المرحلة %d!", stage))
		end
	elseif shownStage == nil and not finished then
		showBanner(string.format("%s %s", world.icon, world.name), world.desc, world.colors[1])
	end
	shownStage = stage
end

player:GetAttributeChangedSignal("Stage"):Connect(updateStage)
updateStage()

-- المؤقت
task.spawn(function()
	while true do
		local start = player:GetAttribute("RunStart")
		if finishedTime then
			timerLabel.Text = "⏱️ " .. Format.time(finishedTime)
		elseif type(start) == "number" then
			local best = player:GetAttribute("BestTime")
			local text = "⏱️ " .. Format.time(Workspace:GetServerTimeNow() - start)
			if type(best) == "number" then
				text ..= "   🥇 " .. Format.time(best)
			end
			timerLabel.Text = text
		end
		task.wait(0.1)
	end
end)

-- الأزرار
restartButton.Activated:Connect(function()
	confirm.Visible = true
end)
noButton.Activated:Connect(function()
	confirm.Visible = false
end)
yesButton.Activated:Connect(function()
	confirm.Visible = false
	restartRemote:FireServer()
end)
againButton.Activated:Connect(function()
	winPanel.Visible = false
	restartRemote:FireServer()
end)

-- رسايل السيرفر
notifyRemote.OnClientEvent:Connect(function(data)
	if type(data) ~= "table" then
		return
	end
	if data.kind == "win" then
		finishedTime = data.time
		winTime.Text = if data.fullRun then "⏱️ وقتك: " .. Format.time(data.time) else "⏱️ ما بدأت من المرحلة 1، فالوقت ما ينحسب"
		winBest.Text = if data.newBest
			then "🎉 رقم قياسي جديد!"
			elseif type(data.best) == "number" then "🥇 أفضل وقت: " .. Format.time(data.best)
			else ""
		winCount.Text = string.format("🏅 عدد مرات الفوز: %d", data.wins or 1)
		winPanel.Visible = true
		winPanel.Size = UDim2.fromOffset(180, 130)
		TweenService:Create(winPanel, TweenInfo.new(0.4, Enum.EasingStyle.Back), { Size = UDim2.fromOffset(360, 260) }):Play()
		playSound("rbxasset://sounds/electronicpingshort.wav", 1)
	elseif data.kind == "message" and type(data.text) == "string" then
		showToast(data.text)
	end
end)
