--!strict
-- قواعد القاعدة: الدخل، والدرع، والقفل، والمنصات، وتنظيف الحفظ، وقفل الجلسة، وعدّاد الضربات.
-- دوال حسابية بس، فتقدر تنختبر برا روبلوكس.

export type Entry = { c: string, r: string, v: string } -- شخصية، ندرة، نسخة
export type Record = {
	version: number,
	money: number,
	base: { [string]: Entry }, -- مفتاح نصي "1".."10" (DataStore ما يحب الجداول اللي فيها فراغات)
	session: { job: string, time: number }?,
}

local BaseRules = {}

local function isFinite(n: any): boolean
	return type(n) == "number" and n == n and math.abs(n) ~= math.huge
end

function BaseRules.new(baseConfig: any, habaliConfig: any, mapConfig: any)
	local rules = {}

	local characters, rarities, variants = {}, {}, {}
	for _, c in habaliConfig.Characters do
		characters[c.Id] = true
	end
	for _, zone in mapConfig.Zones do
		rarities[zone.Id] = true
	end
	variants[habaliConfig.NormalVariant] = true
	for _, v in habaliConfig.Variants do
		variants[v.Id] = true
	end

	-- دخل هبالي واحد بالثانية
	function rules.IncomeOf(rarity: string, variant: string?): number
		local base = baseConfig.Income[rarity] or 0
		local multiplier = baseConfig.VariantMultiplier[variant or "Normal"] or 1
		return base * multiplier
	end

	function rules.TotalIncome(slots: { [number]: Entry? }): number
		local total = 0
		for i = 1, baseConfig.Slots do
			local entry = slots[i]
			if entry then
				total += rules.IncomeOf(entry.r, entry.v)
			end
		end
		return total
	end

	-- الفلوس المتجمّعة في القاعدة ما تتعدى الحد
	function rules.AddPending(pending: number, income: number, dt: number): number
		local cap = income * baseConfig.PendingCapSeconds
		return math.min(pending + income * dt, cap)
	end

	-- القاعدة محمية لو صاحبها مو موجود أو بعيد عن الديرة
	function rules.IsShielded(ownerDistance: number?): boolean
		return ownerDistance == nil or ownerDistance > baseConfig.ShieldRadius
	end

	function rules.IsLocked(now: number, lockedUntil: number): boolean
		return now < lockedUntil
	end

	function rules.CanLock(now: number, lockedUntil: number): boolean
		return now >= lockedUntil + baseConfig.LockCooldown
	end

	function rules.FirstFreeSlot(slots: { [number]: Entry? }): number?
		for i = 1, baseConfig.Slots do
			if slots[i] == nil then
				return i
			end
		end
		return nil
	end

	-- هبالي محفوظ: لازم كل قيمه معروفة، وإلا نتجاهله
	function rules.SanitizeEntry(entry: any): Entry?
		if type(entry) ~= "table" then
			return nil
		end
		local c, r, v = entry.c, entry.r, entry.v
		if type(c) ~= "string" or not characters[c] then
			return nil
		end
		if type(r) ~= "string" or not rarities[r] then
			return nil
		end
		if v == nil then
			v = habaliConfig.NormalVariant
		end
		if type(v) ~= "string" or not variants[v] then
			return nil
		end
		return { c = c, r = r, v = v }
	end

	function rules.NewRecord(): Record
		return { version = baseConfig.Data.Version, money = 0, base = {} }
	end

	-- يرجّع سجل نظيف من أي شي جا من DataStore، أو nil لو نسخته أجدد من الكود (ما نلمسه)
	function rules.Migrate(raw: any): Record?
		if raw == nil then
			return rules.NewRecord()
		end
		if type(raw) ~= "table" then
			return nil
		end
		local version = tonumber(raw.version) or 0
		if version > baseConfig.Data.Version then
			return nil
		end
		local record = rules.NewRecord()
		local money = raw.money
		if isFinite(money) then
			record.money = math.clamp(math.floor(money), 0, baseConfig.Data.MaxMoney)
		end
		if type(raw.base) == "table" then
			for key, entry in raw.base do
				local index = tonumber(key)
				if index and index % 1 == 0 and index >= 1 and index <= baseConfig.Slots then
					local clean = rules.SanitizeEntry(entry)
					if clean then
						record.base[tostring(index)] = clean
					end
				end
			end
		end
		if type(raw.session) == "table" and type(raw.session.job) == "string" and isFinite(raw.session.time) then
			record.session = { job = raw.session.job, time = raw.session.time }
		end
		return record
	end

	-- نقدر ناخذ الجلسة؟ (محد ماسكها، أو هي حقتنا، أو صاحبها مات من زمان)
	function rules.CanTakeSession(record: Record, jobId: string, now: number): boolean
		local session = record.session
		if session == nil or session.job == jobId then
			return true
		end
		return now - session.time > baseConfig.Data.SessionStaleSeconds
	end

	-- من المفتاح النصي للمنصات لجدول بأرقام، وبالعكس
	function rules.SlotsFromRecord(record: Record): { [number]: Entry? }
		local slots = {}
		for key, entry in record.base do
			local index = tonumber(key)
			if index then
				slots[index] = entry
			end
		end
		return slots
	end

	function rules.RecordBase(slots: { [number]: Entry? }): { [string]: Entry }
		local base = {}
		for i = 1, baseConfig.Slots do
			local entry = slots[i]
			if entry then
				base[tostring(i)] = { c = entry.c, r = entry.r, v = entry.v }
			end
		end
		return base
	end

	-- عدّاد الضربات على اللي شايل أو ساحب: يرجّع القائمة الجديدة، وهل طاح
	function rules.RegisterHit(times: { number }, now: number): ({ number }, boolean)
		local window = baseConfig.Steal.HitWindow
		local kept = {}
		for _, t in times do
			if now - t <= window then
				table.insert(kept, t)
			end
		end
		table.insert(kept, now)
		if #kept >= baseConfig.Steal.HitsToDrop then
			return {}, true
		end
		return kept, false
	end

	function rules.RevengeBonus(entry: Entry): number
		return rules.IncomeOf(entry.r, entry.v) * baseConfig.Revenge.BonusSeconds
	end

	return rules
end

return BaseRules
