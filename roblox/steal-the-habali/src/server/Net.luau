-- الـ Remotes كلها هنا. السيرفر يسويها، واللاعب ينتظرها في ReplicatedStorage.Remotes.
-- كل اللي يجي من اللاعب ما نثق فيه: كل دالة لازم تتحقق من اللي يوصلها.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = {}

-- من اللاعب للسيرفر
local CLIENT_EVENTS = { "Swing", "Shoot", "Release", "SpawnCar", "Horn", "ShopBuy", "ShopSell", "ShopFuel", "ShopJerry" }
-- من السيرفر للاعب
local SERVER_EVENTS = { "Notify", "Moment", "Shot", "Fx", "ShopOpen", "Alert" }

-- حد أعلى لكل لاعب في الثانية (حماية من السبام، فوق التبريد حق كل سلاح)
local MAX_PER_SECOND = 12

local folder = ReplicatedStorage:FindFirstChild("Remotes")
if not folder then
	folder = Instance.new("Folder")
	folder.Name = "Remotes"
	folder.Parent = ReplicatedStorage
end

local remotes: { [string]: RemoteEvent } = {}
local names = table.clone(CLIENT_EVENTS)
table.move(SERVER_EVENTS, 1, #SERVER_EVENTS, #names + 1, names)
for _, name in names do
	local remote = folder:FindFirstChild(name) :: RemoteEvent?
	if not remote then
		remote = Instance.new("RemoteEvent")
		remote.Name = name
		remote.Parent = folder
	end
	remotes[name] = remote :: RemoteEvent
end

local counts: { [Player]: { Window: number, Count: number } } = {}

local function allowed(player: Player): boolean
	local now = os.clock()
	local entry = counts[player]
	if not entry or now - entry.Window >= 1 then
		counts[player] = { Window = now, Count = 1 }
		return true
	end
	entry.Count += 1
	return entry.Count <= MAX_PER_SECOND
end

game:GetService("Players").PlayerRemoving:Connect(function(player)
	counts[player] = nil
end)

function Net.On(name: string, handler: (Player, ...any) -> ())
	remotes[name].OnServerEvent:Connect(function(player, ...)
		if allowed(player) then
			handler(player, ...)
		end
	end)
end

function Net.Fire(name: string, player: Player, ...: any)
	remotes[name]:FireClient(player, ...)
end

function Net.FireAll(name: string, ...: any)
	remotes[name]:FireAllClients(...)
end

-- للاعبين القريبين بس (المؤثرات ما تهم اللي بعيد، وتوفّر على الشبكة)
function Net.FireNear(name: string, position: Vector3, radius: number, ...: any)
	for _, player in game:GetService("Players"):GetPlayers() do
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root and (root.Position - position).Magnitude <= radius then
			remotes[name]:FireClient(player, ...)
		end
	end
end

function Net.Notify(player: Player, text: string)
	remotes.Notify:FireClient(player, text)
end

return Net
