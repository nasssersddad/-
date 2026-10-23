-- المرحلة 7أ: المكافأة اليومية، والمهمات اليومية، والموسوعة. السيرفر يحسب كل شي بوقته هو.
-- الأنظمة الثانية تنادي HooksService.Event لما يصير شي (صيد، سرقة، بيع، تعبئة).
-- الجوال يقرا Attributes (DailyCanClaim، DailyStreak، QuestsJson، DexJson) ويعرض بس.

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local HooksConfig = require(Shared:WaitForChild("HooksConfig"))
local HooksRules = require(Shared:WaitForChild("HooksRules"))
local HabaliConfig = require(Shared:WaitForChild("HabaliConfig"))
local BaseConfig = require(Shared:WaitForChild("BaseConfig"))
local BaseRules = require(Shared:WaitForChild("BaseRules"))
local MapConfig = require(Shared:WaitForChild("MapConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local Loadout = require(Server:WaitForChild("Shop"):WaitForChild("Loadout"))

local HooksService = {}

local rules = HooksRules.new(HooksConfig)
local baseRules = BaseRules.new(BaseConfig, HabaliConfig, MapConfig)
local characterIds = {}
for _, c in HabaliConfig.Characters do
	table.insert(characterIds, c.Id)
end
local rarityNames: { [string]: string } = {}
for _, r in MapConfig.AllRarities() do
	rarityNames[r.Id] = r.Rarity
end

local function formatMoney(n: number): string
	local s = tostring(math.floor(n))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (formatted:gsub("^,", ""))
end

local function today(): number
	return rules.Day(os.time())
end

local function incomeOf(record: any): number
	return baseRules.TotalIncome(baseRules.SlotsFromRecord(record))
end

-- ===== نرسل الحالة للجوال =====

local function publish(player: Player)
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local record = profile.Record
	local can, streak, reward = rules.DailyStatus(rules.SanitizeDaily(record.daily), today())
	player:SetAttribute("DailyCanClaim", can)
	player:SetAttribute("DailyStreak", streak)
	player:SetAttribute("DailyReward", reward)
	local quests = rules.QuestsFor(record.quests, today(), player.UserId)
	record.quests = quests
	local list = {}
	for i, id in quests.ids do
		local quest = rules.Quest(id)
		table.insert(list, { text = quest.Text, progress = quests.progress[i], target = quest.Target, done = quests.done[i] })
	end
	player:SetAttribute("QuestsJson", HttpService:JSONEncode({ quests = list, reward = rules.QuestReward(incomeOf(record)) }))
	local dex = {}
	for key in rules.SanitizeDex(record.dex) do
		table.insert(dex, key)
	end
	player:SetAttribute("DexJson", HttpService:JSONEncode(dex))
end

-- ===== اليومية =====

local function claimDaily(player: Player)
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local day = today()
	local can, streak, reward = rules.DailyStatus(rules.SanitizeDaily(profile.Record.daily), day)
	if not can then
		return
	end
	profile.Record.daily = { day = day, streak = streak }
	profile.Dirty = true
	DataService.AddMoney(player, reward)
	local extra = ""
	if streak == HooksConfig.Daily.JerryOnDay then
		local jerries = Loadout.Jerries(player)
		Loadout.SetJerries(player, jerries + 1)
		extra = " + جالون 🛢️"
	end
	Net.Notify(player, string.format("📅 مكافأة اليوم %d: +%s 💰%s", streak, formatMoney(reward), extra))
	publish(player)
end

-- ===== الأحداث (المهمات والموسوعة) =====

-- kind: "Catch" { Zone = ندرة, Variant, Character } | "Steal" | "Sell" { Count } | "Refuel"
function HooksService.Event(player: Player, kind: string, data: any?)
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local record = profile.Record
	local info = data or {}
	local quests = rules.QuestsFor(record.quests, today(), player.UserId)
	local finished = rules.Advance(quests, kind, info)
	record.quests = quests
	profile.Dirty = true
	if #finished > 0 then
		local reward = rules.QuestReward(incomeOf(record))
		for _, index in finished do
			DataService.AddMoney(player, reward)
			Net.Notify(player, string.format("✅ خلصت مهمة: %s  +%s 💰", rules.Quest(quests.ids[index]).Text, formatMoney(reward)))
		end
	end
	-- الموسوعة: أول مرة يصيد هالشخصية بهالندرة
	if kind == "Catch" and type(info.Character) == "string" and type(info.Zone) == "string" then
		local dex = rules.SanitizeDex(record.dex)
		local key = rules.DexKey(info.Character, info.Zone)
		if not dex[key] then
			dex[key] = true
			record.dex = dex
			local missing = rules.DexMissing(dex, info.Zone, characterIds)
			local name = rarityNames[info.Zone] or info.Zone
			if missing == 0 then
				local done = type(record.dexDone) == "table" and record.dexDone or {}
				if not done[info.Zone] then
					done[info.Zone] = true
					record.dexDone = done
					local reward = HooksConfig.DexRewards[info.Zone] or 0
					DataService.AddMoney(player, reward)
					Net.Notify(player, string.format("📖 كمّلت %s في الموسوعة! +%s 💰", name, formatMoney(reward)))
				end
			else
				Net.Notify(player, string.format("📖 جديد في موسوعتك! باقي لك %d في %s", missing, name))
			end
		end
	end
	publish(player)
end

function HooksService.Start()
	DataService.OnLoaded(function(player)
		publish(player)
	end)
	Net.On("ClaimDaily", claimDaily)
	-- اليوم تغيّر واللاعب داخل: نحدّث اليومية والمهمات
	local lastDay = today()
	task.spawn(function()
		while true do
			task.wait(30)
			if today() ~= lastDay then
				lastDay = today()
				for _, player in Players:GetPlayers() do
					publish(player)
				end
			end
		end
	end)
end

return HooksService
