-- حماية المبتدئ: أول NewbieSeconds من وقت لعبه (ينحسب وهو داخل اللعبة، وينحفظ) ما ينسرق منه شي:
-- لا من قاعدته ولا حوض سيارته، ولا أحد يطيّح منه اللي يسحبه. ولو سرق هو من أحد، تنتهي حمايته.
-- فوق راسه "🛡️ مبتدئ" للكل، والوقت الباقي في Attribute "NewbieLeft" (ثواني) عشان العدّاد.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local OnboardingConfig = require(Shared:WaitForChild("OnboardingConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))

local Newbie = {}

local function playtime(player: Player): number
	local profile = DataService.Get(player)
	local value = profile and profile.Record.playtime
	return if type(value) == "number" then value else 0
end

function Newbie.IsProtected(player: Player?): boolean
	if not player then
		return false
	end
	local left = player:GetAttribute("NewbieLeft")
	return type(left) == "number" and left > 0
end

local function setTag(player: Player, on: boolean)
	local character = player.Character
	local head = character and character:FindFirstChild("Head")
	if not head then
		return
	end
	local tag = head:FindFirstChild("NewbieTag")
	if on and not tag then
		local board = Instance.new("BillboardGui")
		board.Name = "NewbieTag"
		board.Size = UDim2.fromOffset(120, 30)
		board.StudsOffsetWorldSpace = Vector3.new(0, 2.6, 0)
		board.MaxDistance = 120
		board.Adornee = head
		board.Parent = head
		local label = Instance.new("TextLabel")
		label.Size = UDim2.fromScale(1, 1)
		label.BackgroundColor3 = Color3.fromRGB(40, 140, 80)
		label.BackgroundTransparency = 0.2
		label.TextScaled = true
		label.Font = Enum.Font.GothamBlack
		label.TextColor3 = Color3.new(1, 1, 1)
		label.Text = "🛡️ مبتدئ"
		label.Parent = board
		local corner = Instance.new("UICorner")
		corner.CornerRadius = UDim.new(0.5, 0)
		corner.Parent = label
	elseif not on and tag then
		tag:Destroy()
	end
end

local function update(player: Player)
	local left = math.max(0, OnboardingConfig.NewbieSeconds - playtime(player))
	player:SetAttribute("NewbieLeft", left)
	setTag(player, left > 0)
end

-- سرق من أحد: تنتهي حمايته على طول
function Newbie.End(player: Player)
	if not Newbie.IsProtected(player) then
		return
	end
	local profile = DataService.Get(player)
	if profile then
		profile.Record.playtime = math.max(playtime(player), OnboardingConfig.NewbieSeconds)
		profile.Dirty = true
	end
	update(player)
	Net.Notify(player, "🛡️ انتهت حماية المبتدئ لأنك سرقت. الحين تقدر تنسرق بعد!")
end

function Newbie.Start()
	DataService.OnLoaded(function(player)
		update(player)
		player.CharacterAdded:Connect(function()
			task.wait(1)
			update(player)
		end)
	end)
	-- كل 5 ثواني: نزيد وقت اللعب للي محميين بس (بعدها ما يهم)
	task.spawn(function()
		while true do
			task.wait(5)
			for _, player in Players:GetPlayers() do
				local profile = DataService.Get(player)
				if profile and Newbie.IsProtected(player) then
					profile.Record.playtime = playtime(player) + 5
					profile.Dirty = true
					update(player)
					if not Newbie.IsProtected(player) then
						Net.Notify(player, "🛡️ خلصت حماية المبتدئ. انتبه لقاعدتك!")
					end
				end
			end
		end
	end)
end

return Newbie
