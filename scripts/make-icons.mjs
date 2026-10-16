// يولّد أيقونة التطبيق (pixel-art) بكل المقاسات عن طريق Chromium
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const res = path.resolve('android/app/src/main/res');
const sizes = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 };
const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage();

const draw = async (size, round, square = false, adaptive = false) => page.evaluate(({ size, round, square, adaptive }) => {
  const S = 48;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  // سماء الغروب
  const bands = ['#2a1340', '#4a1f45', '#7a2a40', '#b8452e', '#e0702a', '#f4a03a', '#fcc860'];
  bands.forEach((col, i) => R(0, i * 5, S, 5, col));
  R(0, 35, S, 13, '#e4bb76');
  // الشمس
  x.fillStyle = '#ffe28a';
  for (let yy = -7; yy <= 7; yy++) { const w = Math.round(Math.sqrt(49 - yy * yy)); x.fillRect(30 - w, 28 + yy, w * 2, 1); }
  // كثبان
  x.fillStyle = '#d09a55';
  for (let i = 0; i < S; i++) { const h = Math.round(3 + Math.sin(i / 7) * 2); x.fillRect(i, 35 - h, 1, h); }
  x.fillStyle = '#c28a48';
  R(0, 40, S, 1, '#c99a55');
  // الخان
  R(24, 26, 20, 10, '#b07e4c'); R(24, 25, 20, 2, '#d4a46b');
  for (let i = 24; i < 44; i += 3) R(i, 23, 2, 2, '#d4a46b');
  R(31, 29, 6, 7, '#3a2418'); R(32, 28, 4, 1, '#3a2418');
  R(34, 17, 3, 9, '#c79a66'); R(33, 16, 5, 2, '#d4a46b'); R(35, 14, 1, 2, '#ffe28a');
  // النخلة
  const trunk = '#5e3a1f';
  for (let yy = 16; yy < 42; yy++) { const xx = 12 + Math.round(Math.pow((42 - yy) / 26, 2) * 3); R(xx, yy, 3, 1, yy % 3 ? trunk : '#8a5a33'); }
  const leaf = ['#3f7a25', '#4f8a2f', '#6fae3a'];
  const fr = [[-9, 3], [-7, -4], [-2, -7], [4, -6], [9, -2], [10, 4], [-5, 6], [5, 6]];
  fr.forEach(([dx, dy], i) => {
    for (let t = 0; t <= 10; t++) {
      const k = t / 10;
      const px = 15 + dx * k, py = 16 + dy * k - Math.sin(k * Math.PI) * 3 + Math.abs(dx) * k * k * 0.4;
      R(Math.round(px), Math.round(py), 2, 1, leaf[i % 3]);
    }
  });
  R(13, 17, 2, 2, '#a8521e'); R(16, 17, 2, 2, '#a8521e');
  // جمل صغير
  R(3, 37, 7, 3, '#8a5a33'); R(5, 36, 3, 1, '#8a5a33'); R(9, 34, 1, 3, '#8a5a33'); R(9, 33, 3, 1, '#8a5a33');
  R(3, 40, 1, 3, '#6e4424'); R(8, 40, 1, 3, '#6e4424');

  const o = document.createElement('canvas');
  o.width = size; o.height = size;
  const ox = o.getContext('2d');
  ox.imageSmoothingEnabled = false;
  if (adaptive) {
    // أيقونة adaptive (أندرويد 8+): 108dp والظاهر منها 72dp بالنص، فنحط الرسمة بالنص ونمد أطرافها للحواف
    const k = (size * 72 / 108) / S, off = Math.round((size - S * k) / 2), w = Math.round(S * k);
    ox.drawImage(c, 0, 0, S, S, off, off, w, w);
    ox.drawImage(c, 0, 0, 1, S, 0, off, off, w);                 // يسار
    ox.drawImage(c, S - 1, 0, 1, S, off + w, off, size - off - w, w); // يمين
    ox.drawImage(o, 0, off, size, 1, 0, 0, size, off);           // فوق
    ox.drawImage(o, 0, off + w - 1, size, 1, 0, off + w, size, size - off - w); // تحت
    return o.toDataURL('image/png').split(',')[1];
  }
  if (square) { /* أيقونة Google Play: مربع كامل، والمتجر يدوّر الزوايا بنفسه */ }
  else if (round) { ox.beginPath(); ox.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ox.clip(); }
  else { const r = size * 0.18; ox.beginPath(); ox.roundRect(0, 0, size, size, r); ox.clip(); }
  ox.drawImage(c, 0, 0, size, size);
  return o.toDataURL('image/png').split(',')[1];
}, { size, round, square, adaptive });

for (const [dir, size] of Object.entries(sizes)) {
  fs.mkdirSync(path.join(res, dir), { recursive: true });
  // خلفية الأيقونة adaptive بمقاس 108dp لكل كثافة (2.25 × مقاس الأيقونة العادية 48dp)
  fs.writeFileSync(path.join(res, dir, 'ic_launcher_background.png'), Buffer.from(await draw(Math.round(size * 2.25), false, false, true), 'base64'));
  fs.writeFileSync(path.join(res, dir, 'ic_launcher.png'), Buffer.from(await draw(size, false), 'base64'));
  fs.writeFileSync(path.join(res, dir, 'ic_launcher_round.png'), Buffer.from(await draw(size, true), 'base64'));
}
fs.mkdirSync('store', { recursive: true });
fs.writeFileSync('store/icon-512.png', Buffer.from(await draw(512, false, true), 'base64'));
// ملفات adaptive: الخلفية هي الرسمة، والواجهة شفافة
const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@android:color/transparent" />
</adaptive-icon>
`;
fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), xml);
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), xml);
await browser.close();
console.log('✅ icons written');
