// المعالجة النهائية بـ WebGL: تكبير بكسل ناعم الحواف، توهج (Bloom)، تلوين حسب الوقت،
// وهج حرارة الظهر، فيجنيت، وحبيبات خفيفة. إذا WebGL ما يشتغل نرجع للرسم العادي.
const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// ياخذ البكسلات الساطعة بس
const BRIGHT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float k = smoothstep(uThreshold, uThreshold + 0.25, l);
  // الألوان الدافية (نار، ذهب) تتوهج أكثر
  float warm = clamp((c.r - c.b) * 1.5, 0.0, 1.0);
  gl_FragColor = vec4(c * k * (0.7 + warm * 0.6), 1.0);
}`;

// تمويه Gaussian باتجاه واحد
const BLUR = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * 0.227;
  c += texture2D(uTex, vUv + uDir * 1.385).rgb * 0.316;
  c += texture2D(uTex, vUv - uDir * 1.385).rgb * 0.316;
  c += texture2D(uTex, vUv + uDir * 3.231).rgb * 0.070;
  c += texture2D(uTex, vUv - uDir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}`;

const COMPOSITE = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uSrc;      // حجم رسم العالم بالبكسل
uniform vec2 uOut;      // حجم الشاشة
uniform float uTime;
uniform float uWarm;    // دفء الظهر
uniform float uDusk;    // الغروب
uniform float uNight;   // الليل
uniform float uHaze;    // وهج الحرارة
uniform float uDungeon;
uniform float uBloomAmt;
uniform float uRain;     // المطر: ألوان أبرد وأغمق

