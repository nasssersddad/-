-- حفظ وتحميل تقدّم اللاعب (المرحلة، عدد مرات الفوز، أفضل وقت)
-- لو اللعبة مو منشورة أو الـ API مقفّل في Studio، اللعبة تشتغل عادي بس ما تحفظ

local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

export type Profile = {
	stage: number,
	wins: number,
	best: number?,
}

local Data = {}

local store: DataStore? = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.SaveKey)
	end)
	if ok then
		store = result
	else
		warn("[Data] الحفظ مقفّل:", result)
	end
end

local function key(userId: number): string
	return "player_" .. userId
end

function Data.default(): Profile
	return { stage = 1, wins = 0, best = nil }
end

function Data.load(userId: number): Profile
	local profile = Data.default()
	if not store then
		return profile
	end
	local ok, result = pcall(function()
		return store:GetAsync(key(userId))
	end)
	if not ok then
		warn("[Data] ما قدرت أحمّل:", result)
		return profile
	end
	if type(result) == "table" then
		profile.stage = math.clamp(tonumber(result.stage) or 1, 1, Config.FinishedStage)
		profile.wins = tonumber(result.wins) or 0
		profile.best = tonumber(result.best)
	end
	return profile
end

function Data.save(userId: number, profile: Profile)
	if not store then
		return
	end
	local ok, err = pcall(function()
		store:SetAsync(key(userId), {
			stage = profile.stage,
			wins = profile.wins,
			best = profile.best,
		})
	end)
	if not ok then
		warn("[Data] ما قدرت أحفظ:", err)
	end
end

return Data
