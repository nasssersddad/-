-- عدّة اللاعب المحفوظة: ليفلات السلاح والسيارة، والبنزين، والجوالين.
-- الأنظمة الثانية (الصيد والسيارات والمحلات) تقرا وتكتب من هنا بس، والحفظ في سجل DataService.
-- الليفلات تنكتب على اللاعب كـ Attributes (Gear_Melee...) عشان الجوال يعرضها، بس السيرفر ما يقراها منه.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local ShopConfig = require(Shared:WaitForChild("ShopConfig"))
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local ShopRules = require(Shared:WaitForChild("ShopRules"))

local DataService = require(script.Parent.Parent:WaitForChild("Data"):WaitForChild("DataService"))

local Loadout = {}

local rules = ShopRules.new(ShopConfig, BaseConfig)
Loadout.Rules = rules

-- العدّة الحين (لو البيانات ما تحمّلت، العدّة الأساسية)
function Loadout.Gear(player: Player): ShopRules.Gear
	local profile = DataService.Get(player)
	return rules.SanitizeGear(profile and profile.Record.gear)
end

local function publish(player: Player, gear: ShopRules.Gear)
	for _, key in rules.Keys() do
		player:SetAttribute("Gear_" .. key, (gear :: any)[key])
	end
end

function Loadout.SetLevel(player: Player, key: string, level: number): boolean
	local profile = DataService.Get(player)
	if not profile then
		return false
	end
	local gear = rules.SanitizeGear(profile.Record.gear)
	;(gear :: any)[key] = level
	gear = rules.SanitizeGear(gear)
	profile.Record.gear = gear :: any
	DataService.MarkDirty(player)
	publish(player, gear)
	return true
end

function Loadout.Fuel(player: Player): number
	local profile = DataService.Get(player)
	local _, _, tank = rules.CarStats(Loadout.Gear(player))
	return rules.SanitizeFuel(profile and profile.Record.fuel, tank)
end

function Loadout.SetFuel(player: Player, fuel: number)
	local profile = DataService.Get(player)
	if profile then
		local _, _, tank = rules.CarStats(Loadout.Gear(player))
		profile.Record.fuel = rules.SanitizeFuel(fuel, tank)
		profile.Dirty = true
	end
end

function Loadout.Jerries(player: Player): number
	local profile = DataService.Get(player)
	return rules.SanitizeJerries(profile and profile.Record.jerries)
end

function Loadout.SetJerries(player: Player, count: number)
	local profile = DataService.Get(player)
	if profile then
		profile.Record.jerries = rules.SanitizeJerries(count)
		profile.Dirty = true
		player:SetAttribute("Jerries", profile.Record.jerries)
	end
end

function Loadout.Start()
	DataService.OnLoaded(function(player)
		publish(player, Loadout.Gear(player))
		player:SetAttribute("Jerries", Loadout.Jerries(player))
	end)
end

return Loadout
