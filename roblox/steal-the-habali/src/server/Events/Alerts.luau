-- تنبيهات للسيرفر كله (بانر وعلامة فوق المكان): على الغالي بس، والأحداث (العاصفة والإنفنتي).
-- السيرفر يقرر النص ومين يستاهل، والجوال يعرض بس.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local EventsConfig = require(Shared:WaitForChild("EventsConfig"))
local EventRules = require(Shared:WaitForChild("EventRules"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))

local Alerts = {}

local rules = EventRules.new(EventsConfig)
local rarityNames: { [string]: string } = {}
for _, rarity in MapConfig.AllRarities() do
	rarityNames[rarity.Id] = rarity.Rarity
end
local characterNames: { [string]: string } = {}
for _, c in HabaliConfig.Characters do
	characterNames[c.Id] = c.DisplayName
end
local variantNames: { [string]: string } = {}
for _, v in HabaliConfig.Variants do
	variantNames[v.Id] = v.DisplayName
end

-- kind: "Caught" (صاد) أو "Stolen" (سرق). entry = { c, r, v }
function Alerts.Habali(kind: string, player: Player, entry: { c: string, r: string, v: string? }, position: Vector3?)
	if not rules.ShouldAlert(entry.r, entry.v) then
		return
	end
	local name = characterNames[entry.c] or entry.c
	local variant = if entry.v and variantNames[entry.v] then " " .. variantNames[entry.v] else ""
	local verb = if kind == "Stolen" then "سرق" else "صاد"
	local icon = if kind == "Stolen" then "🚨" else "🎉"
	local text = string.format("%s %s %s %s%s (%s)!", icon, player.DisplayName, verb, name, variant, rarityNames[entry.r] or entry.r)
	Net.FireAll("Alert", text, entry.r, entry.v, position)
end

-- تنبيه حدث (العاصفة، الإنفنتي). rarity للون
function Alerts.Event(text: string, rarity: string?, position: Vector3?)
	Net.FireAll("Alert", text, rarity or "Event", nil, position)
end

return Alerts
