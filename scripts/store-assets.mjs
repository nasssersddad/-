// يطلع صور صفحة Google Play: صورة الغلاف 1024×500، ولقطات شاشة 1920×1080 من اللعبة نفسها
// الاستخدام: node scripts/store-assets.mjs   (الأيقونة 512 من scripts/make-icons.mjs)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('web');
const out = path.resolve('store');
fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const quiet = () => ev(async () => {
  document.querySelectorAll('.newbtn').forEach(e => e.classList.remove('newbtn'));
  const dq = document.getElementById('dqMini'); if (dq) dq.style.visibility = 'hidden';
  const ui = window.__game.ui;
  for (let i = 0; i < 40 && ui.dialogOpen; i++) { ui.advance(); ui.advance(); await new Promise(r => setTimeout(r, 20)); }
  for (const m of [...ui.modals]) { m.closable = true; m.close(); }
  document.querySelectorAll('.toast, .firstcard').forEach(e => e.remove());
});

await page.goto(base + 'index.html');
await ev(() => { window.__fastAds = true; localStorage.clear(); });
await page.click('#startBtn');
await wait(800);
await quiet();

// مزرعة حلوة جاهزة للتصوير: مباني، زرع بمراحل مختلفة، نياق، دجاج، وورشة شغالة
const setup = await ev(async () => {
  const g = window.__game, s = g.state;
  const P = await import('./js/systems/placement.js');
  const C = await import('./js/systems/camels.js');
  const PR = await import('./js/systems/production.js');
  s.introSeen = true; s.flags.helpSeen = true; s.flags.firsts = Object.fromEntries(['harvest', 'storeSold', 'guest', 'milk', 'egg', 'craft', 'build', 'order', 'request', 'calf', 'trip', 'combo', 'lucky', 'chest'].map(k => [k, true]));
  s.quest.index = 12; s.player.level = 14; s.player.xp = 120; s.player.coins = 48250; s.player.energy = 140;
  s.time.minute = 16 * 60 + 20;
  s.tech.t_brick = true; s.tech.t_kiln = true;
  const put = (type, near) => {
    const sp = P.findFreeSpot(s, g.world, type, near);
    if (!sp) return null;
    const r = P.place(s, g.world, type, sp.tx, sp.ty, false);
    if (r && r.ok !== false) s.built[P.info(type).spot || type] = true;
    return sp;
  };
  put('stable', { x: 55, y: 34 });
  s.built.stable = true;
  put('trough', { x: 56, y: 34 }); s.built.trough = true; s.trough.water = 8;
  put('coop', { x: 56, y: 41 }); s.built.coop = true; s.coop = { hens: 5, feedMin: 600, eggs: 6, last: null, acc: 0 };
  put('kiln', { x: 10, y: 9 }); s.built.kiln = true;
  put('mill', { x: 14, y: 9 }); s.built.mill = true;
  for (let i = 0; i < 5; i++) s.camels.push(C.makeCamel(s, Math.random, { ageDays: 9, beauty: 50 + i * 8 }));
  s.camels[0].rare = 'golden';
  for (const c of s.camels) { c.wateredDay = s.time.day; c.fedDay = s.time.day; }
  const seeds = ['seed_tomato', 'seed_wheat', 'seed_melon', 'seed_carrot', 'seed_corn'];
  const plots = g.world.objects.filter(o => o.kind === 'plot' && o.group === 1);
  plots.forEach((o, i) => { s.plots[o.id] = { seed: seeds[i % seeds.length], stage: i % 3 === 0 ? 99 : 1 + (i % 2), watered: true }; });
  Object.assign(s.inv, { clay: 20, water: 10, wood: 10 });
  PR.enqueue(s, 'kiln', 'brick', g.absMinutes());
  g.syncPlaced();
  // كل الأزرار مفتوحة ومشافة (بدون «جديد!») عشان الصور تكون نظيفة
  const U = await import('./js/systems/unlocks.js');
  U.markAllSeen(s);
  return { placed: s.placed.map(p => p.type), plots: plots.length };
});
console.log('setup:', setup);
await wait(1500);

const shot = async (name) => { await wait(400); await page.screenshot({ path: path.join(out, 'screenshots', name + '.png') }); console.log('📸', name); };
const goTo = (x, y, dir = 'up') => ev(({ x, y, dir }) => { const g = window.__game; g.placeAt({ x, y }); g.state.player.dir = dir; }, { x, y, dir });

