import { effects, defaults, dimensions, validateBody, validateContent } from './data.js';
import { storyEffects, storySources } from './story-effects.js';
import { splitTiles } from './story-renderer.js';
import { schemes } from './schemes.js';
import { renderFrame } from './renderer.js';
import { crc32, toPNG, exportSequence } from './exporter.js';
export async function testStory(check) {
  const c = document.createElement('canvas'),
    ctx = c.getContext('2d');
  const pixels = () => ctx.getImageData(0, 0, c.width, c.height).data;
  const stats = () => {
    let clear = 0,
      visible = 0;
    const d = pixels();
    for (let i = 3; i < d.length; i += 4) d[i] ? visible++ : clear++;
    return { clear, visible };
  };
  check('口播套装 20 种 / 全库 108 种', storyEffects.length === 20 && effects.length === 108);
  check(
    '口播预设内容合法 / 三条来源可定位',
    storyEffects.every(
      (e) =>
        !validateBody(e, e.body) &&
        !validateContent(e, e.title) &&
        storySources[e.source] &&
        e.at > 0 &&
        e.ratio === '9:16',
    ),
  );
  let endpoints = 0,
    mids = 0,
    animated = 0,
    stress = 0,
    schemed = 0;
  const signatures = new Set();
  for (const e of storyEffects) {
    for (const ratio of ['9:16', '16:9', '1:1']) {
      [c.width, c.height] = dimensions(ratio, 180);
      const s = { ...defaults(e), ratio };
      for (const p of [0, 1]) {
        renderFrame(c, e, s, p);
        if (!stats().visible) endpoints++;
      }
      renderFrame(c, e, s, 0.56);
      const count = stats();
      if (count.visible && count.clear) mids++;
      if (ratio === '9:16') signatures.add(crc32(pixels()));
      renderFrame(c, e, s, 0.08);
      const hash = crc32(pixels());
      renderFrame(c, e, s, 0.6);
      if (hash !== crc32(pixels())) animated++;
      for (const position of ['top', 'center', 'bottom'])
        for (const scale of [60, 100, 130])
          for (const intensity of [0, 100]) {
            renderFrame(c, e, { ...s, position, scale, intensity }, 0.51);
            if (stats().visible) stress++;
          }
    }
    [c.width, c.height] = dimensions('9:16', 180);
    for (const scheme of schemes) {
      renderFrame(
        c,
        e,
        {
          ...defaults(e),
          scheme: scheme.id,
          title: e.numeric ? e.title : '把复杂的信息整理清楚，让每一个结论都经得起追问',
        },
        0.57,
      );
      if (stats().visible) schemed++;
    }
  }
  check('口播套装三画幅首尾 Alpha 全透明', endpoints === 120, { samples: endpoints });
  check('口播套装三画幅中段可见 / 外部透明', mids === 60, { samples: mids });
  check('口播套装 20 种独立画面 / 时间变化', signatures.size === 20 && animated === 60, {
    unique: signatures.size,
    animated,
  });
  check('口播位置 / 尺寸 / 动感边界组合', stress === 1080, { samples: stress });
  check('口播七方案 / 长中文渲染', schemed === 140, { samples: schemed });
  const vals = [{ value: 45 }, { value: 30 }, { value: 15 }, { value: 10 }],
    tiles = splitTiles(vals, 0, 0, 472, 351),
    area = 472 * 351;
  check(
    '资金模块面积与真实占比一致',
    tiles.every((r, i) => Math.abs((r.w * r.h) / area - vals[i].value / 100) < 1e-9) &&
      Math.abs(tiles.reduce((n, r) => n + r.w * r.h, 0) - area) < 1e-6,
  );
  const chart = storyEffects.find((e) => e.id === 's-trend');
  check(
    '折线拒绝负数 / 9 项 / 非数值',
    !!validateBody(chart, '甲:-2\n乙:3') &&
      !!validateBody(chart, Array.from({ length: 9 }, (_, i) => '项' + i + ':3').join('\n')) &&
      !!validateBody(chart, '甲:abc\n乙:3'),
  );
  [c.width, c.height] = dimensions('9:16', 360);
  const probe = (id, x, y) => {
    const e = storyEffects.find((e) => e.id === id);
    renderFrame(c, e, defaults(e), 0.55);
    return (
      ctx.getImageData(Math.round(180 + (x * 360) / 660), Math.round(320 + (y * 360) / 660), 1, 1)
        .data[3] === 0
    );
  };
  check(
    '讲解窗 / 分屏 / 横素材窗真实透明孔',
    probe('s-pip', 151, -303) && probe('s-split', -140, 0) && probe('s-broll', 0, 0),
  );
  const source = document.createElement('canvas');
  source.width = 180;
  source.height = 180;
  const sc = source.getContext('2d');
  sc.fillStyle = '#fe01aa';
  sc.beginPath();
  sc.arc(90, 90, 80, 0, Math.PI * 2);
  sc.fill();
  let uploads = 0;
  for (const e of storyEffects.filter((e) => e.imageRole)) {
    renderFrame(c, e, defaults(e), 0.55);
    const hash = crc32(pixels());
    renderFrame(c, e, { ...defaults(e), image: source }, 0.55);
    if (hash !== crc32(pixels())) uploads++;
  }
  check('6 个图片模板真实图像源替换', uploads === 6, { samples: uploads });
  const shot = storyEffects.find((e) => e.id === 's-treemap');
  renderFrame(c, shot, defaults(shot), 0.55);
  const blob = await toPNG(c),
    bitmap = await createImageBitmap(blob);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(bitmap, 0, 0);
  const rgba = stats();
  check('口播模块 PNG 解码 Alpha', rgba.clear > 0 && rgba.visible > 0, {
    ...rgba,
    bytes: blob.size,
  });
  bitmap.close();
  [c.width, c.height] = dimensions('9:16', 180);
  const seq = await exportSequence({
      canvas: c,
      effect: shot,
      settings: { ...defaults(shot), duration: 2 },
      fps: 24,
      render: renderFrame,
      signal: new AbortController().signal,
      onProgress: () => {},
    }),
    bytes = new Uint8Array(await seq.blob.arrayBuffer()),
    v = new DataView(bytes.buffer);
  let off = 0,
    n = 0,
    ok = true;
  while (v.getUint32(off, true) === 0x04034b50) {
    const len = v.getUint32(off + 18, true),
      nl = v.getUint16(off + 26, true),
      extra = v.getUint16(off + 28, true),
      start = off + 30 + nl + extra;
    ok &&= v.getUint32(off + 14, true) === crc32(bytes.slice(start, start + len));
    off = start + len;
    n++;
  }
  check('口播 48 帧透明序列 ZIP / CRC', ok && n === 50, { entries: n, bytes: bytes.length });
}
