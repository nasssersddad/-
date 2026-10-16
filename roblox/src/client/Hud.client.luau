-- الواجهة: المرحلة والعالم، المؤقت، لافتة العالم الجديد، زر البداية، وشاشة الفوز
-- وفي الوضع التعاوني 🪢: اسم خويك، مراحل درب الحبل، وزر فك الحبل

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
local coopLeaveRemote = remotes:WaitForChild("CoopLeave") :: RemoteEvent
local coopRestartRemote = remotes:WaitForChild("CoopRestart") :: RemoteEvent

local CoopConfig = Config.Coop
local FONT = Enum.Font.GothamBold
local WHITE = Color3.new(1, 1, 1)
local DARK = Color3.fromRGB(20, 20, 30)
local SUBTLE = Color3.fromRGB(210, 210, 225)
local GOLD = Color3.fromRGB(255, 220, 80)
local PING = "rbxasset://sounds/electronicpingshort.wav"

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

local function textStroke(parent: TextLabel, thickness: number): UIStroke
	local s = Instance.new("UIStroke")
	s.Thickness = thickness
	s.Color = DARK
	s.Parent = parent
	return s
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

local function partnerName(): string?
	local id = player:GetAttribute("Partner")
	if type(id) ~= "number" then
		return nil
	end
	local partner = Players:GetPlayerByUserId(id)
	return if partner then partner.DisplayName else "خويك"
end

local function isCoop(): boolean
	return type(player:GetAttribute("Partner")) == "number"
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
local descLabel = label(top, "", UDim2.new(1, -16, 0, 18), UDim2.fromOffset(8, 36), SUBTLE)
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
local progressLimit = Instance.new("UISizeConstraint")
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
textStroke(bannerTitle, 3)
local bannerDesc = label(banner, "", UDim2.fromScale(1, 0.32), UDim2.fromScale(0, 0.66))
textStroke(bannerDesc, 2)

-- رسالة صغيرة (نقطة حفظ / أخبار)
local toast = label(gui, "", UDim2.new(0.6, 0, 0, 34), UDim2.new(0.2, 0, 0, 108), WHITE)
toast.TextTransparency = 1
local toastStroke = textStroke(toast, 2)
toastStroke.Transparency = 1

-- زر "من البداية" (عادي) وزر "فك الحبل" (تعاوني) بنفس المكان
local restartButton = button(gui, "↩️ من البداية", UDim2.fromOffset(150, 46), UDim2.fromOffset(12, 8), Color3.fromRGB(70, 70, 90))
stroke(restartButton, WHITE, 1)
local leaveButton = button(gui, "✂️ فك الحبل", UDim2.fromOffset(150, 46), UDim2.fromOffset(12, 8), Color3.fromRGB(150, 80, 60))
stroke(leaveButton, WHITE, 1)
leaveButton.Visible = false

-- نافذة تأكيد
local confirm = Instance.new("Frame")
confirm.AnchorPoint = Vector2.new(0.5, 0.5)
confirm.Position = UDim2.fromScale(0.5, 0.5)
confirm.Size = UDim2.fromOffset(320, 170)
confirm.BackgroundColor3 = DARK
confirm.Visible = false
confirm.ZIndex = 5
confirm.Parent = gui
corner(confirm, 16)
stroke(confirm, GOLD, 2)
local confirmTitle = label(confirm, "", UDim2.new(1, -20, 0, 36), UDim2.fromOffset(10, 14))
local confirmDesc = label(confirm, "", UDim2.new(1, -20, 0, 22), UDim2.fromOffset(10, 54), SUBTLE)
local yesButton = button(confirm, "✅ إيه", UDim2.fromOffset(130, 46), UDim2.fromOffset(20, 106), Color3.fromRGB(60, 170, 90))
local noButton = button(confirm, "❌ لا", UDim2.fromOffset(130, 46), UDim2.fromOffset(170, 106), Color3.fromRGB(170, 60, 70))
local confirmAction: (() -> ())? = nil

local function askConfirm(title: string, desc: string, action: () -> ())
	confirmTitle.Text = title
	confirmDesc.Text = desc
	confirmAction = action
	confirm.Visible = true
end

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
local winTitle = label(winPanel, "", UDim2.new(1, -20, 0, 44), UDim2.fromOffset(10, 16), GOLD)
local winTime = label(winPanel, "", UDim2.new(1, -20, 0, 30), UDim2.fromOffset(10, 70))
local winLine1 = label(winPanel, "", UDim2.new(1, -20, 0, 24), UDim2.fromOffset(10, 106), SUBTLE)
local winLine2 = label(winPanel, "", UDim2.new(1, -20, 0, 24), UDim2.fromOffset(10, 136), SUBTLE)
local againButton = button(winPanel, "🔁 العب من جديد", UDim2.fromOffset(200, 50), UDim2.new(0.5, -100, 1, -70), Color3.fromRGB(60, 170, 90))
local winLeaveButton = button(winPanel, "✂️ فك الحبل", UDim2.fromOffset(150, 50), UDim2.new(0.5, 5, 1, -70), Color3.fromRGB(150, 80, 60))
winLeaveButton.Visible = false
local winIsCoop = false

