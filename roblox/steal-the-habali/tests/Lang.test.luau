-- اختبار الترجمة للإنجليزي:
--   luau roblox/steal-the-habali/tests/Lang.test.luau
-- أو داخل Studio: require(game.ServerStorage.Tests["Lang.test"])

local function load(name: string): any
	if script then
		return require((game :: any).ReplicatedStorage.Shared[name]:Clone())
	end
	return require("../src/shared/" .. name)
end

local Lang = load("Lang")
local failures = 0

local function expect(arabic: string, english: string)
	local got = Lang.ToEnglish(arabic)
	if got ~= english then
		failures += 1
		print("FAIL: " .. arabic .. " => " .. got .. " (wanted " .. english .. ")")
	end
end

expect("سيارتك فاضية", "Your car is empty")
expect("⛽ عبّيت بـ 1,200", "⛽ Refueled for 1,200")
expect("🎉 صدت جملوني فريزيني ذهبي! (نادر)", "🎉 You caught Gold Jamaloni Freezini! (Rare)")
expect("🎉 Nasser صاد دلّة تاكتيكو دايموند (أسطوري)!", "🎉 Nasser caught Diamond Dalla Tacticco (Legendary)!")
expect("🚨 Ahmed سرق شاورمانيو بومبارديو من قاعدتك! الحقه 🎯", "🚨 Ahmed stole Shawarmanio Bombardio from your base! Chase them 🎯")
expect("♾️ الإنفنتي بعد 6 يوم 3 ساعة", "♾️ Infinity in 6d 3h")
expect("🌪️ عاصفة بعد 2 دقيقة  ·  ♾️ الإنفنتي طلع!", "🌪️ Sandstorm in 2 min  ·  ♾️ The Infinity is out!")
expect("1/6  اضرب الهبالي بالعقال 💥", "1/6  Hit a Habali with your agal 💥")
expect("نادر · ذهبي", "Rare · Gold")
expect("شفت أسطوري يركض في الربع الخالي، جهة جبال طويق 🐪", "Saw a Legendary running in Empty Quarter, toward Tuwaiq Mountains 🐪")
expect("✅ خلصت مهمة: صيد 8 من الثمامة  +7,800 💰", "✅ Quest done: Catch 8 in Thumamah  +7,800 💰")
expect("1. Nasser  1,000 💰\n2. ؟  5 ♻️", "1. Nasser  1,000 💰\n2. ?  5 ♻️")
expect("بداية النفود", "Entering Nafud")
expect("قاعدة Nasser", "Nasser's base")
expect("باقي 9,999,500", "9,999,500 to go")
expect("Hello 123", "Hello 123")
expect("سويت 1 إعادة · دخلك ×1.25", "1 rebirths · income ×1.25")
expect("🐑 الغنم ما تنصاد، لا تحاول 🐑", "🐑 You can't catch sheep, don't try 🐑")
if not Lang.DefaultIsArabic("ar-sa", nil) or not Lang.DefaultIsArabic("en-us", "SA") or Lang.DefaultIsArabic("en-us", "US") then
	failures += 1
	print("FAIL: default language")
end

print(if failures == 0 then "Lang: all passed" else ("Lang: " .. failures .. " failed"))
return failures
