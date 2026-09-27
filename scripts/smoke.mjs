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
      await new Promise(r => setTimeout(r, 60));
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
    await new Promise(r => setTimeout(r, 50));
    g.doAction(g.findTarget(), true);
  }
});
await tick(500);
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
if (loaded < saved || questIdx < 5 || killed < 1) {
  console.error('❌ التقدم ما مشى زي المتوقع', { saved, loaded, questIdx, killed });
  process.exit(1);
}
console.log('✅ اختبار الدخان نجح');
