// جسيمات بسيطة (غبار، شرار، قصاصات) + نصوص طايرة
export class Particles {
  constructor() {
    this.list = [];
    this.texts = [];
  }

  burst(x, y, color, n = 8, speed = 60, life = 0.6, gravity = 120, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.5, life, max: life, color: Array.isArray(color) ? color[i % color.length] : color, g: gravity, size });
    }
  }

  confetti(x, y) {
    this.burst(x, y, ['#ffd24a', '#ff6a3a', '#6cc24a', '#4aa3d8', '#f0e6d0', '#d04ad0'], 40, 140, 1.4, 160, 2);
  }

  float(x, y, text, color = '#fff', size = 14) {
    this.texts.push({ x, y, text, color, size, life: 1.3, max: 1.3 });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= 0.98;
    }
    this.list = this.list.filter(p => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 22 * dt;
    }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  draw(ctx, camX, camY) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // النصوص تنرسم على الطبقة عالية الدقة
  drawTexts(ctx, camX, camY, scale, dpr = 1) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 2.5);
      const pop = 1 + Math.max(0, (t.life - t.max + 0.15)) * 3;
      ctx.globalAlpha = a;
      ctx.font = `700 ${Math.round(t.size * pop * dpr)}px Cairo, sans-serif`;
      const x = (t.x - camX) * scale, y = (t.y - camY) * scale;
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = 'rgba(30,15,5,0.85)';
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
