-- المرحلة 7ب عند اللاعب: زر ♻️ (فوق يمين) وشاشة إعادة البداية والعصابة والدعوة،
-- وتاج يبان من بعيد فوق المطلوب الأول. عرض بس: الأرقام من Attributes يحطها السيرفر.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SocialService = game:GetService("SocialService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local RivalsConfig = require(Shared:WaitForChild("RivalsConfig"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function corner(parent: Instance, radius: number)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius)
	c.Parent = parent
end

local function label(parent: Instance, value: string, size: UDim2, position: UDim2, font: Enum.Font, color: Color3, max: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = size
	l.Position = position
	l.Font = font
	l.TextColor3 = color
	l.TextScaled = true
	l.Text = value
	l.Parent = parent
	local limit = Instance.new("UITextSizeConstraint")
	limit.MaxTextSize = max
	limit.MinTextSize = 9
	limit.Parent = l
	return l
end

local gui = Instance.new("ScreenGui")
gui.Name = "RivalsGui"
gui.ResetOnSpawn = false
gui.DisplayOrder = 6
gui.Parent = player:WaitForChild("PlayerGui")

-- فوق يمين، فوق زر سيارتي
local openButton = Instance.new("TextButton")
openButton.Name = "RebirthButton"
openButton.AnchorPoint = Vector2.new(1, 0)
openButton.Position = UDim2.new(1, -16, 0, 96)
openButton.Size = UDim2.fromOffset(46, 46)
openButton.BackgroundColor3 = Color3.fromRGB(40, 32, 26)
openButton.BackgroundTransparency = 0.15
openButton.Text = "♻️"
openButton.TextScaled = true
openButton.Parent = gui
corner(openButton, 12)

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
-- مقاس ثابت (المحتوى مرصوص بالبكسل) ونصغّره كله لو الشاشة أصغر منه (جوالات صغيرة)
local PANEL_SIZE = Vector2.new(520, 340)
panel.Size = UDim2.fromOffset(PANEL_SIZE.X, PANEL_SIZE.Y)
panel.BackgroundColor3 = Color3.fromRGB(32, 28, 24)
panel.Visible = false
panel.Parent = gui
corner(panel, 16)
local scale = Instance.new("UIScale")
scale.Parent = panel
local function fit()
	local screen = gui.AbsoluteSize
	scale.Scale = math.min(1, (screen.X - 24) / PANEL_SIZE.X, (screen.Y - 16) / PANEL_SIZE.Y)
end
gui:GetPropertyChangedSignal("AbsoluteSize"):Connect(fit)
fit()

label(panel, "♻️ إعادة البداية والربع", UDim2.new(1, -80, 0, 36), UDim2.fromOffset(70, 8), Enum.Font.GothamBlack, Color3.fromRGB(255, 225, 120), 26)
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

local status = label(panel, "", UDim2.new(1, -24, 0, 26), UDim2.fromOffset(12, 64), Enum.Font.GothamBold, Color3.new(1, 1, 1), 20)
local priceText = label(panel, "", UDim2.new(1, -24, 0, 24), UDim2.fromOffset(12, 94), Enum.Font.GothamMedium, Color3.fromRGB(220, 210, 190), 18)
local bar = Instance.new("Frame")
bar.Size = UDim2.new(1, -24, 0, 14)
bar.Position = UDim2.fromOffset(12, 124)
bar.BackgroundColor3 = Color3.fromRGB(20, 18, 16)
bar.Parent = panel
corner(bar, 7)
local fill = Instance.new("Frame")
fill.Size = UDim2.fromScale(0, 1)
fill.BackgroundColor3 = Color3.fromRGB(80, 200, 100)
fill.Parent = bar
corner(fill, 7)

local rebirthButton = Instance.new("TextButton")
rebirthButton.Name = "DoRebirth"
rebirthButton.Size = UDim2.new(0.6, 0, 0, 48)
rebirthButton.Position = UDim2.new(0.2, 0, 0, 148)
rebirthButton.TextScaled = true
rebirthButton.Font = Enum.Font.GothamBlack
rebirthButton.TextColor3 = Color3.new(1, 1, 1)
rebirthButton.Parent = panel
corner(rebirthButton, 12)
label(panel, "تنمسح الفلوس والأسلحة وتطويرات السيارة، وهباليك يبقون", UDim2.new(1, -24, 0, 20), UDim2.fromOffset(12, 200), Enum.Font.GothamMedium, Color3.fromRGB(200, 190, 170), 14)

local gangText = label(panel, "", UDim2.new(1, -24, 0, 24), UDim2.fromOffset(12, 232), Enum.Font.GothamBold, Color3.fromRGB(150, 220, 255), 18)
local invite = Instance.new("TextButton")
invite.Name = "Invite"
invite.Size = UDim2.new(0.6, 0, 0, 44)
invite.Position = UDim2.new(0.2, 0, 0, 262)
invite.BackgroundColor3 = Color3.fromRGB(60, 120, 220)
invite.Text = "🤝 ادعُ ربعك"
invite.TextScaled = true
invite.Font = Enum.Font.GothamBlack
invite.TextColor3 = Color3.new(1, 1, 1)
invite.Parent = panel
corner(invite, 12)
label(panel, string.format("لو دخل صديقك أول مرة من دعوتك: +%s لكم الاثنين", formatMoney(RivalsConfig.Gang.InviteReward)), UDim2.new(1, -24, 0, 20), UDim2.fromOffset(12, 310), Enum.Font.GothamMedium, Color3.fromRGB(200, 190, 170), 14)

local confirmUntil = 0

local function render()
	local rebirths = player:GetAttribute("Rebirths") or 0
	local mult = player:GetAttribute("IncomeMult") or 1
	local price = player:GetAttribute("RebirthPrice") or RivalsConfig.Rebirth.BasePrice
	local money = player:GetAttribute("Money") or 0
	status.Text = string.format("سويت %d إعادة · دخلك ×%.2f", rebirths, mult)
	priceText.Text = string.format("الجاية: 💰 %s (+%d%% دخل للأبد)", formatMoney(price), RivalsConfig.Rebirth.IncomeBonus * 100)
	fill.Size = UDim2.fromScale(math.clamp(money / math.max(price, 1), 0, 1), 1)
	local can = money >= price
	rebirthButton.BackgroundColor3 = if can then Color3.fromRGB(200, 120, 40) else Color3.fromRGB(90, 90, 90)
	rebirthButton.Text = if not can then "باقي " .. formatMoney(price - money) elseif os.clock() < confirmUntil then "متأكد؟ اضغط مرة ثانية" else "♻️ أعد البداية"
	local gang = player:GetAttribute("GangCount") or 0
	gangText.Text = if gang > 0
		then string.format("🤝 معك %d من ربعك: +%d%% دخل", gang, math.min(gang, RivalsConfig.Gang.MaxFriends) * RivalsConfig.Gang.PerFriend * 100)
		else "🤝 ما معك أحد من ربعك (كل صديق +10% دخل)"
end

rebirthButton.Activated:Connect(function()
	local money = player:GetAttribute("Money") or 0
	local price = player:GetAttribute("RebirthPrice") or math.huge
	if money < price then
		return
	end
	-- ضغطتين عشان ما يصير بالغلط
	if os.clock() < confirmUntil then
		confirmUntil = 0
		Remotes:WaitForChild("Rebirth"):FireServer()
	else
		confirmUntil = os.clock() + 4
	end
	render()
end)

invite.Activated:Connect(function()
	local ok, can = pcall(function()
		return SocialService:CanSendGameInviteAsync(player)
	end)
	if ok and can then
		pcall(function()
			SocialService:PromptGameInvite(player)
		end)
	end
end)

openButton.Activated:Connect(function()
	panel.Visible = not panel.Visible
	render()
end)
close.Activated:Connect(function()
	panel.Visible = false
end)
for _, name in { "Rebirths", "IncomeMult", "RebirthPrice", "Money", "GangCount" } do
	player:GetAttributeChangedSignal(name):Connect(function()
		if panel.Visible then
			render()
		end
	end)
end

-- ===== تاج المطلوب الأول (يبان من بعيد للكل) =====

local crowns: { [Player]: BillboardGui } = {}

local function updateCrown(other: Player)
	local wanted = other:GetAttribute("MostWanted") == true
	local head = other.Character and other.Character:FindFirstChild("Head")
	local existing = crowns[other]
	if wanted and head and (not existing or existing.Adornee ~= head) then
		if existing then
			existing:Destroy()
		end
		local board = Instance.new("BillboardGui")
		board.Name = "WantedCrown"
		board.Size = UDim2.fromOffset(44, 44)
		board.StudsOffsetWorldSpace = Vector3.new(0, 7, 0)
		board.AlwaysOnTop = true
		board.MaxDistance = 6000
		board.Adornee = head
		board.Parent = gui
		local icon = Instance.new("TextLabel")
		icon.Size = UDim2.fromScale(1, 1)
		icon.BackgroundTransparency = 1
		icon.Text = "👑"
		icon.TextScaled = true
		icon.Parent = board
		crowns[other] = board
	elseif not wanted and existing then
		existing:Destroy()
		crowns[other] = nil
	end
end

task.spawn(function()
	while true do
		task.wait(1)
		for _, other in Players:GetPlayers() do
			if other ~= player then
				updateCrown(other)
			end
		end
		for other, board in crowns do
			if not other.Parent then
				board:Destroy()
				crowns[other] = nil
			end
		end
	end
end)
