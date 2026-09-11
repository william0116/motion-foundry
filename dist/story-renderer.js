import { paletteFor } from './schemes.js';
import { parseSeries } from './expanded-effects.js';
const FONT = '"PingFang SC","Microsoft YaHei",sans-serif',
  TAU = Math.PI * 2;
const clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => 1 - (1 - clamp(x)) ** 3;
const rows = (s) =>
  String(s || '')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

// Slice-and-dice keeps rectangle areas proportional. Small labels move to a legend.
export function splitTiles(values, x, y, w, h) {
  if (!values.length) return [];
  if (values.length === 1) return [{ ...values[0], x, y, w, h }];
  const sum = values.reduce((n, v) => n + v.value, 0),
    first = values[0],
    f = sum ? first.value / sum : 0;
  if (w >= h)
    return [
      { ...first, x, y, w: w * f, h },
      ...splitTiles(values.slice(1), x + w * f, y, w * (1 - f), h),
    ];
  return [
    { ...first, x, y, w, h: h * f },
    ...splitTiles(values.slice(1), x, y + h * f, w, h * (1 - f)),
  ];
}

export function renderStory(canvas, e, s, progress) {
  const c = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (progress <= 0 || progress >= 1) return;
  const p = clamp(progress),
    speed = 0.85 + s.intensity / 170,
    enter = ease((p * speed) / 0.16),
    exit = 1 - ease((p - 0.9) / 0.1),
    a = paletteFor(s);
  const fg = a.foreground,
    ink = a.accent,
    body = rows(s.body),
    series = parseSeries(s.body).filter(Boolean);
  const rect = (x, y, bw, bh, fill = a.surface, r = 12) => {
    if (bw <= 0 || bh <= 0) return;
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, bw, bh, Math.min(r, bw / 2, bh / 2));
    c.fill();
  };
  const line = (x, y, xx, yy, color = ink, lw = 2) => {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.stroke();
  };
  const circle = (x, y, r, fill) => {
    if (r <= 0) return;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    } else {
      c.strokeStyle = ink;
      c.lineWidth = 3;
      c.stroke();
    }
  };
  const fade = (alpha, fn) => {
    c.save();
    c.globalAlpha *= clamp(alpha);
    fn();
    c.restore();
  };
  const clip = (x, y, bw, bh, fn) => {
    c.save();
    c.beginPath();
    c.rect(x, y, bw, bh);
    c.clip();
    fn();
    c.restore();
  };
  const text = (
    str,
    x,
    y,
    size = 32,
    color = fg,
    maxW = 460,
    maxH = 100,
    align = 'left',
    weight = 650,
  ) => {
    let rr = [],
      fs = size;
    do {
      c.font = `${weight} ${fs}px ${FONT}`;
      rr = [];
      for (const para of String(str || '').split('\n')) {
        let row = '';
        for (const ch of [...para]) {
          if (row && c.measureText(row + ch).width > maxW) {
            rr.push(row);
            row = ch;
          } else row += ch;
        }
        rr.push(row);
      }
      if (rr.length * fs * 1.35 <= maxH || fs <= 9) break;
      fs--;
    } while (fs > 0);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'middle';
    rr.forEach((r, i) => c.fillText(r, x, y + (i - (rr.length - 1) / 2) * fs * 1.35));
  };
  const image = (x, y, bw, bh, { empty = true, contain = false } = {}) => {
    if (!s.image) {
      if (empty) {
        rect(x, y, bw, bh, a.tint, 0);
        text('添加你的图片', x + bw / 2, y + bh / 2, 24, a.muted, bw - 20, bh - 20, 'center');
      }
      return;
    }
    clip(x, y, bw, bh, () => {
      const k = (contain ? Math.min : Math.max)(bw / s.image.width, bh / s.image.height);
      c.drawImage(
        s.image,
        x + (bw - s.image.width * k) / 2,
        y + (bh - s.image.height * k) / 2,
        s.image.width * k,
        s.image.height * k,
      );
    });
  };
  const label = (str, x, y) => text(str, x, y, 18, a.muted, 460, 46, 'left', 500);
  const delayed = (i, fn) => fade(ease((p * speed - 0.08 - i * 0.065) / 0.2), fn);
  const arrow = (x, y, xx, yy, t) => {
    const ax = x + (xx - x) * clamp(t),
      ay = y + (yy - y) * clamp(t),
      ang = Math.atan2(yy - y, xx - x);
    line(x, y, ax, ay);
    if (t > 0.05) {
      line(ax, ay, ax - 10 * Math.cos(ang - 0.5), ay - 10 * Math.sin(ang - 0.5));
      line(ax, ay, ax - 10 * Math.cos(ang + 0.5), ay - 10 * Math.sin(ang + 0.5));
    }
  };
  const panel = () => {
    rect(-278, -424, 556, 848);
    label('FIELD NOTES  /  01', -238, -378);
    line(-238, -342, 238, -342, a.border, 1);
    text(s.title, -238, -278, 42, fg, 476, 116);
    text(s.subtitle, 0, 365, 18, a.muted, 472, 72, 'center', 450);
  };
  const dotGrid = (x, y, bw, bh) => {
    for (let iy = 0; iy < bh; iy += 20)
      for (let ix = 0; ix < bw; ix += 20)
        fade(0.1 + 0.15 * (0.5 + 0.5 * Math.sin(ix * 0.02 + iy * 0.015 + p * TAU)), () =>
          circle(x + ix, y + iy, 1.5, ink),
        );
  };
  const ring = (x, y, r) => {
    fade(0.14, () => {
      c.strokeStyle = ink;
      c.lineWidth = 13;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.stroke();
    });
    circle(x, y, r);
  };
  const k = (Math.min(w / 660, h / 1040) * s.scale) / 100,
    scale = Math.min(k, w / 635, h / 990),
    half = 470 * scale;
  const py = s.position === 'top' ? 0.28 : s.position === 'bottom' ? 0.72 : 0.5,
    cy = Math.max(half + 3, Math.min(h - half - 3, h * py));
  c.save();
  c.translate(w / 2, cy + 22 * scale * (1 - enter));
  c.scale(scale, scale);
  c.globalAlpha = enter * exit;

  if (['evidence', 'translate', 'post'].includes(e.variant)) {
    c.rotate((1 - enter) * -0.045);
    panel();
    if (e.variant === 'evidence') {
      clip(-238, -186, 476, 449, () => {
        c.save();
        const z = 1 + ease((p - 0.18) / 0.4) * 0.1;
        c.translate(0, 50);
        c.scale(z, z);
        image(-238, -236, 476, 449);
        c.restore();
      });
      fade(0.84 * ease((p - 0.15) / 0.25), () => rect(-238, -186, 476, 449, a.surface, 0));
      delayed(1, () => {
        rect(-250, -53, 500, 158, a.tint, 8);
        rect(-250, -53, 7, 158, ink, 0);
        clip(-225, -38, 450 * ease((p - 0.21) / 0.38), 129, () =>
          text(s.body, -222, 25, 32, fg, 444, 125),
        );
      });
      label('重点摘录', -236, 300);
    } else if (e.variant === 'translate') {
      label('01  原文', -236, -167);
      text(body[0] || '', -236, -76, 32, fg, 472, 138, 'left', 450);
      line(-236, 26, 236, 26, a.border, 1);
      delayed(2, () => {
        rect(-250, 66, 500, 225, a.tint);
        label('02  译文 / 解释', -224, 105);
        text(body[1] || '', -224, 195, 34, fg, 448, 135);
      });
    } else {
      fade(0.35, () => {
        c.save();
        c.rotate(-0.045);
        rect(-257, -200, 514, 523, a.tint);
        c.restore();
      });
      image(-237, -181, 474, 276);
      delayed(2, () => {
        rect(-246, 105, 492, 172, a.tint, 8);
        text(s.body, -218, 188, 30, fg, 436, 140);
      });
      line(-215, 296, -215 + 430 * ease((p - 0.25) / 0.4), 296, ink, 3);
    }
  }
  if (e.variant === 'treemap') {
    panel();
    const vals = series.filter((v) => v.value > 0),
      tiles = splitTiles(vals, -236, -181, 472, 351),
      focus = Math.min(vals.length - 1, Math.floor(clamp((p - 0.4) / 0.46) * vals.length));
    tiles.forEach((v, i) =>
      delayed(i, () => {
        fade(p > 0.43 && i !== focus ? 0.28 : 1, () => {
          rect(
            v.x + 2,
            v.y + 2,
            Math.max(0, v.w - 4),
            Math.max(0, v.h - 4),
            i % 2 ? a.tint : ink,
            6,
          );
          if (v.w > 83 && v.h > 70) {
            const color = i % 2 ? fg : a.buttonText;
            text(
              String(v.value),
              v.x + v.w / 2,
              v.y + v.h * 0.4,
              Math.min(60, v.w * 0.3),
              color,
              v.w - 12,
              v.h * 0.43,
              'center',
            );
            text(
              v.label,
              v.x + v.w / 2,
              v.y + v.h * 0.74,
              24,
              color,
              v.w - 14,
              v.h * 0.35,
              'center',
            );
          }
        });
      }),
    );
    vals.forEach((v, i) => {
      const xx = i % 2 ? 12 : -235,
        yy = 209 + Math.floor(i / 2) * 37;
      circle(xx, yy, 3, ink);
      text(`${v.label} · ${v.value}`, xx + 12, yy, 19, fg, 215, 32);
    });
  }
  if (['trend', 'event'].includes(e.variant)) {
    panel();
    const max = Math.max(1, ...series.map((v) => v.value)),
      n = series.length,
      pts = series.map((v, i) => ({
        x: -207 + (428 * i) / Math.max(1, n - 1),
        y: 225 - (v.value / max) * 367,
      }));
    for (let i = 0; i <= 4; i++) {
      const y = 225 - (i * 367) / 4;
      line(-207, y, 221, y, a.border, 1);
      text(
        Number(((max * i) / 4).toFixed(1)).toLocaleString('en-US'),
        -220,
        y,
        14,
        a.muted,
        58,
        28,
        'right',
        450,
      );
    }
    const phase = clamp((p - 0.08) / 0.49) * Math.max(1, n - 1),
      idx = Math.min(n - 1, Math.floor(phase)),
      frac = phase - Math.floor(phase);
    for (let i = 1; i < n; i++) {
      const f = clamp(phase - (i - 1));
      if (f)
        line(
          pts[i - 1].x,
          pts[i - 1].y,
          pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
          pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
          ink,
          4,
        );
    }
    if (n) {
      const pt =
        idx < n - 1
          ? {
              x: pts[idx].x + (pts[idx + 1].x - pts[idx].x) * frac,
              y: pts[idx].y + (pts[idx + 1].y - pts[idx].y) * frac,
            }
          : pts[n - 1];
      ring(pt.x, pt.y, 5);
    }
    series.forEach((v, i) =>
      text(v.label, pts[i].x, 256, 16, a.muted, 428 / Math.max(1, n), 48, 'center', 450),
    );
    if (e.variant === 'trend') {
      for (let i = 1; i < n; i++)
        if (series[i].value < series[i - 1].value)
          fade(0.2 * ease((p - 0.54 - (i - 1) * 0.025) / 0.17), () => {
            c.strokeStyle = ink;
            c.lineWidth = 21;
            c.lineCap = 'butt';
            c.beginPath();
            c.moveTo(pts[i - 1].x, pts[i - 1].y);
            c.lineTo(pts[i].x, pts[i].y);
            c.stroke();
          });
      label('下降区间逐段强调', -208, 308);
    } else if (n) {
      const mid = Math.floor((n - 1) / 2),
        x = pts[mid].x;
      delayed(4, () => {
        c.save();
        c.setLineDash([5, 6]);
        line(x, -158, x, 230, a.secondary, 2);
        c.restore();
        rect(Math.min(x - 65, 86), -204, 135, 41, a.tint, 5);
        text('事件节点', Math.min(x + 2.5, 153.5), -184, 20, fg, 120, 36, 'center');
      });
      label('事件位于时间序列中间节点', -208, 308);
    }
  }
  if (e.variant === 'capital') {
    panel();
    const t = ease((p - 0.1) / 0.5),
      total = series.reduce((n, v) => n + v.value, 0);
    label('合计 / TOTAL', -234, -169);
    text(Math.round(total * t).toLocaleString('en-US'), -236, -99, 77, ink, 470, 103);
    series.forEach((v, i) =>
      delayed(i, () => {
        const y = -12 + i * 78;
        rect(-238, y, 476, 67, i % 2 ? a.tint : ink, 8);
        text(v.label, -218, y + 33, 23, i % 2 ? fg : a.buttonText, 245, 50);
        text(
          Math.round(v.value * t).toLocaleString('en-US'),
          213,
          y + 33,
          34,
          i % 2 ? fg : a.buttonText,
          172,
          55,
          'right',
        );
      }),
    );
  }
  if (e.variant === 'relations') {
    panel();
    body.slice(0, 3).forEach((v, i) => {
      const [from, ...to] = v.split('→'),
        y = -110 + i * 143;
      delayed(i, () => {
        rect(-238, y, 196, 99, a.tint);
        text(from, -140, y + 50, 29, fg, 166, 80, 'center');
      });
      arrow(-30, y + 50, 38, y + 50, ease((p - 0.17 - i * 0.12) / 0.22));
      delayed(i + 2, () => {
        rect(50, y, 188, 99, ink);
        text(to.join('→') || '关联对象', 144, y + 50, 29, a.buttonText, 166, 80, 'center');
      });
    });
  }
  if (e.variant === 'concepts') {
    text(s.title, 0, -365, 43, fg, 500, 120, 'center');
    const positions = [
      [-267, -224],
      [28, -59],
      [-227, 124],
    ];
    body.slice(0, 3).forEach((v, i) =>
      delayed(i + 1, () => {
        const [x, y] = positions[i];
        c.save();
        c.translate(x, y + (1 - ease((p - 0.1 - i * 0.08) / 0.3)) * 70);
        c.rotate((i - 1) * 0.04);
        rect(0, 0, 245, 153, a.surface, 10);
        rect(0, 0, 245, 7, ink, 0);
        text(`0${i + 1}`, 20, 36, 20, ink, 205, 40);
        text(v, 20, 94, 31, fg, 205, 89);
        c.restore();
      }),
    );
    text(s.subtitle, 0, 366, 20, a.muted, 475, 65, 'center');
  }
  if (e.variant === 'verdict') {
    panel();
    body.slice(0, 2).forEach((v, i) =>
      delayed(i + 1, () => {
        const y = -167 + i * 225;
        rect(-238, y, 476, 196, i ? a.tint : ink);
        text(i ? '视角 B' : '视角 A', -211, y + 38, 21, i ? ink : a.buttonText, 400, 50);
        text(v, -211, y + 117, 38, i ? fg : a.buttonText, 422, 120);
      }),
    );
  }
  if (e.variant === 'quote') {
    c.rotate(-0.035 * (1 - ease((p - 0.5) / 0.35)));
    panel();
    image(-238, -190, 476, 225);
    text('“', -234, 91, 86, ink, 80, 106);
    delayed(2, () => text(s.body, -216, 204, 35, fg, 432, 210));
  }
  if (e.variant === 'chapter') {
    clip(-282, -433, 564 * enter, 186, () => {
      rect(-278, -422, 90, 116, ink, 2);
      text('01', -233, -367, 41, a.buttonText, 80, 84, 'center');
      rect(-181, -422, 449, 116, a.surface, 2);
      text(s.title, -161, -372, 37, fg, 407, 84);
      text(s.subtitle, -274, -277, 18, a.muted, 535, 52);
    });
  }
  if (e.variant === 'number') {
    const t = ease((p - 0.06) / 0.42),
      value = Math.max(0, Math.min(999999, Number(s.title) || 0));
    text(Math.round(value * t).toLocaleString('en-US'), 0, -6, 106, ink, 574, 200, 'center', 800);
    line(-240, 97, -240 + 480 * ease((p - 0.3) / 0.3), 97, ink, 3);
    text(s.subtitle, 0, 162, 30, fg, 525, 100, 'center');
  }
  if (e.variant === 'pip') {
    const x = 151,
      y = -303,
      r = 106;
    c.save();
    c.beginPath();
    c.arc(x, y, r - 4, 0, TAU);
    c.clip();
    image(x - r, y - r, r * 2, r * 2, { empty: false });
    c.restore();
    ring(x, y, r);
    text(s.title, x, y + r + 35, 26, fg, 234, 67, 'center');
    text(s.subtitle, x, y + r + 85, 16, a.muted, 230, 42, 'center');
  }
  if (e.variant === 'split') {
    text(s.title, 0, -356, 43, fg, 536, 110, 'center');
    rect(2, -223, 270, 508);
    line(-266, -223, -22, -223, ink, 4);
    line(-266, 285, -22, 285, ink, 4);
    line(-266, -223, -266, 285, a.border, 2);
    line(-22, -223, -22, 285, a.border, 2);
    body.slice(0, 3).forEach((v, i) =>
      delayed(i + 1, () => {
        text(`0${i + 1}`, 24, -156 + i * 137, 21, ink, 226, 35);
        text(v, 24, -97 + i * 137, 32, fg, 226, 87);
      }),
    );
    text(s.subtitle, 0, 369, 21, a.muted, 512, 76, 'center');
  }
  if (e.variant === 'broll') {
    text(s.title, -265, -346, 42, fg, 320, 138);
    image(-275, -170, 550, 350, { empty: false });
    line(-275, -172, 275, -172, ink, 3);
    line(-275, 182, 275, 182, ink, 3);
    ring(168, -282, 83);
    text(s.subtitle, 0, 249, 28, fg, 510, 112, 'center');
  }
  if (e.variant === 'halftone') {
    dotGrid(-280, -428, 560, 856);
    const g = c.createRadialGradient(-120 + 240 * p, -110, 10, -120 + 240 * p, -110, 330);
    g.addColorStop(0, ink + '38');
    g.addColorStop(1, ink + '00');
    rect(-300, -435, 600, 870, g, 0);
    text(s.title, 0, -20, 51, fg, 520, 185, 'center');
    text(s.subtitle, 0, 143, 22, a.muted, 500, 89, 'center');
  }
  if (e.variant === 'orbit') {
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate(p * 0.3 + i * 0.35);
      c.scale(1, 0.74);
      fade(0.4, () => ring(0, 0, 197 + i * 26));
      const t = p * TAU * (i % 2 ? -1 : 1) + i;
      circle(Math.cos(t) * (197 + i * 26), Math.sin(t) * (197 + i * 26), 5, ink);
      c.restore();
    }
    for (let i = 0; i < 9; i++)
      fade(0.15, () => line(-220, -111 + i * 28, 220, -111 + i * 28, ink, 1));
    text(s.title, 0, -24, 58, fg, 500, 207, 'center');
    text(s.subtitle, 0, 296, 21, a.muted, 490, 76, 'center');
  }
  if (e.variant === 'cutout') {
    panel();
    c.save();
    c.translate(0, 90 * (1 - ease((p - 0.1) / 0.3)));
    if (s.image) {
      const k = Math.min(470 / s.image.width, 437 / s.image.height),
        iw = s.image.width * k,
        ih = s.image.height * k;
      // Isolated offscreen mask: source-in never erases the surrounding card.
      const mask = document.createElement('canvas');
      mask.width = Math.max(1, Math.ceil(iw));
      mask.height = Math.max(1, Math.ceil(ih));
      const mc = mask.getContext('2d');
      mc.drawImage(s.image, 0, 0, mask.width, mask.height);
      mc.globalCompositeOperation = 'source-in';
      mc.fillStyle = ink;
      mc.fillRect(0, 0, mask.width, mask.height);
      c.drawImage(mask, -iw / 2 + 13, -178 + 11, iw, ih);
      c.drawImage(s.image, -iw / 2, -178, iw, ih);
    } else image(-225, -178, 450, 437);
    c.restore();
    delayed(2, () => {
      rect(-252, 214, 504, 111, a.tint, 8);
      text(s.body, 0, 269, 29, fg, 454, 90, 'center');
    });
  }
  if (e.variant === 'benchmark') {
    panel();
    const max = Math.max(1, ...series.map((v) => v.value)),
      bw = 440 / Math.max(1, series.length);
    series.forEach((v, i) => {
      const t = ease((p - 0.1 - i * 0.06) / 0.4),
        x = -220 + i * bw,
        barH = (v.value / max) * 287 * t;
      rect(x + 10, 198 - barH, bw - 20, barH, ink, 7);
      text(String(v.value), x + bw / 2, 174 - barH, 25, fg, bw - 6, 47, 'center');
      text(v.label, x + bw / 2, 239, 23, fg, bw - 6, 61, 'center');
      if (v.value === max)
        delayed(5, () => {
          rect(x + 10, -196, bw - 20, 39, a.tint, 6);
          text('最高值', x + bw / 2, -177, 18, fg, bw - 24, 31, 'center');
        });
    });
  }
  c.restore();
}
