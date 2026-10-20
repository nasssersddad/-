-- تشغيل أنظمة السيرفر
local ServerScriptService = game:GetService("ServerScriptService")

local Server = ServerScriptService:WaitForChild("Server")
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))

HabaliService.Start()