// 1) الأحواض والزرع
await ev(() => { const g = window.__game; const o = g.world.objects.find(q => q.kind === 'plot' && q.group === 1); g.placeAt({ x: o.x + 40, y: o.y + 30 }); });
await wait(900); await quiet(); await shot('1-farm');
// 2) المراح والنياق
await ev(() => { const g = window.__game; const r = g.penRect(); g.placeAt({ x: (r.x0 + r.x1) / 2 - 20, y: r.y1 + 26 }); document.getElementById('quest').style.visibility = 'hidden'; });
await wait(1500); await quiet(); await shot('2-camels');
await ev(() => { document.getElementById('quest').style.visibility = ''; });
// 3) القن والدجاج
await ev(() => { const g = window.__game; const o = g.worldObjById['spot:coop']; g.placeAt({ x: o.x - 30, y: o.y + 34 }); });
await wait(1200); await quiet(); await shot('3-coop');
// 4) الورشة بطابورها
await ev(() => window.__game.ui.openCraft('kiln'));
await wait(600); await shot('4-workshop');
await quiet();
// 5) المتجر
await ev(() => window.__game.ui.openStore('seeds'));
await wait(600); await shot('5-store');
await quiet();
// 6) القرية
await ev(() => window.__game.travel('open'));
await wait(2500); await quiet();
await ev(() => { const g = window.__game; const o = g.open.farmObjs.umm_saad.owner; g.placeAt({ x: o.x, y: o.y + 40 }); });
await wait(1200); await shot('6-village');

// صورة الغلاف 1024×500: لقطة من المزرعة وراها، والاسم والشعار
await ev(() => window.__game.travel('world'));
await wait(2500); await quiet();
await ev(() => { const g = window.__game; const p = g.world.objects.filter(o => o.kind === 'palm').sort((a, b) => b.x - a.x)[3]; g.placeAt({ x: p.x - 120, y: p.y + 20 }); });
await page.setViewportSize({ width: 1024, height: 500 });
await ev(() => { document.querySelectorAll('#hud, #sidebar, #dock, #quest, #dqMini, #minimap, #actionBtn, #toasts, #stick, #eatBtn, #bldChip').forEach(e => { e.style.visibility = 'hidden'; }); });
await wait(1500);
const bg = (await page.screenshot({ type: 'png' })).toString('base64');
const icon = fs.readFileSync(path.join(out, 'icon-512.png')).toString('base64');
// Play يبي المقاس بالضبط 1024×500، فنصوّرها بكثافة 1
const fctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
const fpage = await fctx.newPage();
await fpage.setContent(`<!doctype html><html dir="rtl"><head><style>
  @font-face { font-family: Kufi; src: url(${base}fonts/reem-kufi-arabic-700-normal.woff2); }
  @font-face { font-family: Cairo; src: url(${base}fonts/cairo-arabic-700-normal.woff2); }
  html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
  .bg { position: absolute; inset: 0; background: url(data:image/png;base64,${bg}) center / cover; image-rendering: pixelated; }
  .shade { position: absolute; inset: 0; background: linear-gradient(270deg, rgba(30,12,4,.88) 0%, rgba(30,12,4,.6) 42%, rgba(30,12,4,0) 70%); }
  .box { position: absolute; right: 56px; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 26px; }
  .box img { width: 150px; height: 150px; border-radius: 30px; image-rendering: pixelated; box-shadow: 0 8px 24px rgba(0,0,0,.6), 0 0 0 4px #ffe28a; }
  h1 { margin: 0; font: 700 96px/1 Kufi; color: #ffe28a; text-shadow: 0 4px 0 #7a3a10, 0 8px 18px rgba(0,0,0,.6); }
  p { margin: 14px 0 0; font: 700 28px Cairo; color: #fff3d6; text-shadow: 0 2px 6px #000; }
</style></head><body><div class="bg"></div><div class="shade"></div>
<div class="box"><img src="data:image/png;base64,${icon}"><div><h1>المزارع</h1><p>ازرع، ربِّ النياق، وابنِ خانك 🐪🌴</p></div></div></body></html>`);
await fpage.evaluate(() => document.fonts.ready);
await fpage.waitForTimeout(300);
await fpage.screenshot({ path: path.join(out, 'feature-1024x500.png') });
console.log('📸 feature-1024x500');

await browser.close();
server.close();
if (errors.length) { console.error('❌ أخطاء:\n' + errors.join('\n')); process.exit(1); }
console.log('✅ صور المتجر بمجلد store/');