local function showWin(coop: boolean, title: string, timeText: string, line1: string, line2: string)
	winIsCoop = coop
	winTitle.Text = title
	winTime.Text = timeText
	winLine1.Text = line1
	winLine2.Text = line2
	winLeaveButton.Visible = coop
	if coop then
		againButton.Size = UDim2.fromOffset(150, 50)
		againButton.Position = UDim2.new(0.5, -155, 1, -70)
	else
		againButton.Size = UDim2.fromOffset(200, 50)
		againButton.Position = UDim2.new(0.5, -100, 1, -70)
	end
	winPanel.Visible = true
	winPanel.Size = UDim2.fromOffset(180, 130)
	TweenService:Create(winPanel, TweenInfo.new(0.4, Enum.EasingStyle.Back), { Size = UDim2.fromOffset(360, 260) }):Play()
	playSound(PING, 1)
end

-- ========== التحديث ==========

local shownKey: string? = nil -- "solo:5" أو "coop:3"
local frozenTime: number? = nil -- الوقت النهائي بعد ما تخلّص

local function showToast(text: string)
	toast.Text = text
	toast.TextTransparency = 0
	toastStroke.Transparency = 0
	local info = TweenInfo.new(0.6, Enum.EasingStyle.Quad, Enum.EasingDirection.In, 0, false, 2.2)
	TweenService:Create(toast, info, { TextTransparency = 1 }):Play()
	TweenService:Create(toastStroke, info, { Transparency = 1 }):Play()
end

local bannerToken = 0
local function showBanner(title: string, desc: string, color: Color3)
	bannerToken += 1
	local token = bannerToken
	bannerTitle.Text = title
	bannerTitle.TextColor3 = color
	bannerDesc.Text = desc
	banner.Visible = true
	banner.Size = UDim2.fromScale(0.35, 0.09)
	TweenService:Create(banner, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Size = UDim2.fromScale(0.7, 0.18) }):Play()
	task.delay(3.2, function()
		if bannerToken == token then
			banner.Visible = false
		end
	end)
end

local function setProgress(done: number)
	TweenService:Create(progressFill, TweenInfo.new(0.4), { Size = UDim2.fromScale(math.clamp(done, 0, 1), 1) }):Play()
end

local function updateSolo()
	local stage = player:GetAttribute("Stage") or 1
	local finished = stage >= Config.FinishedStage
	local worldIndex = Config.worldIndexForStage(math.min(stage, Config.FinalStage)) or 1
	local world = Config.Worlds[worldIndex]

	if finished then
		worldLabel.Text = "🏆 خلّصت كل العوالم!"
		descLabel.Text = "تقدر تلعب من جديد وتكسر وقتك"
		worldLabel.TextColor3 = GOLD
	else
		worldLabel.Text = string.format("%s %s — المرحلة %d / %d", world.icon, world.name, stage, Config.FinalStage)
		descLabel.Text = world.desc
		worldLabel.TextColor3 = world.colors[1]
	end
	setProgress((stage - 1) / Config.FinalStage)
	restartButton.Visible = stage > 1
	leaveButton.Visible = false

	local key = "solo:" .. stage
	if key == shownKey then
		return
	end
	local previous = shownKey
	shownKey = key
	if not finished then
		frozenTime = nil
		if winPanel.Visible and not winIsCoop then
			winPanel.Visible = false
		end
	end
	if finished then
		return
	end
	local previousStage = previous and tonumber(string.match(previous, "^solo:(%d+)$"))
	if previousStage and stage > previousStage then
		playSound(PING, 0.6)
		if Config.isWorldStart(stage) then
			showBanner(string.format("%s العالم %d: %s", world.icon, worldIndex, world.name), world.desc, world.colors[1])
		else
			showToast(string.format("✅ المرحلة %d!", stage))
		end
	elseif not previousStage then
		-- أول مرة (دخلت اللعبة أو رجعت من الوضع التعاوني)
		showBanner(string.format("%s %s", world.icon, world.name), world.desc, world.colors[1])
	end
end

