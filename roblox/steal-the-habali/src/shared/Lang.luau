--!strict
-- الإنجليزي. اللعبة مكتوبة بالعربي، وهذا الملف يحوّل أي نص يطلع للاعب للإنجليزي لو لغته إنجليزي.
-- الترجمة كلها عند اللاعب (LangClient): السيرفر يرسل نفس العربي للكل.
--   Words: كلمة أو جملة كاملة ← ترجمتها
--   Templates: جملة فيها أرقام أو أسماء مكان {} ← ترجمتها مع {1} {2}... بنفس الترتيب
-- اللي في {} ينترجم هو بعد (اسم منطقة مثلاً)، وأسماء اللاعبين والأرقام تبقى مثل ما هي.
-- لو جملة ما لها ترجمة تطلع بالعربي (ما تخرب شي)، فلو أضفت نص جديد بالعربي أضف ترجمته هنا.

local Lang = {}

Lang.Words = {
	-- الطبقات والندرة والمعالم
	["الثمامة"] = "Thumamah",
	["الدهناء"] = "Dahna",
	["النفود"] = "Nafud",
	["الربع الخالي"] = "Empty Quarter",
	["شعبي"] = "Common",
	["نادر"] = "Rare",
	["نادر مرة"] = "Very Rare",
	["أسطوري"] = "Legendary",
	["إنفنتي"] = "Infinity",
	["ذهبي"] = "Gold",
	["دايموند"] = "Diamond",
	["الواحة"] = "the Oasis",
	["الوادي"] = "the Canyon",
	["جبال طويق"] = "Tuwaiq Mountains",
	["مقبرة السيارات"] = "the Car Graveyard",
	["الديرة"] = "Town",
	["البر"] = "the desert",
	["الديرة 🏠"] = "Town 🏠",

	-- الهبالي
	["هبالي"] = "Habali",
	["جملوني فريزيني"] = "Jamaloni Freezini",
	["دلّة تاكتيكو"] = "Dalla Tacticco",
	["شاورمانيو بومبارديو"] = "Shawarmanio Bombardio",
	["💫 دايخ"] = "💫 Dizzy",
	["🚙 انصاد"] = "🚙 Caught",
	["اسحب"] = "Pull",
	["؟ ؟ ؟"] = "? ? ?",
	["؟"] = "?",

	-- الناس والمحلات
	["أبو هبال"] = "Abu Habal",
	["يشتري هباليك 💰"] = "Buys your Habali 💰",
	["أبو عقيل"] = "Abu Aqeel",
	["محل العقّال"] = "Agal Shop",
	["أبو كفر"] = "Abu Kafr",
	["ورشة أبو كفر 🔧"] = "Abu Kafr's Garage 🔧",
	["أبو فلّة"] = "Abu Fella",
	["محطة البنزين ⛽"] = "Gas Station ⛽",
	["محطة بنزين ⛽"] = "Gas Station ⛽",
	["دكان أبو هبال 💰"] = "Abu Habal's Store 💰",
	["افتح المحل"] = "Open shop",
	["أبو بعير"] = "Abu Ba'eer",
	["بدوي يعرف البر"] = "Bedouin who knows the desert",
	["سولف معه"] = "Chat",
	["أبو كشتة"] = "Abu Kashta",
	["تقهوى وخذ يوميتك ☕"] = "Have coffee, get your daily ☕",
	["تقهوى"] = "Have coffee",
	["راعي الغنم"] = "Shepherd",
	["يتمشى مع غنمه"] = "Walking his sheep",
	["سلّم عليه"] = "Say hi",
	["أبو مصلح"] = "Abu Musleh",
	["بنزين الطوارئ ⛽ (غالي)"] = "Emergency fuel ⛽ (pricey)",
	["عبّي بنزين"] = "Buy fuel",

	-- العدّة والسيارة (أسماء الليفلات)
	["عقال"] = "Agal",
	["مسدس التنويم"] = "Sleep Gun",
	["ربع"] = "Rub'",
	["الربع"] = "the Rub'",
	["عقال مقصّب"] = "Embroidered Agal",
	["شبشب أم فهد"] = "Umm Fahad's Slipper",
	["العقال الذهبي"] = "Golden Agal",
	["مسدس تنويم"] = "Sleep Pistol",
	["بندقية تنويم"] = "Sleep Rifle",
	["قاذف النعاس"] = "Drowsy Launcher",
	["محرك الربع"] = "Stock Engine",
	["محرك تيربو"] = "Turbo Engine",
	["حوض الربع"] = "Stock Bed",
	["تانكي الربع"] = "Stock Tank",
	["تنويم"] = "Sleep",
	["فلّته"] = "Let go",
	["سيارتي"] = "My Car",
	["📯 هرن"] = "📯 Honk",
	["تخطّي"] = "Skip",

	-- القواعد
	["قاعدة فاضية"] = "Empty base",
	["اسرق 🦹"] = "Steal 🦹",
	["نزّلهم في القاعدة 🏠"] = "Unload at base 🏠",
	["اجمع الفلوس 💰"] = "Collect money 💰",
	["اقفل القاعدة 🔒"] = "Lock base 🔒",
	["حطه في السيارة"] = "Put in car",
	["اسرق من الحوض 🦹"] = "Steal from bed 🦹",
	["صب جالون ⛽"] = "Pour jerrycan ⛽",
	["البنزين"] = "Fuel",
	["🛡️ مبتدئ"] = "🛡️ Newbie",
	["👑 المطلوب الأول"] = "👑 Most Wanted",
	["💰 أغنى 10"] = "💰 Richest 10",
	["♻️ أكثر إعادات"] = "♻️ Most Rebirths",
	["محد للحين"] = "Nobody yet",

	-- الشاشات
	["📅 المكافأة اليومية"] = "📅 Daily Reward",
	["استلم 🎁"] = "Claim 🎁",
	["رجّع بكرة ⏰"] = "Come back tomorrow ⏰",
	["لو فوّت يوم واحد ما تخسر السلسلة"] = "Missing one day won't break your streak",
	["📜 مهمات اليوم"] = "📜 Today's Quests",
	["📖 موسوعة الهبالي"] = "📖 Habali Dex",
	["♻️ إعادة البداية والربع"] = "♻️ Rebirth & Friends",
	["تنمسح الفلوس والأسلحة وتطويرات السيارة، وهباليك يبقون"] = "Money, weapons and car upgrades reset. Your Habali stay",
	["🤝 ادعُ ربعك"] = "🤝 Invite friends",
	["متأكد؟ اضغط مرة ثانية"] = "Sure? Tap again",
	["♻️ أعد البداية"] = "♻️ Rebirth",
	["🤝 ما معك أحد من ربعك (كل صديق +10% دخل)"] = "🤝 No friends with you (each friend +10% income)",
	["، غيمة نوم 💤"] = ", sleep cloud 💤",
	["✅ عندك أقوى شي"] = "✅ You have the best",
	["الأقوى"] = "Maxed",
	["بيع اللي في سيارتك"] = "Sell what's in your car",
	["قرّب السيارة من الدكان، وانزل منها"] = "Bring the car to the store and get out",
	["سيارتك فاضية"] = "Your car is empty",
	["بيع 🚙"] = "Sell 🚙",
	["بيع اللي فوق راسك"] = "Sell what you're carrying",
	["الهبالي اللي شايله"] = "The Habali you're carrying",
	["ما تشيل شي"] = "You're not carrying anything",
	["بيع 🦹"] = "Sell 🦹",
	["الأسعار"] = "Prices",
	["دخل 5 دقايق: شعبي 300، نادر 1,200، نادر مرة 4,500، أسطوري 15,000"] = "5 min of income: Common 300, Rare 1,200, Very Rare 4,500, Legendary 15,000",
	["طلّع سيارتك وجيبها عند المضخة"] = "Spawn your car and bring it to the pump",
	["عبّي البنزين"] = "Refuel",
	["مليان"] = "Full",
	["جالون احتياط 🛢️"] = "Spare jerrycan 🛢️",

	-- الأحداث
	["♾️ الإنفنتي طلع!"] = "♾️ The Infinity is out!",
	["🌤️ خلصت العاصفة الرملية"] = "🌤️ The sandstorm is over",
	["🌪️ عاصفة رملية بعد دقيقة! جهّز سيارتك"] = "🌪️ Sandstorm in 1 minute! Get your car ready",
	["🌪️ العاصفة الرملية بدأت! النادر ضعف، والذهبي والدايموند أكثر"] = "🌪️ Sandstorm started! Double rares, more Gold and Diamond",
	["♾️ الإنفنتي هرب! يرجع الجمعة الجاية"] = "♾️ The Infinity escaped! Back next Friday",

	-- أول 3 دقايق
	["اضرب الهبالي بالعقال 🪢"] = "Hit a Habali with your agal 🪢",
	["دوّخته! قرّب واضغط اسحب"] = "It's dizzy! Get close and press Pull",
	["اضغط زر سيارتي 🚙"] = "Press My Car 🚙",
	["حطه في حوض السيارة"] = "Put it in the car bed",
	["سوق لقاعدتك ونزّله 🏠"] = "Drive to your base and unload 🏠",
	["اجمع فلوسك من الزر الأخضر 💰"] = "Collect your money from the green pad 💰",
	["🎉 خلصت! +500 💰 شوف النادر اللي يلمع بعيد، أندر وأغلى!"] = "🎉 Done! +500 💰 See the glowing rares far away? Rarer and pricier!",

	-- المهمات
	["صيد 8 من الثمامة"] = "Catch 8 in Thumamah",
	["صيد 5 من الدهناء"] = "Catch 5 in Dahna",
	["صيد 2 من النفود"] = "Catch 2 in Nafud",
	["صيد 10 هبالي"] = "Catch 10 Habali",
	["صيد ذهبي أو دايموند"] = "Catch a Gold or Diamond",
	["اسرق مرة وحدة 🦹"] = "Steal once 🦹",
	["بيع 3 هبالي عند أبو هبال"] = "Sell 3 Habali to Abu Habal",
	["عبّي بنزين مرتين عند أبو فلّة"] = "Refuel twice at Abu Fella",

	-- كلام الراعي وأبو بعير
	["الذهبي والدايموند قليلين، بس دخلهم أضعاف 💎"] = "Gold and Diamond are rare, but earn many times more 💎",
	["اللي يبعد عن الديرة يلقى أندر، بس شيك على بنزينك ⛽"] = "The farther from town, the rarer. Watch your fuel ⛽",
	["العاصفة إذا جت يكثر الهبالي، اطلع لها لا تخاف 🌪️"] = "Sandstorms bring more Habali. Go out, don't be scared 🌪️",
	["قفّل قاعدتك قبل لا تطلع، الحرامية كثير 🔒"] = "Lock your base before leaving, lots of thieves 🔒",
	["الغنم ما تنصاد، لا تحاول 🐑"] = "You can't catch sheep, don't try 🐑",
	["البر هادي اليوم، ما شفت شي"] = "The desert's quiet today, saw nothing",
	["ما شفت شي نادر الحين، تعال بعدين 🐪"] = "Haven't seen anything rare. Come back later 🐪",
	["🐪 توني قايل لك، روح دوّر"] = "🐪 I just told you, go look",
	["جيب سيارتك عند الونيت أول"] = "Bring your car to the pickup first",

	-- رسائل السيرفر
	["🎯 أخذت ثأرك!"] = "🎯 Revenge taken!",
	["🛡️ القاعدة محمية، صاحبها برا الديرة"] = "🛡️ Base is protected, the owner is out of town",
	["🛡️ صاحب القاعدة مبتدئ محمي"] = "🛡️ The owner is a protected newbie",
	["🔒 القاعدة مقفلة"] = "🔒 The base is locked",
	["🛡️ صاحب السيارة مبتدئ محمي"] = "🛡️ The car owner is a protected newbie",
	["😵 طيّحوه منك!"] = "😵 They knocked it out of your hands!",
	["سيارتك ما تشيله! تحتاج سيارة أقوى"] = "Your car can't carry it! You need a stronger car",
	["سيارتك مليانة"] = "Your car is full",
	["✅ صار في سيارتك! نزّله في قاعدتك"] = "✅ It's in your car! Unload it at your base",
	["✅ صار في سيارتك!"] = "✅ It's in your car!",
	["دخّل سيارتك داخل القاعدة أول"] = "Drive your car into your base first",
	["منصاتك مليانة!"] = "Your pads are full!",
	["⚠️ الحفظ متوقف في هالتجربة (Studio بدون API)"] = "⚠️ Saving is off in this test (Studio without API)",
	["استنى شوي قبل ما تطلّع سيارة ثانية"] = "Wait a bit before spawning another car",
	["سيارتك فيها هبالي! ما أقدر أطلّع لك وحدة جديدة"] = "Your car has Habali in it! Can't spawn a new one",
	["الموقف مليان، جرّب بعد شوي"] = "Parking is full, try again soon",
	["ما معك جالون. اشتر من أبو فلّة في المحطة"] = "No jerrycan. Buy one from Abu Fella at the station",
	["التانكي مليان"] = "Tank is full",
	["⛽ التانكي مليان"] = "⛽ Tank is full",
	["⛽ صبّيت جالون"] = "⛽ Poured a jerrycan",
	["سيارتك الربع في موقف الديرة 🚙"] = "Your Rub' is in the town parking 🚙",
	["⛽ خلص البنزين! صب جالون، أو امش للمحطة. انتبه: اللي في الحوض ممكن ينسرق"] = "⛽ Out of fuel! Pour a jerrycan or walk to the station. Careful: your bed can get stolen",
	["🚙 سيارتك رجعت للديرة فاضية (خلص بنزينها). طلّعها من جديد وعبّي"] = "🚙 Your car went back to town empty (out of fuel). Spawn it again and refuel",
	["💫 دوّخته! قرّب واضغط اسحب"] = "💫 It's dizzy! Get close and press Pull",
	["🛡️ هذا مبتدئ محمي، ما تقدر تطيّح منه شي"] = "🛡️ Protected newbie, you can't knock anything off them",
	["😵 ضربوك وفلت منك الهبالي!"] = "😵 You got hit and dropped the Habali!",
	["💥 طيّحته! امسك الهبالي"] = "💥 Knocked it loose! Grab the Habali",
	["🪢 اسحبه لسيارتك واضغط: حطه في السيارة"] = "🪢 Drag it to your car and press: Put in car",
	["😤 صحى ونطحك! دوّخه مرة ثانية"] = "😤 It woke up and headbutted you! Stun it again",
	["ما يدخل السيارة"] = "It won't fit in the car",
	["فلت منك! لازم تحطه في السيارة وأنت برا"] = "It got away! Load it while you're outside the car",
	["انقطع الحبل وفلت منك"] = "The rope snapped and it got away",
	["🛡️ انتهت حماية المبتدئ لأنك سرقت. الحين تقدر تنسرق بعد!"] = "🛡️ Newbie protection ended because you stole. You can be robbed now!",
	["🛡️ خلصت حماية المبتدئ. انتبه لقاعدتك!"] = "🛡️ Newbie protection is over. Watch your base!",
	["💸 فلوسك ما تكفي"] = "💸 Not enough money",
	["الحوض الجديد يركب في سيارتك الجاية (طلّعها من جديد وهي فاضية)"] = "The new bed fits on your next car (respawn it while empty)",
	["قرّب سيارتك من الدكان أول"] = "Bring your car to the store first",
	["انزل من السيارة أول"] = "Get out of the car first",
	["جيب سيارتك عند المضخة أول"] = "Bring your car to the pump first",
	["دخلت من مكان ثاني. ارجع للعبة من جديد"] = "You joined from somewhere else. Rejoin the game",
	["ما قدرنا نحمّل بياناتك، جرّب بعد شوي"] = "Couldn't load your data, try again soon",
}

