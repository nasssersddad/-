-- المرحلة 7أ عند اللاعب: أزرار 📅 📜 📖 على اليسار، وشاشات اليومية والمهمات والموسوعة.
-- عرض بس: الحالة من Attributes يحطها السيرفر، و"استلم" يطلب من السيرفر وهو يقرر.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local HooksConfig = require(Shared:WaitForChild("HooksConfig"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function rgb(values: { number }?): Color3
	return if values then Color3.fromRGB(values[1], values[2], values[3]) else Color3.new(1, 1, 1)
end

local gui = Instance.new("ScreenGui")
gui.Name = "HooksGui"
gui.ResetOnSpawn = false
gui.DisplayOrder = 6
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(parent: Instance, radius: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius)
	c.Parent = parent
end

local function text(parent: Instance, value: string, size: UDim2, position: UDim2, font: Enum.Font, color: Color3, max: number, align: Enum.TextXAlignment?): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = size
	l.Position = position
	l.Font = font
	l.TextColor3 = color
	l.TextScaled = true
	l.TextXAlignment = align or Enum.TextXAlignment.Center
	l.Text = value
	l.Parent = parent
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = max
	limit.MinTextSize = 9
	limit.Parent = l
	return l
end

-- ===== الأزرار على اليسار =====

local function sideButton(icon: string, order: number, name: string): TextButton
	local b = Instance.new("TextButton")
	b.Name = name
	b.Size = UDim2.fromOffset(46, 46)
	b.Position = UDim2.new(0, 12, 0, 88 + (order - 1) * 52)
	b.BackgroundColor3 = Color3.fromRGB(40, 32, 26)
	b.BackgroundTransparency = 0.15
	b.Text = icon
	b.TextScaled = true
	b.Parent = gui
	corner(b, 12)
	local dot = Instance.new("Frame")
	dot.Name = "Dot"
	dot.Size = UDim2.fromOffset(12, 12)
	dot.Position = UDim2.new(1, -8, 0, -4)
	dot.BackgroundColor3 = Color3.fromRGB(230, 60, 60)
	dot.Visible = false
	dot.Parent = b
	corner(dot, 6)
	return b
end

local dailyButton = sideButton("📅", 1, "DailyButton")
local questButton = sideButton("📜", 2, "QuestsButton")
local dexButton = sideButton("📖", 3, "DexButton")

-- ===== اللوحة =====

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.fromScale(0.9, 0.84)
panel.BackgroundColor3 = Color3.fromRGB(32, 28, 24)
panel.Visible = false
panel.Parent = gui
corner(panel, 16)
local sizeLimit = Instance.new("UISizeConstraint")
sizeLimit.MaxSize = Vector2.new(560, 440)
sizeLimit.Parent = panel
local title = text(panel, "", UDim2.new(1, -80, 0, 38), UDim2.fromOffset(70, 8), Enum.Font.GothamBlack, Color3.fromRGB(255, 225, 120), 28, Enum.TextXAlignment.Right)
local close = Instance.new("TextButton")
close.Size = UDim2.fromOffset(48, 48)
close.Position = UDim2.fromOffset(10, 8)
close.BackgroundColor3 = Color3.fromRGB(190, 60, 60)
close.Text = "X"
close.TextScaled = true
close.Font = Enum.Font.GothamBlack
close.TextColor3 = Color3.new(1, 1, 1)
close.Parent = panel
corner(close, 12)
local body = Instance.new("ScrollingFrame")
body.Position = UDim2.fromOffset(12, 64)
body.Size = UDim2.new(1, -24, 1, -76)
body.BackgroundTransparency = 1
body.BorderSizePixel = 0
body.ScrollBarThickness = 6
body.AutomaticCanvasSize = Enum.AutomaticSize.Y
body.CanvasSize = UDim2.new()
body.Parent = panel

local openPage: string? = nil

local function clear()
	for _, child in body:GetChildren() do
		if not child:IsA("UIGridLayout") and not child:IsA("UIListLayout") then
			child:Destroy()
		end
	end
	for _, layout in body:GetChildren() do
		layout:Destroy()
	end
end

local function decode(name: string): any
	local raw = player:GetAttribute(name)
	if type(raw) ~= "string" then
		return nil
	end
	local ok, value = pcall(function()
		return HttpService:JSONDecode(raw)
	end)
	return if ok then value else nil
end

-- اليومية: 7 مربعات، واللي عليه الدور ملوّن، وزر استلم
local function renderDaily()
	title.Text = "📅 المكافأة اليومية"
	-- صف الأيام السبعة، وتحته زر الاستلام
	local days = Instance.new("Frame")
	days.BackgroundTransparency = 1
	days.Size = UDim2.new(1, -8, 0, 86)
	days.Parent = body
	local grid = Instance.new("UIGridLayout")
	grid.CellSize = UDim2.new(0.13, 0, 0, 86)
	grid.CellPadding = UDim2.new(0.01, 0, 0, 0)
	grid.SortOrder = Enum.SortOrder.LayoutOrder
	grid.HorizontalAlignment = Enum.HorizontalAlignment.Center
	grid.Parent = days
	local can = player:GetAttribute("DailyCanClaim") == true
	local streak = player:GetAttribute("DailyStreak") or 1
	for day, reward in HooksConfig.Daily.Rewards do
		local box = Instance.new("Frame")
		box.LayoutOrder = day
		local isNext = day == streak
		local claimed = day < streak or (day == streak and not can)
		box.BackgroundColor3 = if isNext and can then Color3.fromRGB(60, 170, 90) elseif claimed then Color3.fromRGB(70, 60, 50) else Color3.fromRGB(55, 48, 42)
		box.Parent = days
		corner(box, 10)
		text(box, "يوم " .. day, UDim2.new(1, 0, 0.3, 0), UDim2.fromScale(0, 0.04), Enum.Font.GothamBold, Color3.new(1, 1, 1), 16)
		local extra = if day == HooksConfig.Daily.JerryOnDay then "\n+🛢️" else ""
		text(box, formatMoney(reward) .. extra, UDim2.new(1, -4, 0.5, 0), UDim2.new(0, 2, 0.34, 0), Enum.Font.GothamBlack, Color3.fromRGB(255, 225, 120), 18)
		if claimed then
			text(box, "✅", UDim2.new(1, 0, 0.25, 0), UDim2.fromScale(0, 0.75), Enum.Font.GothamBold, Color3.new(1, 1, 1), 16)
		end
	end
	local claim = Instance.new("TextButton")
	claim.Size = UDim2.new(0.6, 0, 0, 52)
	claim.Position = UDim2.new(0.2, 0, 0, 100)
	claim.BackgroundColor3 = if can then Color3.fromRGB(60, 170, 90) else Color3.fromRGB(90, 90, 90)
	claim.Text = if can then "استلم 🎁" else "رجّع بكرة ⏰"
	claim.TextScaled = true
	claim.Font = Enum.Font.GothamBlack
	claim.TextColor3 = Color3.new(1, 1, 1)
	claim.Parent = body
	corner(claim, 12)
	claim.Activated:Connect(function()
		if player:GetAttribute("DailyCanClaim") == true then
			Remotes:WaitForChild("ClaimDaily"):FireServer()
		end
	end)
	text(body, "لو فوّت يوم واحد ما تخسر السلسلة", UDim2.new(1, 0, 0, 20), UDim2.fromOffset(0, 160), Enum.Font.GothamMedium, Color3.fromRGB(200, 190, 170), 14)
end

-- المهمات: 3 صفوف مع شريط تقدم
local function renderQuests()
	title.Text = "📜 مهمات اليوم"
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 8)
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Parent = body
	local data = decode("QuestsJson") or { quests = {}, reward = 0 }
	for i, quest in data.quests do
		local row = Instance.new("Frame")
		row.LayoutOrder = i
		row.Size = UDim2.new(1, -8, 0, 64)
		row.BackgroundColor3 = if quest.done then Color3.fromRGB(45, 90, 55) else Color3.fromRGB(58, 50, 42)
		row.Parent = body
		corner(row, 12)
		text(row, (if quest.done then "✅ " else "") .. quest.text, UDim2.new(1, -20, 0, 30), UDim2.fromOffset(10, 4), Enum.Font.GothamBlack, Color3.new(1, 1, 1), 22, Enum.TextXAlignment.Right)
		local bar = Instance.new("Frame")
		bar.Size = UDim2.new(1, -120, 0, 14)
		bar.Position = UDim2.new(0, 10, 0, 42)
		bar.BackgroundColor3 = Color3.fromRGB(30, 26, 22)
		bar.Parent = row
		corner(bar, 7)
		local fill = Instance.new("Frame")
		fill.Size = UDim2.fromScale(math.clamp(quest.progress / math.max(quest.target, 1), 0, 1), 1)
		fill.BackgroundColor3 = Color3.fromRGB(80, 200, 100)
		fill.Parent = bar
		corner(fill, 7)
		text(row, string.format("%d/%d", quest.progress, quest.target), UDim2.fromOffset(90, 22), UDim2.new(1, -100, 0, 38), Enum.Font.GothamBold, Color3.fromRGB(220, 210, 190), 16)
	end
	text(body, "جائزة كل مهمة: 💰 " .. formatMoney(data.reward or 0) .. " (دخل قاعدتك 10 دقايق)", UDim2.new(1, 0, 0, 24), UDim2.new(), Enum.Font.GothamBold, Color3.fromRGB(255, 225, 120), 16).LayoutOrder = 10
end

-- الموسوعة: صف لكل ندرة، واللي ما صدته ظل
local function renderDex()
	title.Text = "📖 موسوعة الهبالي"
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 8)
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Parent = body
	local found = {}
	for _, key in decode("DexJson") or {} do
		found[key] = true
	end
	for order, rarity in MapConfig.AllRarities() do
		local missing = 0
		for _, c in HabaliConfig.Characters do
			if not found[c.Id .. ":" .. rarity.Id] then
				missing += 1
			end
		end
		local row = Instance.new("Frame")
		row.LayoutOrder = order
		row.Size = UDim2.new(1, -8, 0, 86)
		row.BackgroundColor3 = Color3.fromRGB(50, 44, 38)
		row.Parent = body
		corner(row, 12)
		local color = rgb(HabaliConfig.RarityColors[rarity.Id])
		local header = if missing == 0 then rarity.Rarity .. " ✅ كاملة" else string.format("%s · باقي لك %d (الجائزة %s)", rarity.Rarity, missing, formatMoney(HooksConfig.DexRewards[rarity.Id] or 0))
		text(row, header, UDim2.new(1, -16, 0, 24), UDim2.fromOffset(8, 4), Enum.Font.GothamBlack, color, 18, Enum.TextXAlignment.Right)
		local count = #HabaliConfig.Characters
		for i, c in HabaliConfig.Characters do
			local have = found[c.Id .. ":" .. rarity.Id]
			local card = Instance.new("Frame")
			card.Size = UDim2.new(1 / count, -8, 0, 48)
			card.Position = UDim2.new((i - 1) / count, 4, 0, 32)
			card.BackgroundColor3 = if have then color:Lerp(Color3.new(0, 0, 0), 0.55) else Color3.fromRGB(20, 18, 16)
			card.Parent = row
			corner(card, 8)
			text(card, if have then c.DisplayName else "؟ ؟ ؟", UDim2.new(1, -6, 1, -6), UDim2.fromOffset(3, 3), Enum.Font.GothamBold, if have then Color3.new(1, 1, 1) else Color3.fromRGB(90, 80, 70), 16)
		end
	end
