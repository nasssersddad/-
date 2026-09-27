// التحكم: عصا افتراضية باللمس (يسار الشاشة) + زر فعل + كيبورد للتجربة
export class Input {
  constructor(root, stickEl, knobEl) {
    this.root = root;
    this.stickEl = stickEl;
    this.knobEl = knobEl;
    this.vx = 0;
    this.vy = 0;
    this.keys = new Set();
    this.action = false;       // الزر مضغوط الحين
    this.actionPressed = false; // انضغط بهالإطار
    this.stickId = null;
    this.origin = null;
    this.enabled = true;
    this.radius = 46;

    root.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT')) return;
      this.keys.add(e.code);
      if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) this.pressAction();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') this.action = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.action = false; this.release(); });
  }

  bindActionButton(btn) {
    const down = (e) => { e.preventDefault(); e.stopPropagation(); this.pressAction(); btn.classList.add('pressed'); };
    const up = (e) => { e.preventDefault(); this.action = false; btn.classList.remove('pressed'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  }

  pressAction() {
    if (!this.enabled) return;
    this.action = true;
    this.actionPressed = true;
  }

  onDown(e) {
    if (!this.enabled || this.stickId !== null) return;
    if (e.clientX > window.innerWidth * 0.55) return;
    this.stickId = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.stickEl.style.left = e.clientX + 'px';
    this.stickEl.style.top = e.clientY + 'px';
    this.stickEl.classList.add('active');
    this.knobEl.style.transform = 'translate(-50%, -50%)';
  }

  onMove(e) {
    if (e.pointerId !== this.stickId) return;
    let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) { dx = (dx / d) * this.radius; dy = (dy / d) * this.radius; }
    this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const m = Math.min(1, d / this.radius);
    if (m < 0.15) { this.vx = 0; this.vy = 0; return; }
    this.vx = (dx / this.radius);
    this.vy = (dy / this.radius);
  }

  onUp(e) {
    if (e.pointerId !== this.stickId) return;
    this.release();
  }

  release() {
    this.stickId = null;
    this.vx = 0;
    this.vy = 0;
    this.stickEl.classList.remove('active');
  }

  // اتجاه الحركة النهائي
  move() {
    let x = this.vx, y = this.vy;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    const d = Math.hypot(x, y);
    if (d > 1) { x /= d; y /= d; }
    if (!this.enabled) return { x: 0, y: 0 };
    return { x, y };
  }

  endFrame() {
    this.actionPressed = false;
  }
}
