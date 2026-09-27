// الإقلاع وحلقة اللعب
import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { Particles } from './engine/particles.js';
import { Minimap } from './minimap.js';

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
const minimap = new Minimap($('minimap'));

// زر الرجوع بالأندرويد
window.__androidBack = () => ui.back();
// الكود الأصلي ينادي هذي قبل ما يتوقف التطبيق
window.__saveNow = () => game.save();

window.addEventListener('resize', () => renderer.resize());
// وضع البناء: الضغط (بدون سحب) على الخريطة يودّي الشبح لمكان الإصبع
let tapStart = null;
$('touch').addEventListener('pointerdown', (e) => { if (game.placing) tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
$('touch').addEventListener('pointerup', (e) => {
  if (!game.placing || !tapStart) return;
  const moved = Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y);
  if (moved < 12 && performance.now() - tapStart.t < 400) {
    const [wx, wy] = renderer.screenToWorld(e.clientX, e.clientY);
    game.placeGhostAt(wx, wy);
  }
  tapStart = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { game.save(); audio.suspend(); }
  else audio.resume();
});
window.addEventListener('pagehide', () => game.save());

let last = performance.now();
let started = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (started) {
    game.update(dt);
    renderer.draw(game);
    ui.hud();
    minimap.update(game, dt);
  }
  requestAnimationFrame(frame);
}

function startGame() {
  if (started) return;
  audio.unlock();
  $('boot').remove();
  started = true;
  game.start();
}

$('startBtn').addEventListener('click', startGame);
$('startBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
if (new URLSearchParams(location.search).has('autostart')) startGame();
requestAnimationFrame(frame);
