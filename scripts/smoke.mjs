// اختبار دخان: يشغّل اللعبة بمتصفح بمقاس جوال أفقي، يلعب آلياً، ويصوّر
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('web');
const outDir = process.env.SHOTS || 'shots';
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;

const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));

const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('📸', name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const skip = () => ev(async () => {
  const ui = window.__game.ui;
  for (let i = 0; i < 40 && ui.dialogOpen; i++) { ui.advance(); ui.advance(); await new Promise(r => setTimeout(r, 30)); }
});
const closeModals = () => ev(() => { const ui = window.__game.ui; for (const m of [...ui.modals]) { m.closable = true; m.close(); } });
const tick = (ms = 300) => page.waitForTimeout(ms);

await page.goto(url);
await page.evaluate(() => { window.__fastAds = true; localStorage.clear(); });
await shot('00-title');
await page.click('#startBtn');
await tick(600);
await shot('01-intro');
await skip();
await tick(300);

// 1) كلّم الفانوس
await ev(() => { const g = window.__game; const l = g.worldObjById.lamp; g.state.player.x = l.x + 14; g.state.player.y = l.y + 2; g.state.player.dir = 'left'; });
await tick(200);
await ev(() => window.__game.doAction(window.__game.findTarget(), true));
await tick(400);
await shot('02-lamp-dialog');
await skip();
await tick(800);
await skip();
await closeModals();

// 2) اقطع نخل
const cutPalms = await ev(async () => {
  const g = window.__game;
  const palms = g.world.objects.filter(o => o.kind === 'palm').slice(0, 3);
  let n = 0;
  for (const p of palms) {
    g.state.player.x = p.x - 12; g.state.player.y = p.y + 2; g.state.player.dir = 'right';
    for (let i = 0; i < 3; i++) {
      const t = g.findTarget();
      if (t && t.kind === 'palm') { g.doAction(t, true); n++; }
      await new Promise(r => setTimeout(r, 400));
    }
  }
  return n;
});
console.log('palm hits:', cutPalms);
await tick(300);
await shot('03-palms');
await skip(); await closeModals(); await skip();

// 3) المنجرة
await ev(() => { const g = window.__game; const w = g.worldObjById.workbench; g.state.player.x = w.x; g.state.player.y = w.y + 14; g.state.player.dir = 'up'; });
await tick(200);
await ev(() => window.__game.doAction(window.__game.findTarget(), true));
await tick(400);
await shot('04-craft-panel');
await ev(() => { const g = window.__game; g.state.inv.wood = (g.state.inv.wood || 0) + 10; g.state.inv.frond = (g.state.inv.frond || 0) + 10; g.ui.modals[0].rerender(); });
await page.click('[data-a="craft"][data-v="plank"]');
await page.click('[data-a="craft"][data-v="plank"]');
await page.click('[data-a="craft"][data-v="rope"]');
await tick(300);
await closeModals();
await tick(700);
await skip(); await closeModals(); await skip();

// 4) الفراش
await ev(() => { const g = window.__game; const b = g.worldObjById['spot:my_bed']; g.state.player.x = b.x; g.state.player.y = b.y + 12; g.state.player.dir = 'up'; });
await tick(200);
await ev(() => window.__game.doAction(window.__game.findTarget(), true));
await tick(300);
await shot('05-build-panel');
await page.click('[data-a="build"]');
await tick(900);
await skip(); await closeModals(); await skip(); await closeModals();

// 5) الزراعة
await ev(async () => {
  const g = window.__game;
  g.state.inv.water = 5;
  for (const id of ['plot0', 'plot1']) {
    const o = g.worldObjById[id];
    g.state.player.x = o.x; g.state.player.y = o.y + 12; g.state.player.dir = 'up';
    const t = g.findTarget(); g.doAction(t, true);
    await new Promise(r => setTimeout(r, 380));
    window.__plantShot = window.__plantShot || true;
    await new Promise(r => setTimeout(r, 500));
    g.doAction(g.findTarget(), true);
    await new Promise(r => setTimeout(r, 950));
  }
});
await tick(300);
// لقطة أنيميشن السقي بنصه
await ev(() => { const g = window.__game; const o = g.worldObjById.plot2; g.state.inv.seed_wheat = 5; g.state.player.x = o.x; g.state.player.y = o.y + 12; g.state.player.dir = 'up'; g.doAction(g.findTarget(), true); });
await tick(900);
await ev(() => { const g = window.__game; g.state.player.dir = 'up'; g.doAction(g.findTarget(), true); });
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(outDir, '06a-watering.png') });
await tick(800);
await shot('06-farm');
await skip(); await closeModals(); await skip(); await closeModals();

