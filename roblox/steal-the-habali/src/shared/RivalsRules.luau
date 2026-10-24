--!strict
-- حسابات المرحلة 7ب: سعر إعادة البداية، ومضاعف الدخل، والمطلوب الأول. دوال بس عشان تنختبر برا روبلوكس.

local RivalsRules = {}

function RivalsRules.new(config: any)
	local rules = {}

	-- سعر الإعادة رقم (rebirths + 1)
	function rules.RebirthPrice(rebirths: number): number
		local r = config.Rebirth
		return math.floor(r.BasePrice * r.PriceGrowth ^ math.max(0, rebirths))
	end

	-- مضاعف الدخل: الإعادات × العصابة
	function rules.IncomeMultiplier(rebirths: number, friends: number): number
		local gang = math.clamp(friends, 0, config.Gang.MaxFriends) * config.Gang.PerFriend
		return (1 + math.max(0, rebirths) * config.Rebirth.IncomeBonus) * (1 + gang)
	end

	-- مين المطلوب الأول؟ entries = { { id, worth } }. nil لو أقل من MinPlayers أو الكل صفر
	function rules.MostWanted(entries: { { id: number, worth: number } }): number?
		if #entries < config.MostWanted.MinPlayers then
			return nil
		end
		local best, bestWorth = nil, 0
		for _, e in entries do
			-- التعادل: الأصغر id عشان ما يتنقل التاج كل شوي
			if e.worth > bestWorth or (e.worth == bestWorth and best ~= nil and e.id < best) then
				best, bestWorth = e.id, e.worth
			end
		end
		return if bestWorth > 0 then best else nil
	end

	function rules.MostWantedBonus(sellPrice: number): number
		return math.floor(math.max(0, sellPrice) * config.MostWanted.StealBonus)
	end

	return rules
end

return RivalsRules
