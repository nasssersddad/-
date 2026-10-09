// أيقونات تطير من مكان الفعل لعداداتها (الدراهم، الحقيبة، الخبرة) عشان اللاعب يحس إنه كسبها صدق
export class Flyer {
  constructor(layer) {
    this.layer = layer;
    this.live = 0;
  }

  // from: نقطة بالشاشة {x, y}، to: العنصر اللي تطير له
  fly(icon, from, toEl, { n = 1, delay = 0, onArrive = null, size = 22 } = {}) {
    if (!this.layer || !toEl || !toEl.getClientRects().length || !from) return 0;
    const lr = this.layer.getBoundingClientRect();
    const tr = toEl.getBoundingClientRect();
    const tx = tr.left + tr.width / 2 - lr.left, ty = tr.top + tr.height / 2 - lr.top;
    const count = Math.max(1, Math.min(n, 8, 30 - this.live));
    if (this.live >= 30) return 0;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'flyer';
      el.textContent = icon;
      el.style.fontSize = size + 'px';
      const sx = from.x - lr.left + (Math.random() - 0.5) * 28, sy = from.y - lr.top + (Math.random() - 0.5) * 18;
      el.style.left = sx + 'px';
      el.style.top = sy + 'px';
      this.layer.appendChild(el);
      this.live++;
      const pop = { x: (Math.random() - 0.5) * 50, y: -24 - Math.random() * 26 };
      const anim = el.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: `translate(-50%,-50%) translate(${pop.x}px, ${pop.y}px) scale(1.25)`, opacity: 1, offset: 0.25 },
        { transform: `translate(-50%,-50%) translate(${tx - sx}px, ${ty - sy}px) scale(.65)`, opacity: 0.95 },
      ], { duration: 620 + Math.random() * 160, delay: delay + i * 70, easing: 'cubic-bezier(.45,0,.75,.55)', fill: 'forwards' });
      const done = () => {
        if (!el.isConnected) return;
        el.remove();
        this.live--;
        toEl.classList.remove('bump'); void toEl.offsetWidth; toEl.classList.add('bump');
        if (onArrive) onArrive(i, count);
      };
      anim.onfinish = done;
      setTimeout(done, delay + i * 70 + 1200); // احتياط لو الأنيميشن ما خلص (تبويب مخفي)
    }
    return count;
  }
}