// 6) المكافآت اليومية والعجلة
await ev(() => window.__game.ui.openRewards('daily'));
await tick(300);
await shot('07-daily');
await page.click('[data-a="claimDaily"]');
await tick(400);
await shot('08-offer');
await page.click('[data-a="x2"]');
await tick(800);
await closeModals();
await ev(() => window.__game.ui.openRewards('wheel'));
await tick(300);
await page.click('[data-a="spin"][data-v="free"]');
await tick(2000);
await shot('09-wheel-spinning');
await tick(3000);
await closeModals();

// 7) ضيوف: خلّ الساعة الصبح ووصل قافلة
await ev(() => { const g = window.__game; g.state.time.minute = 8 * 60; g.state.guests.day = 0; g.state.inv.coffee = 5; });
await tick(3500);
await ev(() => { const g = window.__game; const w = g.worldObjById.well; g.state.player.x = w.x - 20; g.state.player.y = w.y + 30; });
await tick(300);
await shot('10-caravan');
await ev(async () => {
  const g = window.__game;
  for (const gu of g.guestRt) { gu.x = gu.spot.x; gu.y = gu.spot.y; gu.moving = false; }
  const gu = g.guestRt.find(x => x.want === 'coffee') || g.guestRt[0];
  g.state.inv[gu.want] = 3;
  g.state.player.x = gu.x; g.state.player.y = gu.y + 12; g.state.player.dir = 'up';
  await new Promise(r => setTimeout(r, 100));
  g.doAction(g.findTarget(), true);
});
await tick(600);
await shot('11-served');
await skip(); await closeModals(); await skip(); await closeModals();

// 8) المعرفة والحقيبة والتحف
await ev(() => { window.__game.state.kp = { c: 10, n: 10, s: 5 }; window.__game.ui.openTech(); });
await tick(300);
await shot('12-tech');
await closeModals();
await ev(() => window.__game.ui.openInventory());
await tick(300);
await shot('13-inventory');
await closeModals();
await ev(() => window.__game.ui.openRelics());
await tick(200);
await shot('14-relics');
await closeModals();

// 9) الليل
await ev(() => { const g = window.__game; g.state.time.minute = 22 * 60; const h = g.worldObjById.hearth; g.state.player.x = h.x + 20; g.state.player.y = h.y + 30; g.state.built.lamps = true; });
await tick(500);
await shot('15-night');

// 10) صندوق كنز
await ev(() => { const g = window.__game; g.state.time.minute = 12 * 60; g.dropChest(g.state.player.x + 14, g.state.player.y, 'rare'); });
await tick(400);
await ev(() => { const g = window.__game; g.state.player.dir = 'right'; });
await tick(100);
await ev(() => window.__game.doAction(window.__game.findTarget(), true));
await tick(1300);
await shot('16-chest');
await page.click('[data-a="x1"]');
await tick(300);
await closeModals();

// 11) السرداب
await ev(() => { const g = window.__game; g.state.built.crypt_door = true; g.state.flags.crypt_unlocked = true; g.enterFloor(1); });
await tick(600);
await shot('17-dungeon');
const killed = await ev(async () => {
  const g = window.__game;
  let kills = 0;
  for (const e of g.dungeon.enemies.filter(x => !x.def.boss).slice(0, 3)) {
    g.state.player.x = e.x - 10; g.state.player.y = e.y; g.state.player.hp = 99;
    for (let i = 0; i < 12 && e.hp > 0; i++) { g.attack(null); await new Promise(r => setTimeout(r, 20)); }
    if (e.hp <= 0) kills++;
  }
  return kills;
});
console.log('dungeon kills:', killed);
await tick(300);
await skip(); await closeModals();
await shot('18-dungeon-fight');
await ev(() => window.__game.exitDungeon());
await tick(300);

// 12) الإنجازات
await ev(() => { const g = window.__game; g.state.stats.palms = 12; g.ui.openRewards('ach'); });
await tick(300);
await shot('19-achievements');
await closeModals();

// 13) المراح والنياق
await ev(() => { const g = window.__game; const s = g.state; s.tech.t_stable = true; s.inv.plank = 10; s.inv.rope = 10; s.inv.wood = 10; s.inv.water = 20; s.inv.alfalfa = 10;
  s.inv.clay = 10; s.inv.brick = 10; s.inv.jar = 2; s.player.energy = 100; s.time.minute = 9 * 60; g.doBuild('stable'); });
