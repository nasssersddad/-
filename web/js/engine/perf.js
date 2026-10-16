// يقيس سرعة اللعبة (إطارات بالثانية) عشان نخفف الرسم تلقائياً على الجوالات البطيئة
export const LOW_FPS = 24;       // تحت هذا تعتبر اللعبة ثقيلة
export const WINDOW_MS = 3000;   // نحسب المتوسط كل 3 ثواني
export const LOW_STREAK = 2;     // لازم يتكرر مرتين ورا بعض قبل لا نخفف

export class PerfMonitor {
  constructor() {
    this.fps = 0;
    this.low = 0;
    this.t0 = null;
    this.frames = 0;
  }

  // active = اللعب شغال (مو مخفي ولا فيه نافذة). يرجع المتوسط لما تخلص نافذة القياس
  frame(now, active) {
    if (!active) { this.t0 = null; this.frames = 0; return null; }
    if (this.t0 == null) { this.t0 = now; this.frames = 0; return null; }
    this.frames++;
    const el = now - this.t0;
    if (el < WINDOW_MS) return null;
    this.fps = (this.frames * 1000) / el;
    this.t0 = now;
    this.frames = 0;
    this.low = this.fps < LOW_FPS ? this.low + 1 : 0;
    return this.fps;
  }

  shouldLower() {
    return this.low >= LOW_STREAK;
  }
}