// تكبير البكسل: حاد بالنص وناعم بالحواف (بدون تموّج مع الحركة)
vec2 sharpUv(vec2 uv) {
  vec2 p = uv * uSrc;
  vec2 scale = uOut / uSrc;
  vec2 f = fract(p);
  vec2 edge = clamp((f - 0.5) * scale + 0.5, 0.0, 1.0);
  return (floor(p) + edge) / uSrc;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  // وهج الحرارة: موجة خفيفة تزيد تحت الشاشة
  float hz = uHaze * (0.6 + 0.4 * uv.y);
  uv.x += sin(uv.y * 90.0 + uTime * 3.0) * 0.0011 * hz;
  uv.y += cos(uv.x * 70.0 + uTime * 2.3) * 0.0006 * hz;

  vec3 col = texture2D(uScene, sharpUv(uv)).rgb;
  vec3 bloom = texture2D(uBloom, uv).rgb;
  col += bloom * uBloomAmt;

  // تلوين حسب الوقت
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 warmGrade = col * vec3(1.06, 1.0, 0.9) + vec3(0.02, 0.01, 0.0);
  vec3 duskGrade = mix(col, col * vec3(1.18, 0.9, 0.75) + vec3(0.04, 0.0, 0.02), 0.8);
  // الليل: الظل أزرق بارد، والأماكن المنورة تحافظ على دفء الفوانيس
  vec3 nightCool = mix(vec3(l) * vec3(0.7, 0.82, 1.18), col * vec3(0.8, 0.92, 1.2), 0.5);
  vec3 nightGrade = mix(nightCool, col * vec3(1.08, 0.98, 0.85), smoothstep(0.25, 0.7, l));
  vec3 dungeonGrade = mix(vec3(l) * vec3(0.9, 1.0, 0.85), col, 0.6);
  vec3 g = mix(col, warmGrade, uWarm);
  g = mix(g, duskGrade, uDusk);
  g = mix(g, nightGrade, uNight);
  g = mix(g, dungeonGrade, uDungeon);
  // المطر: تشبع أقل وجو أزرق رمادي
  float rl = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(g, mix(vec3(rl), g, 0.65) * vec3(0.84, 0.9, 1.02), uRain);
  // تباين وتشبع خفيف
  g = (g - 0.5) * 1.06 + 0.5;
  float gl = dot(g, vec3(0.299, 0.587, 0.114));
  g = mix(vec3(gl), g, 1.12);

  // فيجنيت
  vec2 d = vUv - 0.5;
  float vig = 1.0 - dot(d, d) * (0.55 + uNight * 0.5 + uDungeon * 0.6);
  g *= clamp(vig, 0.0, 1.0);
  // حبيبات خفيفة
  g += (hash(vUv * uOut + uTime) - 0.5) * 0.018;
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

export class PostFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ok = false;
    try {
      const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) return;
      this.gl = gl;
      this.progBright = this.program(BRIGHT);
      this.progBlur = this.program(BLUR);
      this.progComp = this.program(COMPOSITE);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      this.scene = this.texture();
      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
  }

  program(frag) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {};
    return p;
  }

  u(p, name) {
    if (!(name in p.u)) p.u[name] = this.gl.getUniformLocation(p, name);
    return p.u[name];
  }

  texture() {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  target(w, h) {
    const gl = this.gl;
    const tex = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }

  resize(outW, outH, srcW, srcH) {
    if (!this.ok) return;
    this.canvas.width = outW;
    this.canvas.height = outH;
    const bw = Math.max(8, Math.ceil(srcW / 2)), bh = Math.max(8, Math.ceil(srcH / 2));
    if (!this.a || this.a.w !== bw || this.a.h !== bh) {
      this.a = this.target(bw, bh);
      this.b = this.target(bw, bh);
    }
    this.srcW = srcW;
    this.srcH = srcH;
  }

  pass(prog, fb, w, h, bind) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    bind();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // params: { time, warm, dusk, night, haze, dungeon, bloom }
  render(source, params) {
    if (!this.ok) return false;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const { a, b } = this;
    // ساطع ← A
    this.pass(this.progBright, a.fb, a.w, a.h, () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scene);
      gl.uniform1i(this.u(this.progBright, 'uTex'), 0);
      gl.uniform1f(this.u(this.progBright, 'uThreshold'), params.night > 0.5 || params.dungeon > 0.5 ? 0.6 : 0.74);
    });
    // تمويه A ← B ← A (مرتين)
    for (let i = 0; i < 2; i++) {
      this.pass(this.progBlur, b.fb, b.w, b.h, () => {
        gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.uniform1i(this.u(this.progBlur, 'uTex'), 0);
        gl.uniform2f(this.u(this.progBlur, 'uDir'), (1 + i) / a.w, 0);
      });
      this.pass(this.progBlur, a.fb, a.w, a.h, () => {
        gl.bindTexture(gl.TEXTURE_2D, b.tex);
        gl.uniform1i(this.u(this.progBlur, 'uTex'), 0);
        gl.uniform2f(this.u(this.progBlur, 'uDir'), 0, (1 + i) / a.h);
      });
    }
    // التركيب النهائي
    const p = this.progComp;
    this.pass(p, null, this.canvas.width, this.canvas.height, () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.scene);
      gl.uniform1i(this.u(p, 'uScene'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform1i(this.u(p, 'uBloom'), 1);
      gl.uniform2f(this.u(p, 'uSrc'), this.srcW, this.srcH);
      gl.uniform2f(this.u(p, 'uOut'), this.canvas.width, this.canvas.height);
      gl.uniform1f(this.u(p, 'uTime'), params.time);
      gl.uniform1f(this.u(p, 'uWarm'), params.warm);
      gl.uniform1f(this.u(p, 'uDusk'), params.dusk);
      gl.uniform1f(this.u(p, 'uNight'), params.night);
      gl.uniform1f(this.u(p, 'uHaze'), params.haze);
      gl.uniform1f(this.u(p, 'uDungeon'), params.dungeon);
      gl.uniform1f(this.u(p, 'uBloomAmt'), params.bloom);
      gl.uniform1f(this.u(p, 'uRain'), params.rain || 0);
      gl.activeTexture(gl.TEXTURE0);
    });
    return true;
  }
}
