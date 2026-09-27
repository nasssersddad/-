// الإسقاط الإيزومتريك: العالم (x,y) ← الشاشة. كل مربع 16×16 يصير معيّن 32×16
export function isoX(x, y, ox) { return x - y + ox; }
export function isoY(x, y) { return (x + y) / 2; }
export function proj(x, y, ox) { return { x: x - y + ox, y: (x + y) / 2 }; }
// من الشاشة للعالم (بدون ارتفاع)
export function unproj(sx, sy, ox) {
  const a = sx - ox;
  return { x: sy + a / 2, y: sy - a / 2 };
}
// اتجاه على الشاشة ← اتجاه بالعالم
export function screenToWorldDir(dx, dy) {
  return { x: dy + dx / 2, y: dy - dx / 2 };
}
// عمق الرسم
export function depth(x, y) { return x + y; }
