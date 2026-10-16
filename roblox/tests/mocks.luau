-- محاكاة بسيطة لـ Roblox عشان نشغّل CourseBuilder برا Studio (المواقع بس، الدوران متجاهَل)
local V = {}
V.__index = V
local function vec(x, y, z) return setmetatable({X = x or 0, Y = y or 0, Z = z or 0}, V) end
V.__add = function(a, b) return vec(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V.__sub = function(a, b) return vec(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V.__mul = function(a, b) if type(b) == "number" then return vec(a.X*b, a.Y*b, a.Z*b) end return vec(a.X*b.X, a.Y*b.Y, a.Z*b.Z) end
V.__index = function(t, k) if k == "Magnitude" then return math.sqrt(t.X^2+t.Y^2+t.Z^2) end return V[k] end
Vector3 = { new = vec }
Vector2 = { new = vec }
local C = {}
local function cf(x, y, z) return setmetatable({Position = vec(x, y, z), X = x or 0, Y = y or 0, Z = z or 0}, C) end
C.__index = C
C.__mul = function(a, b) return cf(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
C.__add = function(a, b) return cf(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
C.__sub = function(a, b) return cf(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
CFrame = { new = cf, Angles = function() return cf(0,0,0) end, lookAt = function(p) return cf(p.X, p.Y, p.Z) end }
Color3 = { new = function() return {} end, fromRGB = function() return {} end }
UDim2 = { fromOffset = function() return {} end, fromScale = function() return {} end, new = function() return {} end }
Enum = setmetatable({}, { __index = function(_, k) return setmetatable({}, { __index = function(_, k2) return k .. "." .. k2 end }) end })
ALL = {}
local I = {}
I.__index = function(t, k)
	if k == "Position" then return rawget(t, "CFrame") and rawget(t, "CFrame").Position end
	return I[k]
end
function I:SetAttribute(k, v) self.attrs[k] = v end
function I:GetAttribute(k) return self.attrs[k] end
function I:FindFirstChild(n) return nil end
function I:WaitForChild(n) return { Name = n } end
Instance = { new = function(class)
	local o = setmetatable({ ClassName = class, attrs = {}, tags = {}, CanCollide = true }, I)
	table.insert(ALL, o)
	return o
end }
local CS = { AddTag = function(_, o, t) o.tags[t] = true end }
local RS = { WaitForChild = function(_, n) return { WaitForChild = function(_, m) return { Name = m } end } end }
game = { GetService = function(_, n)
	if n == "CollectionService" then return CS end
	if n == "ReplicatedStorage" then return RS end
	return {}
end }
warn = print
