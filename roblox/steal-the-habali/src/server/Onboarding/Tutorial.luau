-- مهمة أول 3 دقايق: خطوات للاعب الجديد بس. الأنظمة الثانية تنادي Tutorial.Step لما يصير شي،
-- والخطوة تتقدم بس لو هي الخطوة الحالية. الجائزة مرة وحدة، وتنحفظ إنه خلّصها (أو تخطاها).
-- الجوال يقرا Attribute "TutorialStep" (رقم الخطوة) ويعرض السهم والنص بس.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local OnboardingConfig = require(Shared:WaitForChild("OnboardingConfig"))

local Server = script.Parent.Parent
local Net = require(Server:WaitForChild("Net"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))

local Tutorial = {}

local indexOf: { [string]: number } = {}
for i, step in OnboardingConfig.Steps do
	indexOf[step.Id] = i
end
local DONE = #OnboardingConfig.Steps + 1

local function current(player: Player): number?
	local step = player:GetAttribute("TutorialStep")
	return if type(step) == "number" and step <= #OnboardingConfig.Steps then step else nil
end

local function finish(player: Player, skipped: boolean)
	local profile = DataService.Get(player)
	if not profile or profile.Record.tutorial then
		return
	end
	profile.Record.tutorial = true
	profile.Dirty = true
	player:SetAttribute("TutorialStep", DONE)
	if not skipped then
		DataService.AddMoney(player, OnboardingConfig.Reward)
		Net.Notify(player, OnboardingConfig.DoneText)
	end
end

-- صار شي (stepId). لو هي الخطوة الحالية نتقدم
function Tutorial.Step(player: Player, stepId: string)
	local step = current(player)
	if not step or indexOf[stepId] ~= step then
		return
	end
	if step + 1 > #OnboardingConfig.Steps then
		finish(player, false)
	else
		player:SetAttribute("TutorialStep", step + 1)
	end
end

-- لو الخطوة الحالية صارت من قبل (مثلاً طلّع السيارة قبل لا يوصلها): نتعداها
function Tutorial.Skip(player: Player, stepId: string)
	Tutorial.Step(player, stepId)
end

function Tutorial.Start()
	DataService.OnLoaded(function(player, profile)
		player:SetAttribute("TutorialStep", if profile.Record.tutorial then DONE else 1)
	end)
	Net.On("TutorialSkip", function(player)
		if current(player) then
			finish(player, true)
		end
	end)
end

return Tutorial
