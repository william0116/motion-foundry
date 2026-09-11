import { paletteFor } from './schemes.js';
import { parseSeries } from './expanded-effects.js';
const TAU = Math.PI * 2,
  FONT = '"PingFang SC","Microsoft YaHei",sans-serif';
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - (1 - clamp(x)) ** 3;
const spring = (x) => {
  x = clamp(x);
  return 1 - Math.cos(x * Math.PI * 3.5) * Math.exp(-7 * x);
};
const lines = (body) =>
  body
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

// Seekable, time-based motion: no random numbers, DOM animation or wall-clock state.
export function renderExpanded(canvas, e, s, progress) {
  const c = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (progress <= 0 || progress >= 1) return;
  const p =
    e.category === 'transition' ? progress : Math.pow(clamp(progress), 1.35 - s.intensity / 140);
  const q = ease(p / 0.22),
    a = paletteFor(s),
    accent = a.accent,
    fg = a.foreground;
  const rect = (x, y, bw, bh, fill = a.surface, r = 12) => {
    if (bw <= 0 || bh <= 0) return;
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, bw, bh, Math.min(r, bw / 2, bh / 2));
    c.fill();
  };
  const stroke = (x1, y1, x2, y2, color = accent, lw = 3) => {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };
  const dot = (x, y, r, fill = accent) => {
    if (r <= 0) return;
    c.fillStyle = fill;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  };
  const arc = (x, y, r, start, end, color = accent, lw = 5, cap = 'round') => {
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = cap;
    c.beginPath();
    c.arc(x, y, r, start, end);
    c.stroke();
  };
  const layout = (str, size, maxW, maxH, weight = 650) => {
    let rows;
    do {
      c.font = `${weight} ${size}px ${FONT}`;
      rows = [];
      for (const para of String(str).split('\n')) {
        let row = '';
        for (const char of [...para]) {
          if (row && c.measureText(row + char).width > maxW) {
            rows.push(row);
            row = char;
          } else row += char;
        }
        rows.push(row);
      }
      if (rows.length * size * 1.3 <= maxH || size <= 10) break;
      size -= 1;
    } while (size > 0);
    return { rows, size };
  };
  const text = (
    str,
    x,
    y,
    size = 40,
    color = fg,
    maxW = 640,
    maxH = 100,
    align = 'center',
    weight = 650,
  ) => {
    const l = layout(str, size, maxW, maxH, weight);
    c.font = `${weight} ${l.size}px ${FONT}`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'middle';
    l.rows.forEach((row, i) =>
      c.fillText(row, x, y + (i - (l.rows.length - 1) / 2) * l.size * 1.3),
    );
    return l;
  };
  const fade = (t, fn) => {
    c.save();
    c.globalAlpha *= clamp(t);
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
  const image = (x, y, bw, bh) => {
    clip(x, y, bw, bh, () => {
      if (s.image) {
        const k = Math.max(bw / s.image.width, bh / s.image.height);
        c.drawImage(
          s.image,
          x + (bw - s.image.width * k) / 2,
          y + (bh - s.image.height * k) / 2,
          s.image.width * k,
          s.image.height * k,
        );
      } else {
        rect(x, y, bw, bh, a.tint, 0);
        stroke(x + 18, y + 18, x + bw - 18, y + 18, a.border, 2);
        stroke(x + 18, y + bh - 18, x + bw - 18, y + bh - 18, a.border, 2);
        text(
          '添加你的' + (e.imageRole || '图片'),
          x + bw / 2,
          y + bh / 2,
          24,
          a.muted,
          bw - 30,
          bh - 20,
        );
      }
    });
  };
  const arrow = (x1, y1, x2, y2, t, color = accent) => {
    const x = x1 + (x2 - x1) * clamp(t),
      y = y1 + (y2 - y1) * clamp(t),
      angle = Math.atan2(y2 - y1, x2 - x1);
    stroke(x1, y1, x, y, color, 3);
    if (t > 0.05) {
      stroke(x, y, x - 10 * Math.cos(angle - 0.6), y - 10 * Math.sin(angle - 0.6), color, 3);
      stroke(x, y, x - 10 * Math.cos(angle + 0.6), y - 10 * Math.sin(angle + 0.6), color, 3);
    }
  };
  c.save();
  if (e.category === 'transition') {
    // All six have exact transparent endpoints and a fully opaque cut point at 50%.
    if (p >= 0.46 && p <= 0.54) {
      rect(0, 0, w, h, accent, 0);
      c.restore();
      return;
    }
    const incoming = p < 0.5,
      t = incoming ? p / 0.46 : (1 - p) / 0.46;
    if (e.variant === 'checker') {
      const cols = 8,
        rows = Math.ceil((h / w) * cols),
        cw = w / cols,
        ch = h / rows;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const z = ease((t - ((x * 7 + y * 11) % 13) / 30) / 0.6);
          rect(
            x * cw + ((1 - z) * cw) / 2,
            y * ch + ((1 - z) * ch) / 2,
            (cw + 1) * z,
            (ch + 1) * z,
            accent,
            0,
          );
        }
    }
    if (e.variant === 'chevron') {
      const end = -w * 0.4 + ease(t) * w * 1.8;
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(-w, 0);
      c.lineTo(end - w * 0.35, 0);
      c.lineTo(end, h / 2);
      c.lineTo(end - w * 0.35, h);
      c.lineTo(-w, h);
      c.closePath();
      c.fill();
    }
    if (e.variant === 'iris') {
      const z = ease(t),
        r = ((w + h) / 2 + 2) * z;
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(w / 2, h / 2 - r);
      c.lineTo(w / 2 + r, h / 2);
      c.lineTo(w / 2, h / 2 + r);
      c.lineTo(w / 2 - r, h / 2);
      c.closePath();
      c.fill();
    }
    if (e.variant === 'steps')
      for (let i = 0; i < 8; i++) {
        const z = ease((t - i * 0.045) / 0.65);
        rect((i * w) / 8, incoming ? 0 : h * (1 - z), w / 8 + 1, h * z, accent, 0);
      }
    if (e.variant === 'wave') {
      const x = -w * 0.4 + ease(t) * w * 1.9;
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(-w, 0);
      c.lineTo(x, 0);
      c.bezierCurveTo(x - w * 0.5, h * 0.3, x + w * 0.4, h * 0.65, x, h);
      c.lineTo(-w, h);
      c.closePath();
      c.fill();
    }
    if (e.variant === 'doors') {
      const z = ease(t);
      rect(0, 0, (w / 2) * z + 1, h, accent, 0);
      rect(w - (w / 2) * z - 1, 0, (w / 2) * z + 1, h, accent, 0);
    }
    c.restore();
    return;
  }
  const tall =
    e.category === 'portrait' || (e.category === 'media' && ['photo', 'phone'].includes(e.variant));
  const stageW = tall ? 660 : 860,
    stageH = tall ? 1060 : 560;
  const factor = Math.min(
    (Math.min(w / stageW, h / stageH) * s.scale) / 100,
    w / (tall ? 640 : 800),
    h / (tall ? 980 : 510),
  );
  const half = (tall ? 465 : 245) * factor,
    py = s.position === 'top' ? 0.28 : s.position === 'bottom' ? 0.72 : 0.5;
  const cy = Math.max(half + 10, Math.min(h - half - 10, h * py));
  c.translate(w / 2, cy);
  c.scale(factor, factor);
  c.globalAlpha = ease(p / 0.06) * (1 - ease((p - 0.88) / 0.12));
  const footer = () => text(s.subtitle, 0, 190, 19, a.muted, 650, 65, 'center', 450);
  const panel = () => rect(-380, -232, 760, 464, a.surface, 16);
  const title = () => {
    text(s.title, 0, -174, 34, fg, 650, 80);
  };

  if (e.category === 'text') {
    const l = layout(s.title, 64, 650, 190),
      lineH = l.size * 1.3;
    const glyphs = [];
    c.font = `750 ${l.size}px ${FONT}`;
    l.rows.forEach((row, ri) => {
      const ww = c.measureText(row).width;
      let xx = -ww / 2;
      for (const char of [...row]) {
        const width = c.measureText(char).width;
        glyphs.push({ char, x: xx + width / 2, y: (ri - (l.rows.length - 1) / 2) * lineH - 15 });
        xx += width;
      }
    });
    const drawTitle = (fill = accent) => text(s.title, 0, -15, 64, fill, 650, 190, 'center', 750);
    if (['cascade', 'rotate-type', 'tracking'].includes(e.variant))
      glyphs.forEach((g, i) => {
        const t = ease((p - (i / Math.max(1, glyphs.length)) * 0.2) / 0.26);
        c.save();
        c.globalAlpha *= t;
        c.translate(
          g.x * (e.variant === 'tracking' ? 1 + (1 - t) * 2 : 1),
          g.y + (e.variant === 'cascade' ? (1 - t) * 90 : 0),
        );
        if (e.variant === 'rotate-type') {
          c.rotate(-(1 - t) * 1.1);
          c.scale(Math.max(0.05, spring(t)), Math.max(0.05, spring(t)));
        }
        text(g.char, 0, 0, l.size, accent, l.size * 2, l.size * 2);
        c.restore();
      });
    if (e.variant === 'split-type') {
      for (const side of [-1, 1])
        clip(-360, side < 0 ? -180 : -15, 720, side < 0 ? 165 : 200, () => {
          c.translate(side * (1 - q) * 230, 0);
          drawTitle();
        });
    }
    if (e.variant === 'outline') {
      c.save();
      c.strokeStyle = accent;
      c.lineWidth = 1.6;
      c.font = `750 ${l.size}px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      l.rows.forEach((row, i) => c.strokeText(row, 0, (i - (l.rows.length - 1) / 2) * lineH - 15));
      c.restore();
      clip(-350, -160, 700 * ease((p - 0.14) / 0.48), 320, () => drawTitle());
    }
    if (e.variant === 'glitch') {
      const strength = (1 - ease((p - 0.12) / 0.38)) * 28;
      for (let i = 0; i < 9; i++)
        clip(-360, -150 + i * 32, 720, 32, () => {
          c.translate(Math.sin(i * 5 + Math.floor(p * 30)) * strength, 0);
          drawTitle(i % 3 === 0 ? a.highlight : accent);
        });
    }
    if (e.variant === 'marquee') {
      rect(-365, -110, 730, 160, a.surface, 12);
      clip(-350, -105, 700, 150, () => {
        c.font = `750 ${l.size}px ${FONT}`;
        const span = Math.max(320, c.measureText(s.title).width + 90),
          phase = (p * span * 1.8) % span;
        for (let i = -2; i < 4; i++)
          text(s.title, i * span - phase, -30, l.size, accent, span - 70, 115);
      });
      stroke(-340, 90, -340 + 680 * q, 90, accent, 2);
    }
    if (e.variant === 'echo-type') {
      for (let i = 4; i >= 0; i--)
        fade(i === 0 ? 1 : 0.12, () => {
          c.translate(0, (i - 2) * (1 - ease(p / 0.5)) * 35);
          drawTitle(i ? fg : accent);
        });
    }
    fade(ease((p - 0.15) / 0.25), footer);
  }
  if (e.category === 'caption') {
    if (e.variant === 'karaoke') {
      rect(-360, -120, 720, 210, a.surface, 24);
      const l = text(s.title, 0, -20, 54, fg, 660, 165),
        total = l.rows.reduce((n, row) => n + [...row].length, 0),
        active = clamp((p - 0.1) / 0.7) * total;
      let index = 0;
      c.font = `650 ${l.size}px ${FONT}`;
      l.rows.forEach((row, ri) => {
        let xx = -c.measureText(row).width / 2;
        const yy = -20 + (ri - (l.rows.length - 1) / 2) * l.size * 1.3;
        for (const char of [...row]) {
          const bw = c.measureText(char).width,
            part = clamp(active - index);
          clip(xx, yy - l.size, bw * part, l.size * 2, () =>
            text(char, xx + bw / 2, yy, l.size, a.highlight, bw + 2, l.size * 2),
          );
          xx += bw;
          index++;
        }
      });
      stroke(-325, 115, -325 + 650 * clamp((p - 0.1) / 0.7), 115, accent, 4);
    }
    if (e.variant === 'keyword') {
      const words = s.title.trim().includes(' ') ? s.title.trim().split(/\s+/) : [...s.title];
      const phase = clamp((p - 0.07) / 0.72) * words.length,
        index = Math.min(words.length - 1, Math.floor(phase)),
        z = 0.82 + 0.18 * ease((phase % 1) / 0.25);
      c.save();
      c.scale(z, z);
      rect(-345, -105, 690, 210, a.surface, 14);
      text(words[index] || '', 0, -10, 96, accent, 640, 180);
      c.restore();
      text(`${index + 1} / ${words.length}`, 0, 128, 19, a.muted);
    }
    if (e.variant === 'subtitle-box') {
      c.translate(0, 70 * (1 - q));
      rect(-350, -75, 700, 150, accent, 75);
      text(s.title, 0, 0, 45, a.buttonText, 610, 110);
    }
    if (e.variant === 'news') {
      c.translate((1 - q) * -180, 0);
      rect(-360, -105, 720, 160, a.surface, 3);
      rect(-360, -105, 8, 160, accent, 0);
      text(s.title, 0, -30, 40, fg, 650, 105);
      rect(-360, 64, 720 * ease((p - 0.12) / 0.28), 70, accent, 0);
      clip(-350, 64, 700 * ease((p - 0.12) / 0.28), 70, () =>
        text(s.subtitle, 0, 98, 24, a.buttonText, 650, 60),
      );
    }
    if (e.variant !== 'news') footer();
  }
  if (e.category === 'data') {
    panel();
    const values = parseSeries(s.body).filter(Boolean),
      cols =
        a.id === 'free'
          ? [accent, '#8aa8c1', '#b08ed2', '#e9b27c', '#7caf9b']
          : [accent, a.secondary, a.highlight, fg, a.muted],
      t = ease((p - 0.1) / 0.58);
    if (['line', 'donut', 'rank'].includes(e.variant)) title();
    if (e.variant === 'line' && values.length > 1) {
      const max = Math.max(1, ...values.map((x) => x.value));
      for (let i = 0; i < 4; i++) {
        const y = 120 - i * 65;
        stroke(-295, y, 305, y, a.border, 1);
        text(String(Math.round((max * i) / 3)), -320, y, 16, a.muted, 55, 30);
      }
      const pts = values.map((v, i) => ({
        x: -280 + (560 * i) / (values.length - 1),
        y: 120 - (v.value / max) * 195,
      }));
      clip(-310, -110, 650 * t, 240, () => {
        c.strokeStyle = accent;
        c.lineWidth = 5;
        c.beginPath();
        pts.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
        c.stroke();
        pts.forEach((v) => dot(v.x, v.y, 6));
      });
      values.forEach((v, i) => {
        text(v.label, pts[i].x, 148, 16, a.muted, 560 / values.length, 35);
        fade(ease((t - i / values.length) / 0.2), () =>
          text(String(v.value), pts[i].x, pts[i].y - 23, 18, fg, 90, 30),
        );
      });
    }
    if (e.variant === 'donut' && values.length) {
      const sum = values.reduce((n, v) => n + v.value, 0) || 1;
      let angle = -Math.PI / 2;
      values.forEach((v, i) => {
        const span = (v.value / sum) * TAU;
        arc(-145, 5, 103, angle, angle + span * t, cols[i % cols.length], 32, 'butt');
        angle += span;
        const yy = -80 + i * 40;
        dot(40, yy, 5, cols[i % cols.length]);
        text(`${v.label} ${((v.value / sum) * 100).toFixed(1)}%`, 60, yy, 22, fg, 250, 32, 'left');
      });
      text('100%', -145, 5, 35, fg, 165, 60);
    }
    if (e.variant === 'rank') {
      const sorted = [...values].sort((a, b) => b.value - a.value),
        max = Math.max(1, ...sorted.map((v) => v.value));
      sorted.forEach((v, i) => {
        const yy = -100 + i * 53,
          z = ease((p - 0.09 - i * 0.055) / 0.45);
        text(v.label, -305, yy + 12, 20, fg, 150, 40, 'left');
        rect(-135, yy, ((375 * v.value) / max) * z, 25, cols[i % cols.length], 5);
        text(String(Math.round(v.value * z)), 270, yy + 12, 20, fg, 80, 35);
      });
    }
    if (e.variant === 'pictogram') {
      const value = Math.min(100, Number(s.title) || 0);
      for (let i = 0; i < 100; i++) {
        rect(
          -295 + (i % 10) * 25,
          -122 + Math.floor(i / 10) * 25,
          18,
          18,
          i < Math.round(value * t) ? accent : a.tint,
          3,
        );
      }
      text(`${Math.round(value * t)}%`, 125, -5, 92, accent, 310, 140);
    }
    if (e.variant === 'gauge') {
      arc(0, 65, 168, Math.PI, TAU, a.border, 20);
      arc(0, 65, 168, Math.PI, Math.PI + Math.PI * clamp(Number(s.title) / 100) * t, accent, 20);
      const angle = Math.PI + Math.PI * clamp(Number(s.title) / 100) * t;
      stroke(0, 65, Math.cos(angle) * 132, 65 + Math.sin(angle) * 132, fg, 5);
      dot(0, 65, 10, accent);
      text(`${Math.round((Number(s.title) || 0) * t)}%`, 0, 123, 54, accent, 300, 80);
    }
    if (e.variant === 'odometer') {
      const digits = String(Math.min(999999, Math.max(0, Math.floor(Number(s.title) || 0)))).split(
          '',
        ),
        dw = 90,
        start = (-digits.length * dw) / 2;
      digits.forEach((digit, i) => {
        rect(start + i * dw + 3, -85, dw - 6, 158, a.tint, 12);
        const scroll = ease((p - i * 0.025) / 0.64) * (20 + Number(digit)),
          base = Math.floor(scroll),
          off = scroll - base;
        clip(start + i * dw, -80, dw, 144, () => {
          text(String(base % 10), start + (i + 0.5) * dw, -2 - off * 145, 100, accent, 80, 142);
          text(
            String((base + 1) % 10),
            start + (i + 0.5) * dw,
            143 - off * 145,
            100,
            accent,
            80,
            142,
          );
        });
      });
    }
    footer();
  }
  if (e.category === 'diagram') {
    panel();
    title();
    const items = lines(s.body).slice(0, e.maxLines),
      n = items.length;
    if (e.variant === 'flow')
      items.forEach((v, i) => {
        const xx = n === 1 ? 0 : -265 + (i * 530) / (n - 1);
        if (i) arrow(xx - 530 / (n - 1) + 58, 8, xx - 58, 8, ease((p - 0.12 - i * 0.085) / 0.25));
        fade(ease((p - i * 0.095) / 0.24), () => {
          rect(xx - 58, -47, 116, 110, a.tint, 14);
          text(String(i + 1).padStart(2, '0'), xx, -15, 22, accent);
          text(v, xx, 22, 23, fg, 98, 55);
        });
      });
    if (e.variant === 'cycle')
      items.forEach((v, i) => {
        const angle = -Math.PI / 2 + (i / Math.max(1, n)) * TAU,
          xx = Math.cos(angle) * 175,
          yy = 25 + Math.sin(angle) * 115;
        arc(
          0,
          25,
          94,
          angle,
          angle + (TAU / Math.max(1, n)) * 0.8 * ease((p - i * 0.07) / 0.4),
          accent,
          3,
        );
        fade(ease((p - i * 0.07) / 0.3), () => {
          rect(xx - 62, yy - 32, 124, 64, a.tint, 24);
          text(v, xx, yy, 25, fg, 105, 50);
        });
      });
    if (e.variant === 'tree') {
      dot(0, -62, 18, accent);
      items.forEach((v, i) => {
        const xx = n === 1 ? 0 : -245 + (i * 490) / (n - 1),
          t = ease((p - i * 0.08) / 0.4);
        stroke(0, -40, xx * t, -40 + 112 * t, accent, 3);
        fade(t, () => {
          rect(xx - 91, 77, 182, 70, a.tint, 12);
          text(v, xx, 111, 26, fg, 160, 55);
        });
      });
    }
    if (e.variant === 'route') {
      const pts = items.map((v, i) => ({
        x: n === 1 ? 0 : -275 + (i * 550) / (n - 1),
        y: i % 2 ? 75 : -45,
      }));
      pts.forEach((v, i) => {
        if (i) arrow(pts[i - 1].x, pts[i - 1].y, v.x, v.y, ease((p - i * 0.09) / 0.35), accent);
        fade(ease((p - i * 0.09) / 0.3), () => {
          dot(v.x, v.y, 18, a.surface);
          arc(v.x, v.y, 14, 0, TAU, accent, 3);
          text(items[i], v.x, v.y + (i % 2 ? 43 : -40), 23, fg, 145, 60);
        });
      });
    }
    footer();
  }
  if (e.category === 'media') {
    if (e.variant === 'photo') {
      c.translate(0, -95 * (1 - q));
      c.rotate((1 - q) * -0.2);
      rect(-262, -400, 524, 775, a.surface, 5);
      image(-237, -370, 474, 540);
      text(s.title, 0, 232, 42, fg, 450, 100);
      text(s.subtitle, 0, 319, 21, a.muted, 440, 50);
    }
    if (e.variant === 'phone') {
      c.translate(0, (1 - q) * 160);
      c.rotate((1 - q) * 0.12);
      rect(-224, -410, 448, 780, a.border, 40);
      rect(-212, -398, 424, 756, a.surface, 32);
      clip(-196, -375, 392, 706, () => image(-196, -375 + (1 - q) * 100, 392, 706));
      rect(-58, -387, 116, 21, a.surface, 11);
      rect(-54, 334, 108, 5, fg, 3);
      text(s.title, 0, 411, 34, fg, 520, 75);
      text(s.subtitle, 0, 457, 18, a.muted, 520, 40);
    }
    if (e.variant === 'film') {
      rect(-374, -196, 748, 334, a.surface, 5);
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 20; i++) rect(-357 + i * 37, -185 + j * 297, 19, 15, a.border, 3);
      clip(-368, -157, 736, 251, () => {
        const phase = p * 110;
        for (let i = -1; i < 4; i++) image(-360 + i * 270 - phase, -150, 252, 235);
      });
      text(s.title, 0, 173, 39, fg, 660, 70);
      text(s.subtitle, 0, 218, 18, a.muted, 650, 32);
    }
    if (e.variant === 'window') {
      const z = 0.82 + 0.18 * q;
      c.scale(z, z);
      rect(-365, -205, 730, 344, a.surface, 12);
      for (let i = 0; i < 3; i++) dot(-340 + i * 20, -182, 5, i === 0 ? accent : a.border);
      rect(-265, -194, 570, 24, a.tint, 5);
      image(-351, -157, 702, 282);
      text(s.title, 0, 176, 36, fg, 650, 60);
      text(s.subtitle, 0, 218, 19, a.muted, 650, 32);
    }
  }
  if (e.category === 'portrait') {
    c.translate(0, 35 * (1 - q));
    const body = lines(s.body),
      stamp = () => {
        text(s.badge, -226, -361, 22, accent, 450, 40, 'left');
        stroke(-226, -326, 226, -326, a.border, 2);
        text(s.subtitle, 0, 386, 17, a.muted, 450, 45);
      };
    if (e.variant !== 'torn') rect(-270, -426, 540, 852, a.surface, 14);
    if (e.variant === 'bento') {
      stamp();
      text(s.title, -226, -220, 50, fg, 450, 148, 'left');
      body.slice(0, 3).forEach((v, i) => {
        const t = ease((p - 0.08 - i * 0.09) / 0.34),
          xx = i ? (i === 1 ? -226 : 8) : -226,
          yy = i ? 112 : -104,
          bw = i ? 218 : 452,
          bh = i ? 218 : 198;
        c.save();
        c.translate(0, (1 - t) * 60);
        c.globalAlpha *= t;
        rect(xx, yy, bw, bh, i === 0 ? accent : a.tint, 12);
        text(
          `0${i + 1}`,
          xx + 22,
          yy + 35,
          23,
          i === 0 ? a.buttonText : accent,
          bw - 44,
          40,
          'left',
        );
        text(
          v,
          xx + 22,
          yy + bh * 0.62,
          i ? 32 : 35,
          i === 0 ? a.buttonText : fg,
          bw - 44,
          bh * 0.6,
          'left',
        );
        c.restore();
      });
    }
    if (e.variant === 'torn') {
      clip(-290, -450, 580, 900 * q, () => {
        c.fillStyle = a.surface;
        c.beginPath();
        c.moveTo(-265, -410);
        for (let i = 0; i <= 22; i++) c.lineTo(-265 + i * 24, -408 + (i % 2 ? 9 : 0));
        c.lineTo(265, 407);
        for (let i = 22; i >= 0; i--) c.lineTo(-265 + i * 24, 407 - (i % 2 ? 11 : 0));
        c.closePath();
        c.fill();
        stamp();
        text(s.title, -220, -203, 52, fg, 440, 155, 'left');
        for (let i = 0; i < 7; i++) stroke(-220, -42 + i * 47, 220, -42 + i * 47, a.border, 1);
        text(s.body, -220, 110, 32, fg, 430, 300, 'left', 450);
      });
    }
    if (e.variant === 'agenda') {
      stamp();
      text(s.title, -226, -243, 48, fg, 450, 125, 'left');
      body.slice(0, 4).forEach((v, i) => {
        const yy = -99 + i * 99,
          t = ease((p - 0.1 - i * 0.12) / 0.27);
        rect(-224, yy - 21, 448 * t, 75, a.tint, 8);
        text(String(i + 1).padStart(2, '0'), -192, yy + 16, 25, accent, 56, 40);
        text(v, -136, yy + 16, 29, fg, 328, 64, 'left');
      });
    }
    if (e.variant === 'spotlight') {
      stamp();
      text(s.title, 0, -165, 58, fg, 440, 215);
      const t = ease((p - 0.1) / 0.5);
      stroke(-215, -33, -215 + 430 * t, -33, accent, 12);
      for (const side of [-1, 1]) {
        stroke(side * 223, -288, side * 223, -237, accent, 3);
        stroke(side * 223, -288, side * 176, -288, accent, 3);
      }
      fade(ease((p - 0.25) / 0.3), () => text(s.body, 0, 178, 33, fg, 436, 278));
    }
    if (e.variant === 'faq') {
      stamp();
      text('Q', -222, -260, 68, accent, 100, 95, 'left');
      text(s.title, -222, -127, 43, fg, 440, 160, 'left');
      const t = ease((p - 0.2) / 0.4);
      clip(-236, -5, 472, 345 * t, () => {
        rect(-236, -5, 472, 345, a.tint, 12);
        text('A', -208, 45, 43, accent, 90, 65, 'left');
        text(s.body, -208, 194, 32, fg, 416, 234, 'left', 450);
      });
    }
    if (e.variant === 'receipt') {
      clip(-275, -430, 550, 870 * ease(p / 0.55), () => {
        stamp();
        text(s.title, 0, -260, 48, fg, 438, 128);
        body.slice(0, 5).forEach((v, i) => {
          const yy = -130 + i * 79;
          stroke(-222, yy + 34, 222, yy + 34, a.border, 1);
          text(`${String(i + 1).padStart(2, '0')}  ${v}`, -222, yy, 29, fg, 440, 67, 'left');
        });
        for (let i = 0; i < 60; i++) rect(-216 + i * 7.2, 319, (i % 3) + 1, 25, fg, 0);
      });
    }
  }
  if (e.category === 'social') {
    if (e.variant === 'like') {
      const z = 0.8 + 0.2 * spring((p - 0.04) / 0.35);
      c.save();
      c.scale(z, z);
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(0, 47);
      c.bezierCurveTo(-140, -40, -72, -128, 0, -65);
      c.bezierCurveTo(72, -128, 140, -40, 0, 47);
      c.fill();
      c.restore();
      for (let i = 0; i < 8; i++) {
        const r = 80 + ease((p - 0.12) / 0.45) * 60,
          angle = (i / 8) * TAU;
        fade(1 - ease((p - 0.3) / 0.45), () =>
          dot(Math.cos(angle) * r, Math.sin(angle) * r - 30, 4, accent),
        );
      }
    }
    if (e.variant === 'bookmark') {
      c.save();
      c.translate(0, (1 - q) * -130);
      c.fillStyle = accent;
      c.beginPath();
      c.moveTo(-54, -117);
      c.lineTo(54, -117);
      c.lineTo(54, 47);
      c.lineTo(0, 17);
      c.lineTo(-54, 47);
      c.closePath();
      c.fill();
      stroke(-21, -59, -3, -40, a.buttonText, 5);
      stroke(-3, -40, 29, -78, a.buttonText, 5);
      c.restore();
    }
    if (e.variant === 'countdown') {
      const phase = clamp((p - 0.04) / 0.73) * 3,
        n = Math.max(1, 3 - Math.floor(phase));
      arc(0, -26, 110, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - (phase % 1)), accent, 5);
      text(p > 0.77 ? 'GO' : String(n), 0, -26, 118, accent, 220, 170);
    }
    if (e.variant === 'success') {
      arc(0, -35, 93, -Math.PI / 2, -Math.PI / 2 + TAU * q, accent, 5);
      const t = ease((p - 0.15) / 0.35);
      stroke(-40, -34, -40 + 31 * Math.min(1, t * 2), -34 + 30 * Math.min(1, t * 2), accent, 10);
      if (t > 0.5) stroke(-9, -4, -9 + 60 * (t - 0.5) * 2, -4 - 66 * (t - 0.5) * 2, accent, 10);
    }
    text(s.title, 0, 118, 42, fg, 670, 86);
    footer();
  }
  if (e.category === 'decor') {
    if (e.variant === 'speed')
      for (let i = 0; i < 34; i++) {
        const angle = (i / 34) * TAU,
          phase = (p * 1.4 + i * 0.13) % 1,
          r = 155 + phase * 95;
        fade((1 - phase) * 0.7, () =>
          stroke(
            Math.cos(angle) * r * 1.3,
            Math.sin(angle) * r,
            Math.cos(angle) * (r + 38) * 1.3,
            Math.sin(angle) * (r + 38),
            accent,
            1 + (i % 3),
          ),
        );
      }
    if (e.variant === 'scanner') {
      for (const x of [-310, 310])
        for (const y of [-128, 128]) {
          stroke(x, y, x - Math.sign(x) * 42 * q, y, accent, 3);
          stroke(x, y, x, y - Math.sign(y) * 35 * q, accent, 3);
        }
      const xx = -285 + 570 * ((p * 1.3) % 1);
      fade(0.35, () => rect(xx, -116, 5, 232, accent, 0));
      stroke(-285, 144, -285 + 570 * ease(p / 0.7), 144, accent, 2);
    }
    if (e.variant === 'orbit-dots')
      for (let i = 0; i < 3; i++) {
        c.save();
        c.rotate(i * 0.6 - 0.4);
        c.scale(1, 0.55);
        arc(0, 0, 165 + i * 30, 0, TAU, a.border, 1);
        const angle = p * TAU * (i % 2 ? -1 : 1) + i * 2;
        dot(Math.cos(angle) * (165 + i * 30), Math.sin(angle) * (165 + i * 30), 5 + i * 2, accent);
        c.restore();
      }
    if (e.variant === 'waveform')
      for (let i = 0; i < 47; i++) {
        const size = (18 + Math.abs(Math.sin(i * 0.8 + p * 17)) * 70) * (1 - Math.abs(i - 23) / 35);
        fade(0.5, () => rect(-322 + i * 14, -size / 2, 6, size, accent, 3));
      }
    text(s.title, 0, e.variant === 'waveform' ? -112 : -12, 48, fg, 620, 120);
    text(s.subtitle, 0, e.variant === 'waveform' ? 130 : 80, 18, a.muted, 600, 55);
  }
  c.restore();
}
