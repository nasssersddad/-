-- تشغيل أنظمة السيرفر
local ServerScriptService = game:GetService("ServerScriptService")

local Server = ServerScriptService:WaitForChild("Server")
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local CatchService = require(Server:WaitForChild("Catch"):WaitForChild("CatchService"))

HabaliService.Start()
CarService.Start()
CatchService.Start()