local function updateCoop()
	local stage = player:GetAttribute("CoopStage")
	if type(stage) ~= "number" then
		stage = 1
	end
	local finished = stage >= CoopConfig.FinishedStage
	local name = partnerName() or "خويك"

	if finished then
		worldLabel.Text = "🪢🏆 خلّصتوا درب الحبل!"
		worldLabel.TextColor3 = GOLD
	else
		worldLabel.Text = string.format("%s %s — المرحلة %d / %d", CoopConfig.icon, CoopConfig.name, stage, CoopConfig.FinalStage)
		worldLabel.TextColor3 = CoopConfig.colors[1]
	end
	descLabel.Text = string.format("مربوط مع %s • اضغط E أو 🪢 عشان تسحبه", name)
	setProgress((stage - 1) / CoopConfig.FinalStage)
	restartButton.Visible = false
	leaveButton.Visible = true

	local key = "coop:" .. stage
	if key == shownKey then
		return
	end
	local previous = shownKey
	shownKey = key
	if not finished then
		frozenTime = nil
		if winPanel.Visible and winIsCoop then
			winPanel.Visible = false
		end
	end
	local previousStage = previous and tonumber(string.match(previous, "^coop:(%d+)$"))
	if not finished and previousStage and stage > previousStage then
		playSound(PING, 0.6)
		showToast(string.format("✅ المرحلة %d! انتو الثنين", stage))
	end
end

local function updateDisplay()
	if isCoop() then
		updateCoop()
	else
		if winPanel.Visible and winIsCoop then
			winPanel.Visible = false
		end
		updateSolo()
	end
end

for _, attribute in { "Stage", "CoopStage", "Partner" } do
	player:GetAttributeChangedSignal(attribute):Connect(updateDisplay)
end
updateDisplay()

-- المؤقت
task.spawn(function()
	while true do
		local coop = isCoop()
		local start = player:GetAttribute(if coop then "CoopStart" else "RunStart")
		if frozenTime then
			timerLabel.Text = "⏱️ " .. Format.time(frozenTime)
		elseif type(start) == "number" then
			local text = "⏱️ " .. Format.time(Workspace:GetServerTimeNow() - start)
			local best = player:GetAttribute("BestTime")
			if not coop and type(best) == "number" then
				text ..= "   🥇 " .. Format.time(best)
			end
			timerLabel.Text = text
		else
			timerLabel.Text = ""
		end
		task.wait(0.1)
	end
end)

-- الأزرار
restartButton.Activated:Connect(function()
	askConfirm("ترجع للمرحلة 1؟", "المؤقت يبدأ من جديد عشان تسجّل أفضل وقت", function()
		restartRemote:FireServer()
	end)
end)
leaveButton.Activated:Connect(function()
	askConfirm("تفك الحبل؟", "ترجعون الثنين للأوبي العادي", function()
		coopLeaveRemote:FireServer()
	end)
end)
noButton.Activated:Connect(function()
	confirm.Visible = false
	confirmAction = nil
end)
yesButton.Activated:Connect(function()
	confirm.Visible = false
	local action = confirmAction
	confirmAction = nil
	if action then
		action()
	end
end)
againButton.Activated:Connect(function()
	winPanel.Visible = false
	if winIsCoop then
		coopRestartRemote:FireServer()
	else
		restartRemote:FireServer()
	end
end)
winLeaveButton.Activated:Connect(function()
	winPanel.Visible = false
	coopLeaveRemote:FireServer()
end)

-- رسايل السيرفر
notifyRemote.OnClientEvent:Connect(function(data)
	if type(data) ~= "table" then
		return
	end
	if data.kind == "win" then
		frozenTime = data.time
		local best = if data.newBest
			then "🎉 رقم قياسي جديد!"
			elseif type(data.best) == "number" then "🥇 أفضل وقت: " .. Format.time(data.best)
			else ""
		showWin(
			false,
			"🏆 خلّصت أوبي المقلوب!",
			if data.fullRun then "⏱️ وقتك: " .. Format.time(data.time) else "⏱️ ما بدأت من المرحلة 1، فالوقت ما ينحسب",
			best,
			string.format("🏅 عدد مرات الفوز: %d", data.wins or 1)
		)
	elseif data.kind == "coopWin" then
		frozenTime = data.time
		showWin(
			true,
			"🪢🏆 خلّصتوا درب الحبل!",
			"⏱️ وقتكم: " .. Format.time(data.time),
			string.format("🤝 أنت و %s", tostring(data.partner or "خويك")),
			string.format("🪢 فوز تعاوني: %d", data.wins or 1)
		)
	elseif data.kind == "coopFormed" then
		shownKey = nil
		showBanner(
			string.format("🪢 انربطت مع %s!", tostring(data.partner or "خويك")),
			"لو واحد طاح الثنين يرجعون • E أو زر 🪢 يسحب الحبل",
			CoopConfig.colors[1]
		)
		playSound(PING, 0.8)
	elseif data.kind == "coopBroken" and type(data.text) == "string" then
		shownKey = nil
		showToast(data.text)
	elseif data.kind == "coopFall" then
		showToast(if data.self then "💥 طحت… ترجعون سوا!" else string.format("💥 %s طاح… ترجعون سوا!", tostring(data.name)))
	elseif data.kind == "message" and type(data.text) == "string" then
		showToast(data.text)
	end
end)
