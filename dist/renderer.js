import { renderCard } from './card-renderer.js';
import { renderExpanded } from './expanded-renderer.js';
import { renderStory } from './story-renderer.js';
import { paletteFor } from './schemes.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const out = (x) => 1 - Math.pow(1 - clamp(x), 3);
const back = (x) => {
  x = clamp(x) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};
const font = '"PingFang SC","Microsoft YaHei",sans-serif';
// Every frame depends only on progress + settings. CSS checkerboard is never drawn here.
export function renderFrame(canvas, e, s, p) {
  if (e.engine === 'story') {
    renderStory(canvas, e, s, p);
    return;
  }
  if (e.engine === 'expanded') {
    renderExpanded(canvas, e, s, p);
    return;
  }
  if (e.kind) {
    renderCard(canvas, e, s, p);
    return;
  }
  const c = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  p = e.category === 'transition' ? clamp(p) : Math.pow(clamp(p), 1.35 - s.intensity / 140);
  c.save();
  const enter = out(p / 0.23),
    exit = 1 - out((p - 0.82) / 0.18),
    strength = 0.4 + s.intensity / 100;
  c.globalAlpha = exit;
  const color = paletteFor(s).accent,
    white = '#f5f7f0',
    ink = '#18201b';
  const box = (x, y, bw, bh, r = 12, fill = color) => {
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, bw, bh, r);
    c.fill();
  };
  const line = (x1, y1, x2, y2, stroke = color, width = 3) => {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const text = (str, x, y, size = 48, fill = white, max = 640, weight = 650) => {
    c.fillStyle = fill;
    c.font = `${weight} ${size}px ${font}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const measured = c.measureText(str).width;
    if (measured > max) c.font = `${weight} ${(size * max) / measured}px ${font}`;
    c.fillText(str, x, y);
  };
  const sub = (y = 60) => text(s.subtitle, 0, y, 17, white, 620, 450);
  const circle = (x, y, r, stroke = color, lw = 4, start = 0, end = 2 * Math.PI) => {
    c.beginPath();
    c.arc(x, y, Math.max(0.01, r), start, end);
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  };
  const imageAt = (x, y, size = 88) => {
    if (!s.image) return false;
    const im = s.image;
    const k = Math.min(size / im.width, size / im.height);
    c.drawImage(im, x - (im.width * k) / 2, y - (im.height * k) / 2, im.width * k, im.height * k);
    return true;
  };
  if (e.category === 'transition') {
    c.globalAlpha = 1;
    c.fillStyle = color;
    if (p >= 0.46 && p <= 0.54) {
      c.fillRect(0, 0, w, h);
      c.restore();
      return;
    }
    // Each transition begins and ends transparent and is opaque in the middle.
    const coverage = p < 0.5 ? out(p / 0.5) : 1 - out((p - 0.5) / 0.5);
    if (e.id === 'diagonal') {
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(-0.2);
      c.fillRect(-w * 1.2, -h * 1.2, w * 2.4 * coverage, h * 2.4);
      c.restore();
    }
    if (e.id === 'shutters')
      for (let i = 0; i < 7; i++) {
        const q = p < 0.5 ? out((p - i * 0.018) / 0.34) : 1 - out((p - 0.5 - i * 0.018) / 0.34);
        c.fillStyle = i % 2 ? white : color;
        c.fillRect((i * w) / 7, 0, w / 7 + 1, h * q);
      }
    if (e.id === 'circlewipe') {
      c.beginPath();
      c.arc(w / 2, h / 2, Math.hypot(w, h) * 0.51 * coverage, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    return;
  }
  const factor = Math.min(w / 860, h / 480) * (s.scale / 100);
  const py = s.position === 'top' ? 0.26 : s.position === 'bottom' ? 0.74 : 0.5;
  c.translate(w / 2, h * py);
  c.scale(factor, factor);
  if (e.id === 'elastic') {
    c.save();
    const z = back(p / 0.24);
    c.translate(0, (1 - enter) * 65 * strength);
    c.scale(Math.max(0.01, z), Math.max(0.01, z));
    text(s.title, 0, -8, 58, color);
    sub(52);
    c.restore();
    line(-95, 85, -95 + 190 * enter, 85, color, 3);
  }
  if (e.id === 'wipe') {
    line(-330, -70, -330 + 660 * enter, -70, color, 4);
    c.save();
    c.beginPath();
    c.rect(-340, -65, 680, 145 * enter);
    c.clip();
    text(s.title, 0, -10 + (1 - enter) * 40, 52);
    sub(55);
    c.restore();
  }
  if (e.id === 'typewriter') {
    const n = Math.floor(out(p / 0.5) * [...s.title].length);
    text(
      [...s.title].slice(0, n) + (p < 0.62 && Math.floor(p * 25) % 2 === 0 ? '▏' : ''),
      0,
      -6,
      48,
      color,
    );
    c.save();
    c.globalAlpha *= out((p - 0.25) / 0.2);
    sub();
    c.restore();
  }
  if (e.id === 'lowerthird') {
    c.translate((1 - enter) * -160, 25);
    c.globalAlpha *= enter;
    box(-320, -65, 640, 140, 8, '#1b222de8');
    box(-320, -65, 8, 140, 2);
    text(s.title, -15, -16, 38, white, 560);
    text(s.subtitle, -15, 34, 19, color, 560, 400);
  }
  if (e.id === 'chapter') {
    c.translate(0, (1 - enter) * 70);
    c.globalAlpha *= enter;
    box(-58, -111, 116, 35, 18);
    text('CHAPTER', 0, -92, 14, ink, 100);
    text(s.title, 0, -14, 47);
    line(-180, 36, 180 * enter, 36, color, 2);
    sub(73);
  }
  if (e.id === 'location') {
    c.globalAlpha *= enter;
    c.translate(0, -(1 - enter) * 75);
    circle(-265, -2, 19, color, 6);
    line(-278, 12, -265, 34, color, 5);
    line(-252, 12, -265, 34, color, 5);
    box(-210, -43, 480, 88, 44, '#1d2630eb');
    text(s.title, 25, 0, 37, color, 440);
    sub(87);
  }
  if (e.id === 'underline') {
    text(s.title, 0, -5, 54);
    c.save();
    c.globalAlpha *= 0.55;
    box(-320, 14, 640 * enter, 24, 3);
    c.restore();
    sub(79);
  }
  if (e.id === 'callout') {
    const q = out((p - 0.12) / 0.28);
    c.globalAlpha *= enter;
    circle(-220, 65, 12, color, 3);
    line(-206, 58, -130, -37, color, 4);
    line(-130, -37, -130 + 380 * q, -37, color, 3);
    text(s.title, 40, -78, 40, color, 420);
    text(s.subtitle, 40, 8, 17, white, 440, 400);
    line(-206, 58, -200, 36, color, 4);
    line(-206, 58, -182, 55, color, 4);
  }
  if (e.id === 'circle') {
    text(s.title, 0, -4, 50);
    c.save();
    c.scale(2.5, 1);
    circle(0, 0, 115, color, 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * enter);
    c.restore();
    sub(153);
  }
  if (e.id === 'counter') {
    const num = Number(s.title) || 0;
    const value = num * out(p / 0.65);
    text(
      Number.isInteger(num) ? Math.round(value).toLocaleString('en-US') : value.toFixed(1),
      0,
      -18,
      112,
      color,
    );
    sub(75);
    line(-85, 112, 85 * enter, 112, color, 3);
  }
  if (e.id === 'progress') {
    circle(-170, 0, 104, '#52605c66', 14);
    circle(
      -170,
      0,
      104,
      color,
      14,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * clamp((+s.title || 0) / 100) * out(p / 0.65),
    );
    text(Math.round((+s.title || 0) * out(p / 0.65)) + '%', -170, 0, 50, color, 180);
    text(s.subtitle, 115, -10, 30, white, 320);
    text('PROGRESS', 115, 36, 15, color, 320, 400);
  }
  if (e.id === 'bars') {
    const values = s.title.split(/[,，]/).slice(0, 6).map(Number);
    const max = Math.max(1, ...values.filter(Number.isFinite));
    const span = 500 / Math.max(2, values.length);
    values.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      const hh = ((180 * v) / max) * out((p - i * 0.035) / 0.45);
      box(-250 + i * span, 85 - hh, span * 0.62, Math.max(1, hh), 5, i % 2 ? white : color);
      text(
        Math.round(v * out(p / 0.55)).toString(),
        -250 + i * span + span * 0.31,
        60 - hh,
        20,
        color,
        span * 0.8,
      );
    });
    line(-280, 90, 280, 90, '#81958b88', 1);
    sub(132);
  }
  if (e.id === 'orbit') {
    c.globalAlpha *= enter;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(p * Math.PI * strength + (i * Math.PI) / 3);
      c.scale(1, 0.4);
      circle(0, 0, 150, color, 2);
      c.restore();
    }
    if (!imageAt(0, -6, 90)) text(s.title, 0, -5, 45, white, 260);
    sub(165);
  }
  if (e.id === 'logoreveal') {
    c.save();
    c.beginPath();
    c.arc(0, 0, 220 * enter, 0, Math.PI * 2);
    c.clip();
    if (!imageAt(0, -20, 120)) text(s.title, 0, -18, 70, color);
    sub(77);
    c.restore();
    line(-80, 115, -80 + 160 * enter, 115, color, 3);
  }
  if (e.id === 'stamp') {
    c.save();
    const z = 1 + (1 - enter) * 2;
    c.scale(z, z);
    c.rotate((1 - enter) * -0.3);
    c.globalAlpha *= enter;
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.strokeRect(-165, -100, 330, 182);
    if (!imageAt(0, -35, 80)) text(s.title, 0, -40, 68, color, 290);
    text(s.subtitle, 0, 32, 15, color, 290, 550);
    c.restore();
  }
  if (e.id === 'particles') {
    for (let i = 0; i < 28; i++) {
      const a = i * 2.399 + p * 1.3 * strength;
      const r = (90 + (i % 5) * 26) * enter;
      const x = Math.cos(a) * r * 1.5,
        y = Math.sin(a) * r;
      const alpha = c.globalAlpha;
      c.globalAlpha *= 0.25 + (Math.sin(p * 20 + i) + 1) * 0.35;
      box(x, y, 2 + (i % 4), 2 + (i % 4), 2, i % 3 === 0 ? white : color);
      c.globalAlpha = alpha;
    }
    text(s.title, 0, -12, 50, color);
    sub(47);
  }
  if (e.id === 'rings') {
    for (let i = 0; i < 3; i++) {
      const phase = (p * 1.6 + i / 3) % 1;
      c.save();
      c.globalAlpha *= 1 - phase;
      circle(0, 0, 30 + phase * 200, color, 3);
      c.restore();
    }
    c.globalAlpha *= enter;
    text(s.title, 0, -10, 46);
    sub(50);
  }
  if (e.id === 'confetti') {
    for (let i = 0; i < 38; i++) {
      const q = clamp((p - (i % 4) * 0.018) / 0.78),
        a = i * 2.399;
      const x = Math.cos(a) * (130 + (i % 7) * 22) * out(q) * strength,
        y = -220 * Math.sin(q * Math.PI) + q * 240 + ((i % 5) - 2) * 22;
      c.save();
      c.translate(x, y);
      c.rotate(i + p * 8);
      box(-4, -5, 6 + (i % 5), 12, 1, [color, white, '#b8a7ff', '#ffa788'][i % 4]);
      c.restore();
    }
    c.save();
    c.globalAlpha *= enter;
    text(s.title, 0, -25, 50, color);
    sub(44);
    c.restore();
  }
  if (e.id === 'message') {
    c.globalAlpha *= enter;
    c.translate(0, (1 - back(p / 0.25)) * 90);
    box(-285, -85, 570, 170, 25, '#eef5e9');
    text(s.title, 0, -21, 36, ink, 515);
    text(s.subtitle, 0, 39, 18, '#64725e', 510, 400);
    c.fillStyle = '#eef5e9';
    c.beginPath();
    c.moveTo(-230, 76);
    c.lineTo(-247, 110);
    c.lineTo(-188, 76);
    c.fill();
  }
  if (e.id === 'search') {
    c.globalAlpha *= enter;
    box(-320, -52, 640, 104, 52, '#eff6f5');
    circle(-264, -3, 16, ink, 4);
    line(-253, 10, -239, 23, ink, 4);
    text(
      [...s.title].slice(0, Math.ceil(s.title.length * out((p - 0.08) / 0.4))),
      20,
      0,
      35,
      ink,
      490,
    );
    sub(94);
  }
  if (e.id === 'follow') {
    c.globalAlpha *= enter;
    c.scale(Math.max(0.01, back(p / 0.24)), Math.max(0.01, back(p / 0.24)));
    box(-285, -71, 570, 142, 20, color);
    circle(-224, 0, 27, ink, 2);
    line(-237, 0, -211, 0, ink, 3);
    line(-224, -13, -224, 13, ink, 3);
    text(s.title, 33, -19, 34, ink, 430);
    text(s.subtitle, 33, 28, 18, ink, 430, 400);
  }
  // Optional image attachment on non-logo effects uses the same placement in preview/export.
  if (s.image && e.category !== 'logo') imageAt(0, -170, 64);
  c.restore();
}
