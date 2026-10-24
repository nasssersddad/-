-- مين صديق مين (أصدقاء روبلوكس) بين اللاعبين اللي في السيرفر. نسأل روبلوكس مرة وحدة لكل زوج
-- ونحفظ الجواب، لأن IsFriendsWith بطيء. للعصابة (+دخل) ولكرسي الراكب في السيارة.

local Players = game:GetService("Players")

local Friends = {}

local cache: { [string]: boolean } = {}

local function key(a: number, b: number): string
	return if a < b then a .. ":" .. b else b .. ":" .. a
end

function Friends.Are(a: Player, b: Player): boolean
	if a == b then
		return true
	end
	local k = key(a.UserId, b.UserId)
	local known = cache[k]
	if known ~= nil then
		return known
	end
	local ok, result = pcall(function()
		return a:IsFriendsWith(b.UserId)
	end)
	cache[k] = ok and result == true
	return cache[k]
end

-- كم صديق له في السيرفر الحين
function Friends.CountInServer(player: Player): number
	local count = 0
	for _, other in Players:GetPlayers() do
		if other ~= player and Friends.Are(player, other) then
			count += 1
		end
	end
	return count
end

-- للتجربة في Studio بس (اللاعبين المحليين ما لهم أصدقاء حقيقيين)
function Friends.SetForTest(a: Player, b: Player, value: boolean)
	cache[key(a.UserId, b.UserId)] = value
end

Players.PlayerRemoving:Connect(function(player)
	for k in cache do
		local x, y = k:match("^(%-?%d+):(%-?%d+)$")
		if tonumber(x) == player.UserId or tonumber(y) == player.UserId then
			cache[k] = nil
		end
	end
end)

return Friends