await tick(500);
await skip(); await closeModals();
await ev(() => { const g = window.__game; g.doBuild('trough'); });
await tick(300);
await closeModals();
const camelsCount = await ev(() => window.__game.state.camels.length);
console.log('starter camels:', camelsCount);
// كب ماء بالحوض
await ev(() => { const g = window.__game; const o = g.worldObjById['spot:trough']; g.state.player.x = o.x - 14; g.state.player.y = o.y + 2; g.state.player.dir = 'right'; });
await tick(200);
await ev(() => window.__game.doAction(window.__game.findTarget(), true));
await page.waitForTimeout(450);
await page.screenshot({ path: path.join(outDir, '21-pour-trough.png') });
await tick(700);
const trough = await ev(() => window.__game.state.trough.water);
console.log('trough water:', trough);
// اسقِ وأطعم كل النياق
await ev(async () => {
  const g = window.__game;
  for (const c of g.state.camels) {
    for (let i = 0; i < 3; i++) {
      const rt = g.camelRt[c.id];
      g.state.player.x = rt.x - 12; g.state.player.y = rt.y; g.state.player.dir = 'right';
      g.camelAction(c, rt);
      await new Promise(r => setTimeout(r, 1100));
    }
  }
});
await closeModals();
await shot('22-pen');
// التلقيح بالقوة مع ولادة نادرة
const born = await ev(async () => {
  const g = window.__game; const s = g.state;
  const f = s.camels.find(c => c.sex === 'f'), m = s.camels.find(c => c.sex === 'm');
  const ok = window.__camelBreed = (await import('./js/systems/camels.js')).breed(s, m.id, f.id, s.time.day, false);
  const rng = g.rng; g.rng = () => 0.001;
  g.onNewDay(1); s.time.day += 0;
  for (let i = 0; i < 3; i++) { s.time.day += 1; g.onNewDay(1); }
  g.rng = rng;
  return { ok, n: s.camels.length, rare: s.camels.some(c => c.rare) };
});
console.log('breeding:', born);
await tick(700);
await shot('23-rare-birth');
await closeModals(); await skip(); await closeModals();
await ev(() => window.__game.ui.openCamels(null, 'pen'));
await tick(300);
await shot('24-camels-panel');
// السوق: اعرض النادرة واستقبل عروض وساوم
const sold = await ev(async () => {
  const g = window.__game; const s = g.state;
  const mk = await import('./js/systems/market.js');
  const rare = s.camels.find(c => c.rare);
  mk.listCamel(s, rare.id, 400000, g.now() - 3600000);
  g.marketTick();
  return s.market.offers.length;
});
console.log('offers:', sold);
await closeModals();
await ev(() => window.__game.ui.openCamels(null, 'mine'));
await tick(300);
await shot('25-offers');
await page.click('[data-a="counter"]');
await tick(200);
await page.fill('#hagIn', '500000');
await page.click('[data-a="send"]');
await tick(300);
await shot('26-haggle');
await closeModals();
await ev(() => window.__game.ui.openCamels(null, 'market'));
await tick(300);
await shot('27-market');
await closeModals();
await ev(() => window.__game.ui.openCamels(null, 'barter'));
await tick(300);
await shot('28-barter');
await closeModals();
await ev(() => { const g = window.__game; const p = g.worldObjById['spot:trough']; g.state.player.x = p.x + 40; g.state.player.y = p.y + 20; });
await tick(400);
await shot('29-pen-world');

