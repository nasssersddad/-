// الإقلاع وحلقة اللعب
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { Particles } from './engine/particles.js';
import { Minimap } from './minimap.js';
import { PerfMonitor } from './engine/perf.js';

function safeStorage() {
  try {
    const k = '__t';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  }
}

const $ = (id) => document.getElementById(id);
const audio = new Audio();
const ui = new UI(audio);
const input = new Input($('touch'), $('stick'), $('knob'));
input.bindActionButton($('actionBtn'));
const particles = new Particles();
const renderer = new Renderer($('world'), $('fx'), $('post'));
const game = new Game({ ui, audio, input, particles, storage: safeStorage() });
window.__game = game;
game.renderer = renderer;
// تجربة موسم من الرابط: ?season=ramadan | eid_fitr | eid_adha | winter
const seasonParam = new URLSearchParams(location.search).get('season');
if (seasonParam) game.seasonOverride = seasonParam;
const minimap = new Minimap($('minimap'));

// زر الرجوع بالأندرويد
window.__androidBack = () => ui.back();
// الكود الأصلي ينادي هذي قبل ما يتوقف التطبيق
window.__saveNow = () => game.save();
// وقبل ما يطلع: يجدول إشعارات (زرعك جاهز، البيض، المكافأة)
window.__scheduleNotifs = () => game.scheduleNotifs();
window.__onResume = () => { if (started) game.onResume(); };

window.addEventListener('resize', () => renderer.resize());
// وضع البناء: الضغط (بدون سحب) على الخريطة يودّي الشبح لمكان الإصبع
let tapStart = null;
$('touch').addEventListener('pointerdown', (e) => { if (game.placing || game.arranging) tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
$('touch').addEventListener('pointerup', (e) => {
  if (!(game.placing || game.arranging) || !tapStart) return;
  const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
  if (moved < 12 && performance.now() - tapStart.t < 400) {
    const [wx, wy] = renderer.screenToWorld(e.clientX, e.clientY);
    if (game.placing) game.placeGhostAt(wx, wy);
    else game.pickAt(wx, wy);
  }
  tapStart = null;
});
document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) { game.save(); game.scheduleNotifs(); audio.suspend(); }
  else { audio.resume(); game.onResume(); }
});
window.addEventListener('pagehide', () => game.save());

// ---------- حماية من الأخطاء ----------
// أي خطأ بإطار ما يجمّد اللعبة: نسجله ونحفظ ونكمّل. ولو تكرر واجد نطلع شاشة إعادة تشغيل
const ERR_KEY = 'almuzare_lasterror';
let errTimes = [];
let errNotified = false;
let crashed = false;
function reportError(err, where) {
  console.error(err);
  try { localStorage.setItem(ERR_KEY, JSON.stringify({ at: new Date().toISOString(), where, msg: String((err && (err.stack || err.message)) || err).slice(0, 2000) })); } catch { /* ما يهم */ }
  const t = performance.now();
  errTimes = errTimes.filter(x => t - x < 10000);
  errTimes.push(t);
  try { game.save(); } catch { /* ما يهم */ }
  if (!errNotified) { errNotified = true; try { ui.toast('صار خطأ صغير، وكمّلنا اللعب 👍', '', 3); } catch { /* ما يهم */ } }
  if (errTimes.length > 30 && !crashed) { crashed = true; try { ui.crashScreen(); } catch { /* ما يهم */ } }
}
window.addEventListener('error', (e) => reportError(e.error || e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
window.__reportError = reportError;

// ---------- الحلقة ----------
const perf = new PerfMonitor();
game.perf = perf;
let last = performance.now();
let started = false;
function frame(now) {
  requestAnimationFrame(frame);
  // توفير البطارية: نرسم 30 مرة بالثانية بالكثير
  if (started && game.state && game.state.settings.fps30 && now - last < 32) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!started || crashed) return;
  try {
    game.update(dt);
    renderer.draw(game);
    ui.hud();
    minimap.update(game, dt);
  } catch (err) { reportError(err, 'frame'); }
  // الجوال بطيء؟ نخفف الرسم تلقائياً مرة وحدة
  const fps = perf.frame(now, !document.hidden && !ui.blocking());
  if (fps != null && perf.shouldLower()) game.autoLite();
}

function startGame() {
  if (started) return;
  audio.unlock();
  $('boot').remove();
  started = true;
  game.start();
  if (game.state.settings.lite) { renderer.lite = true; renderer.resize(); }
}

$('startBtn').addEventListener('click', startGame);
$('startBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
if (new URLSearchParams(location.search).has('autostart')) startGame();
requestAnimationFrame(frame);
