-- الشيل: الحرامي يشيل الهبالي المسروق فوق راسه، ويمشي أبطأ، ولازم يحطه في سيارته.
-- الهبالي اللي فوق الراس شكل بس، والبيانات الحقيقية (Entry) هنا في السيرفر.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local CatchConfig = require(Shared:WaitForChild("CatchConfig"))

local Server = script.Parent.Parent
local HabaliFactory = require(Server:WaitForChild("Habali"):WaitForChild("HabaliFactory"))

local Carry = {}

export type Entry = HabaliFactory.Entry
export type Carried = {
	Entry: Entry,
	FromUserId: number, -- صاحبه الأصلي (عشان الثأر والرجوع)
	Visual: Model,
}

local carried: { [Player]: Carried } = {}

local function humanoidOf(player: Player): (Humanoid?, BasePart?)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local head = character and character:FindFirstChild("Head") :: BasePart?
	if humanoid and humanoid.Health > 0 and head then
		return humanoid, head
	end
	return nil, nil
end

function Carry.IsCarrying(player: Player): boolean
	return carried[player] ~= nil
end

function Carry.Get(player: Player): Carried?
	return carried[player]
end

-- يبدأ الشيل. يرجّع false لو اللاعب مو جاهز (ميت أو شايل شي ثاني)
function Carry.Start(player: Player, entry: Entry, fromUserId: number): boolean
	local humanoid, head = humanoidOf(player)
	if not humanoid or not head or carried[player] then
		return false
	end
	local visual = HabaliFactory.Build(entry, 160)
	visual.Name = "Carried"
	HabaliFactory.MakeCarriable(visual)
	visual:ScaleTo(0.5)
	local hitbox = visual:FindFirstChild("Hitbox") :: BasePart
	visual:PivotTo(head.CFrame * CFrame.new(0, 1.2, 0))
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = head
	weld.Part1 = hitbox
	weld.Parent = hitbox
	visual.Parent = player.Character

	carried[player] = { Entry = entry, FromUserId = fromUserId, Visual = visual }
	humanoid.WalkSpeed = BaseConfig.Steal.CarryWalkSpeed
	player:SetAttribute("Carrying", true)
	return true
end

-- ينهي الشيل ويرجّع البيانات (لما ينحط في السيارة، أو يطيح، أو يطلع اللاعب)
function Carry.Take(player: Player): Carried?
	local item = carried[player]
	if not item then
		return nil
	end
	carried[player] = nil
	if item.Visual.Parent then
		item.Visual:Destroy()
	end
	player:SetAttribute("Carrying", nil)
	local humanoid = humanoidOf(player)
	if humanoid then
		humanoid.WalkSpeed = CatchConfig.Drag.NormalWalkSpeed
	end
	return item
end

return Carry
