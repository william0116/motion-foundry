import { effects, defaults, dimensions, validateBody, validateContent } from './data.js';
import { expandedEffects } from './expanded-effects.js';
import { schemes } from './schemes.js';
import { renderFrame } from './renderer.js';
import { crc32, toPNG, exportSequence } from './exporter.js';
export async function testExpanded(check) {
  const c = document.createElement('canvas');
  [c.width, c.height] = dimensions('9:16', 240);
  const pixels = () => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const counts = () => {
    let clear = 0,
      fg = 0;
    const d = pixels();
    for (let i = 3; i < d.length; i += 4) d[i] ? fg++ : clear++;
    return { clear, fg };
  };
  check(
    'v0.3 保留 46 种独立形式 / 全库 ID 唯一',
    expandedEffects.length === 46 &&
      effects.length >= 88 &&
      new Set(effects.map((x) => x.id)).size === effects.length,
  );
  check(
    '全部预设默认内容通过校验',
    effects.every((e) => !validateContent(e, e.title) && !validateBody(e, e.body)),
  );
  let endpoints = 0,
    visible = 0,
    animated = 0,
    cuts = 0,
    stress = 0;
  const still = [];
  for (const e of expandedEffects) {
    const s = defaults(e);
    for (const ratio of ['16:9', '9:16', '1:1']) {
      [c.width, c.height] = dimensions(ratio, 180);
      for (const p of [0, 1]) {
        renderFrame(c, e, { ...s, ratio }, p);
        if (counts().fg === 0) endpoints++;
      }
      renderFrame(c, e, { ...s, ratio }, 0.5);
      const middle = counts();
      if (middle.fg > 0 && (e.category === 'transition' || middle.clear > 0)) visible++;
      if (e.category === 'transition') {
        if (pixels().every((v, i) => i % 4 !== 3 || v === 255)) cuts++;
      }
      renderFrame(c, e, { ...s, ratio }, 0.12);
      const hash = crc32(pixels());
      renderFrame(c, e, { ...s, ratio }, 0.61);
      if (hash !== crc32(pixels())) animated++;
      else still.push({ id: e.id, ratio });
      for (const position of ['top', 'center', 'bottom'])
        for (const scale of [60, 100, 130]) {
          renderFrame(c, e, { ...s, ratio, position, scale }, 0.55);
          if (counts().fg > 0) stress++;
        }
    }
  }
  check('新增全部首尾透明', endpoints === 46 * 3 * 2, { samples: endpoints });
  check('新增全部中段可见且非转场外部透明', visible === 46 * 3, { samples: visible });
  check('新增动画中段随时间变化', animated === 46 * 3, { samples: animated, still });
  check('6 种新增转场三画幅中点完全不透明', cuts === 18, { samples: cuts });
  let allCuts = 0;
  for (const e of effects.filter((x) => x.category === 'transition'))
    for (const ratio of ['16:9', '9:16', '1:1'])
      for (const intensity of [0, 60, 100]) {
        [c.width, c.height] = dimensions(ratio, 180);
        renderFrame(c, e, { ...defaults(e), ratio, intensity }, 0.5);
        if (pixels().every((v, i) => i % 4 !== 3 || v === 255)) allCuts++;
      }
  check('新旧 9 种转场的切点不受动感设置影响', allCuts === 81, { samples: allCuts });
  check('新增位置 / 尺寸 / 三画幅回归', stress === 46 * 3 * 9, { samples: stress });
  const series = effects.find((e) => e.id === 'x-donut'),
    flow = effects.find((e) => e.id === 'x-flow');
  check(
    '数据格式 / 负数 / 全零 / 超限被拒绝',
    ['甲:-3\n乙:5', '甲:0\n乙:0', '甲:1\n坏行', '甲:1000000\n乙:2', '甲:2'].every(
      (b) => !!validateBody(series, b),
    ) && !validateBody(series, '甲:2.5\n乙：7.5'),
  );
  check(
    '步骤为空或超过版式数量被拒绝',
    !!validateBody(flow, '') &&
      !!validateBody(flow, '1\n2\n3\n4\n5') &&
      !validateBody(flow, '一步'),
  );
  check(
    '新数值组件类型校验',
    !!validateContent(
      effects.find((e) => e.id === 'x-gauge'),
      '101',
    ) &&
      !!validateContent(
        effects.find((e) => e.id === 'x-odometer'),
        '2.5',
      ),
  );
  [c.width, c.height] = dimensions('9:16', 360);
  let styleSamples = 0;
  for (const e of expandedEffects.filter((e) => e.category !== 'transition'))
    for (const scheme of schemes) {
      const s = {
        ...defaults(e),
        scheme: scheme.id,
        title: e.numeric ? e.title : '把复杂的信息整理成清晰的思路，让每一份表达都能被看见',
      };
      renderFrame(c, e, s, 0.61);
      if (counts().fg > 0) styleSamples++;
    }
  check('7 方案 / 长中文组合渲染', styleSamples === 40 * 7, { samples: styleSamples });
  const photo = effects.find((e) => e.id === 'x-photo'),
    source = document.createElement('canvas');
  source.width = 90;
  source.height = 160;
  const ctx = source.getContext('2d');
  ctx.fillStyle = '#fe01aa';
  ctx.fillRect(0, 0, 90, 160);
  renderFrame(c, photo, defaults(photo), 0.55);
  const placeholder = crc32(pixels());
  renderFrame(c, photo, { ...defaults(photo), image: source }, 0.55);
  check(
    '替换真实图像源后画面发生变化',
    placeholder !== crc32(pixels()) &&
      pixels().some((v, i, d) => i % 4 === 0 && v === 254 && d[i + 1] === 1 && d[i + 2] === 170),
  );
  const blob = await toPNG(c),
    bmp = await createImageBitmap(blob),
    decoded = document.createElement('canvas');
  decoded.width = bmp.width;
  decoded.height = bmp.height;
  decoded.getContext('2d').drawImage(bmp, 0, 0);
  const d = decoded.getContext('2d').getImageData(0, 0, bmp.width, bmp.height).data;
  let clear = 0,
    opaque = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) clear++;
    if (d[i] === 255) opaque++;
  }
  check('新增图片动画 PNG 重新解码保留 Alpha', { clear, opaque }.clear > 0 && opaque > 0, {
    width: bmp.width,
    height: bmp.height,
    clear,
    opaque,
    bytes: blob.size,
  });
  bmp.close();
  [c.width, c.height] = dimensions('16:9', 240);
  const sequence = await exportSequence({
    canvas: c,
    effect: series,
    settings: { ...defaults(series), duration: 2, body: '已完成:72\n待完成:28' },
    fps: 24,
    render: renderFrame,
    signal: new AbortController().signal,
    onProgress: () => {},
  });
  const bytes = new Uint8Array(await sequence.blob.arrayBuffer()),
    v = new DataView(bytes.buffer);
  let off = 0,
    n = 0,
    ok = true,
    manifest = null;
  const dec = new TextDecoder();
  while (v.getUint32(off, true) === 0x04034b50) {
    const len = v.getUint32(off + 18, true),
      nl = v.getUint16(off + 26, true),
      el = v.getUint16(off + 28, true),
      start = off + 30 + nl + el,
      name = dec.decode(bytes.slice(off + 30, off + 30 + nl));
    ok &&= v.getUint32(off + 14, true) === crc32(bytes.slice(start, start + len));
    if (name.endsWith('manifest.json'))
      manifest = JSON.parse(dec.decode(bytes.slice(start, start + len)));
    off = start + len;
    n++;
  }
  check(
    '新图表 48 帧 ZIP / CRC / 用户数据快照',
    ok && n === 50 && manifest?.settings.body === '已完成:72\n待完成:28',
    { entries: n, bytes: bytes.length },
  );
}
