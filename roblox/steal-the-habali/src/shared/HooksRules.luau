--!strict
-- حسابات الهوكات: رقم اليوم، والمكافأة اليومية، واختيار المهمات وتقدمها، والموسوعة.
-- دوال بس (بدون روبلوكس) عشان تنختبر برا. السيرفر يناديها بوقته هو، مو وقت الجوال.

local HooksRules = {}

local function isFinite(n: any): boolean
	return type(n) == "number" and n == n and math.abs(n) ~= math.huge
end

export type Daily = { day: number, streak: number }
export type Quests = { day: number, ids: { string }, progress: { number }, done: { boolean } }

function HooksRules.new(config: any)
	local rules = {}

	-- رقم اليوم بتوقيت السعودية
	function rules.Day(t: number): number
		return math.floor((t + config.DayOffsetSeconds) / 86400)
	end

	-- ===== اليومية =====

	-- يقدر يستلم اليوم؟ يرجّع (يقدر، رقم السلسلة الجاي 1..7، الجائزة)
	function rules.DailyStatus(daily: Daily?, today: number): (boolean, number, number)
		local rewards = config.Daily.Rewards
		if daily and daily.day == today then
			return false, daily.streak, rewards[daily.streak] or rewards[1]
		end
		local streak = 1
		if daily and today - daily.day <= 1 + config.Daily.GraceDays and today > daily.day then
			streak = daily.streak % #rewards + 1
		end
		return true, streak, rewards[streak]
	end

	function rules.SanitizeDaily(raw: any): Daily?
		if type(raw) == "table" and isFinite(raw.day) and isFinite(raw.streak) then
			return { day = math.floor(raw.day), streak = math.clamp(math.floor(raw.streak), 1, #config.Daily.Rewards) }
		end
		return nil
	end

	-- ===== المهمات =====

	-- 3 مهمات لهاليوم وهاللاعب (نفس اليوم = نفس المهمات، حتى لو رجع)
	function rules.PickQuests(today: number, userId: number): { string }
		local state = (today * 7919 + math.abs(userId) % 100000) % 2147483646 + 1
		local pool = {}
		for _, quest in config.Quests do
			table.insert(pool, quest.Id)
		end
		local picked = {}
		for _ = 1, math.min(config.QuestsPerDay, #pool) do
			state = (state * 16807) % 2147483647
			local index = state % #pool + 1
			table.insert(picked, table.remove(pool, index))
		end
		return picked
	end

	function rules.Quest(id: string): any
		for _, quest in config.Quests do
			if quest.Id == id then
				return quest
			end
		end
		return nil
	end

	-- مهمات اليوم: لو المحفوظة من يوم ثاني نبدأ جديدة
	function rules.QuestsFor(raw: any, today: number, userId: number): Quests
		if type(raw) == "table" and raw.day == today and type(raw.ids) == "table" and type(raw.progress) == "table" and type(raw.done) == "table" then
			local clean: Quests = { day = today, ids = {}, progress = {}, done = {} }
			for i, id in raw.ids do
				if type(id) == "string" and rules.Quest(id) then
					table.insert(clean.ids, id)
					clean.progress[#clean.ids] = if isFinite(raw.progress[i]) then math.max(0, math.floor(raw.progress[i])) else 0
					clean.done[#clean.ids] = raw.done[i] == true
				end
			end
			if #clean.ids > 0 then
				return clean
			end
		end
		local ids = rules.PickQuests(today, userId)
		local fresh: Quests = { day = today, ids = ids, progress = {}, done = {} }
		for i = 1, #ids do
			fresh.progress[i] = 0
			fresh.done[i] = false
		end
		return fresh
	end

	-- صار شي (kind + بياناته). يرجّع أرقام المهمات اللي خلصت الحين
	function rules.Advance(quests: Quests, kind: string, data: { Zone: string?, Variant: string?, Count: number? }?): { number }
		local finished = {}
		local info = data or {}
		for i, id in quests.ids do
			local quest = rules.Quest(id)
			if quest and not quests.done[i] and quest.Kind == kind then
				local matches = (quest.Zone == nil or quest.Zone == info.Zone)
					and (not quest.Variant or (info.Variant ~= nil and info.Variant ~= "Normal"))
				if matches then
					quests.progress[i] = math.min(quest.Target, quests.progress[i] + (info.Count or 1))
					if quests.progress[i] >= quest.Target then
						quests.done[i] = true
						table.insert(finished, i)
					end
				end
			end
		end
		return finished
	end

	function rules.QuestReward(incomePerSecond: number): number
		return math.max(config.QuestRewardMin, math.floor(incomePerSecond * config.QuestRewardSeconds))
	end

	-- ===== الموسوعة =====

	function rules.DexKey(character: string, rarity: string): string
		return character .. ":" .. rarity
	end

	-- كم باقي له في هالندرة، وهل كمّلها
	function rules.DexMissing(dex: { [string]: boolean }, rarity: string, characters: { string }): number
		local missing = 0
		for _, c in characters do
			if not dex[rules.DexKey(c, rarity)] then
				missing += 1
			end
		end
		return missing
	end

	function rules.SanitizeDex(raw: any): { [string]: boolean }
		local dex = {}
		if type(raw) == "table" then
			for key, value in raw do
				if type(key) == "string" and #key <= 48 and value == true then
					dex[key] = true
				end
			end
		end
		return dex
	end

	return rules
end

return HooksRules