Lang.Templates = {
	-- أرقام ووقت
	["{} يوم {} ساعة"] = "{1}d {2}h",
	["{} ساعة {} دقيقة"] = "{1}h {2}m",
	["{} دقيقة"] = "{1} min",
	["{} ثانية"] = "{1} s",
	["يوم {}"] = "Day {1}",
	["{} ذهبي"] = "Gold {1}", -- النوع بعد اسم الهبالي
	["{} دايموند"] = "Diamond {1}",
	["{} · {}"] = "{1} · {2}",
	["قاعدة {}"] = "{1}'s base",
	["بداية {}"] = "Entering {1}",
	["+{} 💰/ث"] = "+{1} 💰/s",
	["محرك {}"] = "Engine {1}",
	["حوض {}"] = "Bed {1}",
	["تانكي {}"] = "Tank {1}",
	["✅ {}"] = "✅ {1}",
	["💰 {}"] = "💰 {1}",
	["باقي {}"] = "{1} to go",

	-- الشاشات
	["🎯 مطلوب ثأرك {}"] = "🎯 Revenge wanted {1}",
	["🌪️ العاصفة: باقي {}"] = "🌪️ Sandstorm: {1} left",
	["🌪️ عاصفة بعد {}"] = "🌪️ Sandstorm in {1}",
	["♾️ الإنفنتي عند {}"] = "♾️ The Infinity is at {1}",
	["♾️ الإنفنتي بعد {}"] = "♾️ Infinity in {1}",
	["🎉 صدت {}! ({})"] = "🎉 You caught {1}! ({2})",
	["🎉 صدت {}!"] = "🎉 You caught {1}!",
	["جائزة كل مهمة: 💰 {} (دخل قاعدتك 10 دقايق)"] = "Each quest pays 💰 {1} (10 min of base income)",
	["{} ✅ كاملة"] = "{1} ✅ Complete",
	["{} · باقي لك {} (الجائزة {})"] = "{1} · {2} left (reward {3})",
	["{}/{}  {}"] = "{1}/{2}  {3}",
	["🛡️ محمي: باقي {} دقيقة"] = "🛡️ Protected: {1} min left",
	["لو دخل صديقك أول مرة من دعوتك: +{} لكم الاثنين"] = "If a friend joins for the first time from your invite: +{1} for both",
	["سويت {} إعادة · دخلك ×{}"] = "{1} rebirths · income ×{2}",
	["الجاية: 💰 {} (+{}% دخل للأبد)"] = "Next: 💰 {1} (+{2}% income forever)",
	["🤝 معك {} من ربعك: +{}% دخل"] = "🤝 {1} friends with you: +{2}% income",
	["ضربات الأسطوري: {} ← {}"] = "Legendary hits: {1} → {2}",
	["المدى {} ← {}، طلقات الأسطوري {} ← {}{}"] = "Range {1}→{2}, Legendary shots {3}→{4}{5}",
	["السرعة {} ← {}"] = "Speed {1} → {2}",
	["الحمولة {} ← {}"] = "Load {1} → {2}",
	["التانكي {} ← {}"] = "Tank {1} → {2}",
	["يعطيك {} stud · معك {} من {}"] = "Gives {1} studs · you have {2} of {3}",

	-- رسائل السيرفر
	["🎯 أخذت ثأرك! بونص +{} 💰"] = "🎯 Revenge taken! Bonus +{1} 💰",
	["🦹 سرقت {}! حطه في سيارتك وهرّب"] = "🦹 You stole {1}! Put it in your car and run",
	["🚨 {} سرق {} من قاعدتك! الحقه 🎯"] = "🚨 {1} stole {2} from your base! Chase them 🎯",
	["🦹 سرقت {} من سيارة {}!"] = "🦹 You stole {1} from {2}'s car!",
	["🚨 {} سرق {} من سيارتك! الحقه 🎯"] = "🚨 {1} stole {2} from your car! Chase them 🎯",
	["💪 رجّعت {} لقاعدتك!"] = "💪 You got {1} back to your base!",
	["🦹 أخذت {} منه! حطه في سيارتك"] = "🦹 You took {1} from them! Put it in your car",
	["🏠 نزّلت {} هبالي في قاعدتك"] = "🏠 Unloaded {1} Habali at your base",
	["🔒 تقدر تقفلها بعد {} ثانية"] = "🔒 You can lock it in {1} s",
	["🔒 قفلت قاعدتك {} ثانية"] = "🔒 Base locked for {1} s",
	["هالسيارة لـ {}، تركب بس لو أنت من ربعه"] = "This car is {1}'s. Only their friends can ride",
	["⚠️ {} يضربك! ({}/{})"] = "⚠️ {1} is hitting you! ({2}/{3})",
	["الربع ما تشيل {}! تحتاج سيارة أقوى"] = "The Rub' can't carry {1}! You need a stronger car",
	["{} {} صاد {} ({})!"] = "{1} {2} caught {3} ({4})!",
	["{} {} سرق {} ({})!"] = "{1} {2} stole {3} ({4})!",
	["♾️ طلع الإنفنتي عند {}! أول واحد يصيده ياخذه"] = "♾️ The Infinity appeared near {1}! First to catch it keeps it",
	["♾️ الإنفنتي يطلع بعد {}!"] = "♾️ The Infinity appears in {1}!",
	["📅 مكافأة اليوم {}: +{} 💰{}"] = "📅 Day {1} reward: +{2} 💰{3}",
	[" + جالون 🛢️"] = " + jerrycan 🛢️",
	["✅ خلصت مهمة: {}  +{} 💰"] = "✅ Quest done: {1}  +{2} 💰",
	["📖 كمّلت {} في الموسوعة! +{} 💰"] = "📖 Completed {1} in the Dex! +{2} 💰",
	["📖 جديد في موسوعتك! باقي لك {} في {}"] = "📖 New in your Dex! {1} left in {2}",
	["💸 تحتاج {} عشان تعيد البداية"] = "💸 You need {1} to rebirth",
	["♻️ {} سوّى إعادة بداية رقم {}! دخله صار ×{}"] = "♻️ {1} did rebirth #{2}! Income now ×{3}",
	["👑 {} صار المطلوب الأول! اسرقه وخذ +20%"] = "👑 {1} is Most Wanted! Rob them for +20%",
	["👑 سرقت من المطلوب الأول! بونص +{} 💰"] = "👑 You robbed the Most Wanted! Bonus +{1} 💰",
	["🤝 دخلت بدعوة {}! +{} 💰"] = "🤝 You joined from {1}'s invite! +{2} 💰",
	["🤝 {} دخل من دعوتك! +{} 💰"] = "🤝 {1} joined from your invite! +{2} 💰",
	["{}. {}  {}"] = "{1}. {2}  {3}",
	["🎉 اشتريت {}!"] = "🎉 You bought {1}!",
	["💰 بعت {} بـ {}"] = "💰 Sold {1} for {2}",
	["💰 بعت {} هبالي بـ {}"] = "💰 Sold {1} Habali for {2}",
	["⛽ عبّيت بـ {}"] = "⛽ Refueled for {1}",
	["معك {} جوالين، ما تقدر تشيل أكثر"] = "You have {1} jerrycans, can't carry more",
	["🛢️ اشتريت جالون (معك {})"] = "🛢️ Bought a jerrycan (you have {1})",
	["شفت {} يركض في {}، جهة {} 🐪"] = "Saw a {1} running in {2}, toward {3} 🐪",
	["⛽ أبو مصلح عبّاك بـ {} (غالي بس أنقذك)"] = "⛽ Abu Musleh filled you up for {1} (pricey, but saved you)",
	["🐑 {}"] = "🐑 {1}",
	["{} 💰"] = "{1} 💰",
	["{} ♻️"] = "{1} ♻️",
}

