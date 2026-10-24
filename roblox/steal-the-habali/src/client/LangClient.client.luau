-- الإنجليزي عند اللاعب: أي نص عربي يطلع في الشاشات أو اللوحات أو أزرار "اضغط" يتحول
-- للإنجليزي من Shared/Lang لو اللاعب لغته إنجليزي. وزر "EN / ع" يبدّل بينهم.
-- السكربتات الثانية تكتب بالعربي عادي، وهذا يمسك أي تغيير ويترجمه.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local LocalizationService = game:GetService("LocalizationService")
local Workspace = game:GetService("Workspace")

local Lang = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Lang"))
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local english = not Lang.DefaultIsArabic(player.LocaleId, nil)
local originals: { [Instance]: { [string]: string } } = setmetatable({}, { __mode = "k" }) :: any
local written: { [Instance]: { [string]: string } } = setmetatable({}, { __mode = "k" }) :: any
local tracked: { [Instance]: boolean } = setmetatable({}, { __mode = "k" }) :: any
local gui: ScreenGui

local function propsOf(obj: Instance): { string }?
	if obj:IsA("TextLabel") or obj:IsA("TextButton") then
		return { "Text" }
	elseif obj:IsA("ProximityPrompt") then
		return { "ActionText", "ObjectText" }
	end
	return nil
end

local function apply(obj: Instance, prop: string)
	local current = (obj :: any)[prop] :: string
	local mine = written[obj]
	if mine and mine[prop] == current then
		return -- هذا اللي كتبناه نحن
	end
	-- نص جديد من السكربت: نحفظ أصله
	originals[obj] = originals[obj] or {}
	originals[obj][prop] = current
	if english then
		local translated = Lang.ToEnglish(current)
		if translated ~= current then
			written[obj] = written[obj] or {}
			written[obj][prop] = translated;
			(obj :: any)[prop] = translated
		end
	end
end

local function track(obj: Instance)
	if tracked[obj] or obj:IsDescendantOf(gui) then
		return -- زر اللغة نفسه ما نترجمه
	end
	local props = propsOf(obj)
	if not props then
		return
	end
	tracked[obj] = true
	for _, prop in props do
		apply(obj, prop)
		obj:GetPropertyChangedSignal(prop):Connect(function()
			apply(obj, prop)
		end)
	end
end

local function watch(root: Instance)
	for _, obj in root:GetDescendants() do
		track(obj)
	end
	root.DescendantAdded:Connect(track)
end

-- نرجّع كل شي للغة المختارة
local function reapply()
	for obj, props in originals do
		if obj.Parent then
			for prop, arabic in props do
				local target = if english then Lang.ToEnglish(arabic) else arabic
				written[obj] = written[obj] or {}
				written[obj][prop] = target;
				(obj :: any)[prop] = target
			end
		end
	end
end

-- زر اللغة: تحت أزرار 📅 📜 📖 على اليسار
gui = Instance.new("ScreenGui")
gui.Name = "LangGui"
gui.ResetOnSpawn = false
gui.DisplayOrder = 5
gui.Parent = playerGui
local button = Instance.new("TextButton")
button.Name = "LangButton"
button.Size = UDim2.fromOffset(46, 46)
button.Position = UDim2.new(0, 12, 0, 88 + 3 * 52)
button.BackgroundColor3 = Color3.fromRGB(40, 32, 26)
button.BackgroundTransparency = 0.15
button.Font = Enum.Font.GothamBlack
button.TextColor3 = Color3.new(1, 1, 1)
button.TextScaled = true
button.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = button
local pad = Instance.new("UIPadding")
pad.PaddingTop = UDim.new(0, 10)
pad.PaddingBottom = UDim.new(0, 10)
pad.Parent = button

local function label()
	-- الزر يقول وش تحوّل له
	button.Text = if english then "ع" else "EN"
end

button.Activated:Connect(function()
	english = not english
	label()
	reapply()
end)

label()
watch(playerGui)
watch(Workspace)

-- الدولة تجي متأخرة شوي: لو هو من دولة عربية وجهازه إنجليزي، نرجّعه عربي (ما لم يضغط الزر)
local touched = false
button.Activated:Connect(function()
	touched = true
end)
task.spawn(function()
	local ok, country = pcall(function()
		return LocalizationService:GetCountryRegionForPlayerAsync(player)
	end)
	if ok and not touched then
		local arabic = Lang.DefaultIsArabic(player.LocaleId, country)
		if arabic == english then
			english = not arabic
			label()
			reapply()
		end
	end
end)