// 14) العمّال: توظيف، إضراب، غرامة، بنّاء
const wk = await ev(async () => {
  const g = window.__game; const s = g.state;
  const W = await import('./js/systems/workers.js');
  s.player.coins += 5000; s.built.workers_house = true;
  s.time.minute = 9 * 60; g.clockTick();
  const cands = W.candidates(s, s.time.day);
  for (const c of cands) W.hire(s, c);
  const builder = s.workers.find(w => w.type === 'builder') || s.workers[0];
  builder.type = 'builder';
  s.inv.plank = 20; s.inv.frond = 20; s.inv.rope = 10;
  const assigned = W.assignBuild(s, builder.id, 'stall_shop').ok;
  // عدّي 4 ساعات بدون دفع
  s.payroll.auto = false;
  for (let i = 0; i < 4; i++) { s.time.minute += 60; g.clockTick(); }
  const strikers = s.workers.filter(w => w.status === 'strike').length;
  const cost = W.reinstateCost(s.workers[0]);
  const back = W.reinstate(s, s.workers[0].id);
  for (const w of s.workers) if (w.status === 'strike') W.reinstate(s, w.id);
  return { hired: s.workers.length, assigned, strikers, cost, back };
});
console.log('workers:', wk);
await tick(2500);
await ev(() => { const g = window.__game; const w = g.state.workers[0]; const rt = g.workerRt[w.id]; g.state.player.x = rt.x - 20; g.state.player.y = rt.y; });
await tick(300);
await closeModals();
await shot('30-workers-world');
await ev(() => window.__game.ui.openWorkers());
await tick(300);
await shot('31-workers-panel');
await closeModals();
// البنّاء يخلص البسطة
const built = await ev(async () => {
  const g = window.__game; const s = g.state;
  const b = s.workers.find(w => w.job);
  if (b) { const rt = g.workerRt[b.id]; const o = g.worldObjById['spot:' + b.job.spot]; rt.x = o.x + 12; rt.y = o.y + 8; b.job.progress = b.job.need - 0.01; }
  await new Promise(r => setTimeout(r, 800));
  return !!s.built.stall_shop;
});
console.log('builder built stall:', built);
await closeModals();
// البسطة والطلبات والغنم
const trade = await ev(async () => {
  const g = window.__game; const s = g.state;
  const shop = await import('./js/systems/shop.js');
  s.inv.tomato = 20; s.inv.wood = 30; s.inv.stone = 30;
  shop.listItem(s, 0, 'tomato', 5, 5);
  s.built.orders_board = true; s.built.sheepfold = true;
  const rngFn = Math.random;
  let sold = [];
  for (let i = 0; i < 30 && !sold.length; i++) sold = shop.stallTick(s, 60, rngFn);
  const got = shop.collect(s, 0);
  const sh = await import('./js/systems/sheep.js');
  sh.buyLamb(s, 'najdi', rngFn); sh.buyLamb(s, 'naimi', rngFn);
  s.sheep[0].ageDays = 3;
  return { sold: sold.length, got, sheep: s.sheep.length };
});
console.log('trade:', trade);
await ev(() => window.__game.ui.openTrade('stall'));
await tick(300);
await shot('32-stall');
await closeModals();
await ev(() => window.__game.ui.openTrade('orders'));
await tick(300);
await shot('33-orders');
await closeModals();
await ev(() => { const g = window.__game; g.state.player.x = 37 * 16; g.state.player.y = 37 * 16; });
await tick(1500);
await closeModals();
await shot('34-fold-world');
await ev(() => { const g = window.__game; g.state.player.x = 30 * 16; g.state.player.y = 22 * 16; g.state.time.minute = 22 * 60; });
await tick(500);
await closeModals();
await shot('35-night-iso');
await ev(() => { const g = window.__game; g.state.time.minute = 10 * 60; });

// حفظ وتحميل
const saved = await ev(() => { window.__game.save(); return JSON.parse(localStorage.getItem('almuzare_save')).player.coins; });
console.log('saved coins:', saved);
const questIdx = await ev(() => window.__game.state.quest.index);
console.log('quest index:', questIdx);
await page.reload();
await page.click('#startBtn');
await tick(800);
const loaded = await ev(() => window.__game.state.player.coins);
await skip(); await closeModals();
console.log('loaded coins:', loaded);
await shot('20-reloaded');

await browser.close();
server.close();

const fatal = errors.filter(e => !/favicon/.test(e));
if (fatal.length) {
  console.error('❌ أخطاء بالمتصفح:\n' + fatal.join('\n'));
  process.exit(1);
}
if (wk.strikers < 1 || !wk.back || !built || !trade.got || trade.sheep < 2) {
  console.error('❌ العمال/التجارة ما اشتغلت', { wk, built, trade });
  process.exit(1);
}
if (camelsCount < 2 || trough < 1 || !born.rare || sold < 1) {
  console.error('❌ النياق/السوق ما اشتغلت', { camelsCount, trough, born, sold });
  process.exit(1);
}
if (loaded < saved || questIdx < 5 || killed < 1) {
  console.error('❌ التقدم ما مشى زي المتوقع', { saved, loaded, questIdx, killed });
  process.exit(1);
}
console.log('✅ اختبار الدخان نجح');