-- ===== المحرّك =====

type Compiled = { Pattern: string, English: string, Literal: number }

local MAGIC = "([%(%)%.%%%+%-%*%?%[%]%^%$])"

local function compile(): { Compiled }
	local list: { Compiled } = {}
	for arabic, english in Lang.Templates do
		local parts = string.split(arabic, "{}")
		local escaped = {}
		local literal = 0
		for i, piece in parts do
			escaped[i] = (piece:gsub(MAGIC, "%%%1"))
			literal += #piece
		end
		table.insert(list, { Pattern = "^" .. table.concat(escaped, "(.-)") .. "$", English = english, Literal = literal })
	end
	-- الأطول (الأدق) أول
	table.sort(list, function(a, b)
		return a.Literal > b.Literal
	end)
	return list
end

local compiled: { Compiled }? = nil
local cache: { [string]: string } = {}
local cacheSize = 0

-- فيه حرف عربي؟ (الحروف العربية في UTF-8 تبدأ بـ 0xD8 لين 0xDB)
local function hasArabic(text: string): boolean
	return text:find("[\216-\219]") ~= nil
end

local translate: (string, number) -> string

local function translateLine(text: string, depth: number): string
	local word = Lang.Words[text]
	if word then
		return word
	end
	if depth > 3 then
		return text
	end
	-- نفضّل القالب اللي كل أجزاؤه تنترجم. لو ما فيه (اسم لاعب بالعربي مثلاً) ناخذ أول قالب طابق
	local fallback: string? = nil
	for _, t in compiled :: { Compiled } do
		local captures = { text:match(t.Pattern) }
		if #captures > 0 then
			local complete = true
			local done = {}
			for i, c in captures do
				done[i] = translate(c, depth + 1)
				if hasArabic(done[i]) then
					complete = false
				end
			end
			local result = (t.English:gsub("{(%d+)}", function(n)
				return done[tonumber(n) :: number] or ""
			end))
			if complete then
				return result
			end
			fallback = fallback or result
		end
	end
	return fallback or text
