-- تشغيل أنظمة السيرفر
local ServerScriptService = game:GetService("ServerScriptService")

local Server = ServerScriptService:WaitForChild("Server")
local HabaliService = require(Server:WaitForChild("Habali"):WaitForChild("HabaliService"))
local CarService = require(Server:WaitForChild("Cars"):WaitForChild("CarService"))
local CatchService = require(Server:WaitForChild("Catch"):WaitForChild("CatchService"))
local DataService = require(Server:WaitForChild("Data"):WaitForChild("DataService"))
local BaseService = require(Server:WaitForChild("Base"):WaitForChild("BaseService"))

-- الحفظ أول: لازم يمسك "طلوع اللاعب" قبل السيارات عشان الحمولة تنحفظ قبل ما تنمسح السيارة
DataService.Start()
HabaliService.Start()
CarService.Start()
BaseService.Start()
CatchService.Start()
