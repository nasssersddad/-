-- يبني هبالي من بياناته المحفوظة ({ c, r, v }): للمنصات في القاعدة، وفوق راس الحرامي، وفي حوض السيارة.
-- الهبالي اللي في الصحراء يبنيها HabaliService، وهذا للي صار ملك أحد.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))
local HabaliModel = require(script.Parent:WaitForChild("HabaliModel"))

local HabaliFactory = {}

export type Entry = { c: string, r: string, v: string }

local zones = {}
for _, rarity in MapConfig.AllRarities() do
	zones[rarity.Id] = rarity
end
local names = {}
for _, c in HabaliConfig.Characters do
	names[c.Id] = c.DisplayName
end
local variants = {}
for _, v in HabaliConfig.Variants do
	variants[v.Id] = v
end

function HabaliFactory.DisplayName(entry: Entry): string
	return names[entry.c] or entry.c
end

-- يرجّع موديل ثابت (Anchored) حول نقطة الصفر، وعليه Attributes حقته
function HabaliFactory.Build(entry: Entry, labelDistance: number?): (Model, { BasePart })
	local variant = variants[entry.v]
	local zone = zones[entry.r]
	local model, parts = HabaliModel.Build({
		CharacterId = entry.c,
		DisplayName = HabaliFactory.DisplayName(entry),
		RarityText = if zone then zone.Rarity else entry.r,
		RarityColor = HabaliConfig.RarityColors[entry.r] or { 255, 255, 255 },
		Glow = entry.r ~= "Common" or variant ~= nil,
		Variant = variant,
		LabelDistance = labelDistance or HabaliConfig.LabelDistance[entry.r] or 120,
	})
	model:SetAttribute("Character", entry.c)
	model:SetAttribute("Rarity", entry.r)
	model:SetAttribute("Variant", entry.v)
	return model, parts
end

function HabaliFactory.EntryOf(model: Model): Entry?
	local c, r, v = model:GetAttribute("Character"), model:GetAttribute("Rarity"), model:GetAttribute("Variant")
	if type(c) == "string" and type(r) == "string" then
		return { c = c, r = r, v = if type(v) == "string" then v else HabaliConfig.NormalVariant }
	end
	return nil
end

-- يخلي الموديل قطعة وحدة تتحرك مع شي ثاني: كل القطع ملحومة على Hitbox، بدون وزن ولا اصطدام
function HabaliFactory.MakeCarriable(model: Model)
	local hitbox = model:FindFirstChild("Hitbox") :: BasePart
	for _, part in model:GetDescendants() do
		if part:IsA("BasePart") then
			if part ~= hitbox then
				local weld = Instance.new("WeldConstraint")
				weld.Part0 = hitbox
				weld.Part1 = part
				weld.Parent = part
			end
			part.Anchored = false
			part.CanCollide = false
			part.CanQuery = false
			part.CanTouch = false
			part.Massless = true
		end
	end
	local prompt = hitbox:FindFirstChild("GrabPrompt")
	if prompt then
		prompt:Destroy()
	end
end

return HabaliFactory