end

function translate(text: string, depth: number): string
	if not hasArabic(text) then
		return text
	end
	-- الأسطر والقطع اللي بينها " · " كل وحدة لحالها
	if text:find("\n", 1, true) then
		local lines = string.split(text, "\n")
		for i, line in lines do
			lines[i] = translate(line, depth)
		end
		return table.concat(lines, "\n")
	end
	if text:find("  ·  ", 1, true) then
		local parts = string.split(text, "  ·  ")
		for i, part in parts do
			parts[i] = translate(part, depth)
		end
		return table.concat(parts, "  ·  ")
	end
	return translateLine(text, depth)
end

-- يرجّع النص بالإنجليزي (أو نفسه لو ما له ترجمة)
function Lang.ToEnglish(text: string): string
	if not compiled then
		compiled = compile()
	end
	local hit = cache[text]
	if hit then
		return hit
	end
	local result = translate(text, 0)
	if cacheSize > 3000 then
		table.clear(cache)
		cacheSize = 0
	end
	cache[text] = result
	cacheSize += 1
	return result
end

-- يرجّع الجمل اللي فيها عربي وما لها ترجمة (للاختبار)
function Lang.Untranslated(texts: { string }): { string }
	local missing = {}
	for _, text in texts do
		if hasArabic(Lang.ToEnglish(text)) then
			table.insert(missing, text)
		end
	end
	return missing
end

-- لغة اللاعب الأولى: عربي لو جهازه عربي أو هو من دولة عربية، وإلا إنجليزي
local ARAB = { SA = true, AE = true, KW = true, QA = true, BH = true, OM = true, YE = true, IQ = true, JO = true, SY = true, LB = true, PS = true, EG = true, LY = true, TN = true, DZ = true, MA = true, SD = true, MR = true }

function Lang.DefaultIsArabic(localeId: string?, country: string?): boolean
	if type(localeId) == "string" and localeId:lower():sub(1, 2) == "ar" then
		return true
	end
	return type(country) == "string" and ARAB[country:upper()] == true
end

return Lang