end

local function render()
	clear()
	if openPage == "Daily" then
		renderDaily()
	elseif openPage == "Quests" then
		renderQuests()
	elseif openPage == "Dex" then
		renderDex()
	end
end

local function open(page: string?)
	openPage = page
	panel.Visible = page ~= nil
	render()
end

close.Activated:Connect(function()
	open(nil)
end)
dailyButton.Activated:Connect(function()
	open(if openPage == "Daily" then nil else "Daily")
end)
questButton.Activated:Connect(function()
	open(if openPage == "Quests" then nil else "Quests")
end)
dexButton.Activated:Connect(function()
	open(if openPage == "Dex" then nil else "Dex")
end)
-- أبو كشتة في الثمامة: تقهوى عنده وتنفتح اليومية (الاستلام نفسه يتحقق منه السيرفر)
game:GetService("ProximityPromptService").PromptTriggered:Connect(function(prompt)
	if prompt.Name == "KashtaDaily" then
		open("Daily")
	end
end)

local function refreshDots()
	dailyButton.Dot.Visible = player:GetAttribute("DailyCanClaim") == true
	local data = decode("QuestsJson")
	local anyOpen = false
	if data then
		for _, q in data.quests do
			if not q.done then
				anyOpen = true
			end
		end
	end
	questButton.Dot.Visible = false
	questButton.BackgroundColor3 = if anyOpen then Color3.fromRGB(40, 32, 26) else Color3.fromRGB(45, 90, 55)
end

for _, name in { "DailyCanClaim", "DailyStreak", "QuestsJson", "DexJson" } do
	player:GetAttributeChangedSignal(name):Connect(function()
		refreshDots()
		if openPage then
			render()
		end
	end)
end

-- أول ما يدخل: لو فيه مكافأة يومية نفتحها له (بعد ما تخلص مهمة البداية عشان ما تزحمه)
task.spawn(function()
	task.wait(4)
	refreshDots()
	local step = player:GetAttribute("TutorialStep")
	local tutorialDone = type(step) ~= "number" or step > 6
	if player:GetAttribute("DailyCanClaim") == true and tutorialDone and not openPage then
		open("Daily")
	end
end)
