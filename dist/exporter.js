const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
// ZIP STORE: PNG already compresses pixels. Keeping bytes unchanged avoids a third-party codec.
export function zipFiles(files) {
  const parts = [],
    central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const n = encoder.encode(name),
      crc = crc32(data);
    const local = new Uint8Array(30 + n.length),
      v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, n.length, true);
    local.set(n, 30);
    parts.push(local, data);
    const header = new Uint8Array(46 + n.length),
      d = new DataView(header.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint16(8, 0x800, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, data.length, true);
    d.setUint32(24, data.length, true);
    d.setUint16(28, n.length, true);
    d.setUint32(42, offset, true);
    header.set(n, 46);
    central.push(header);
    offset += local.length + data.length;
  }
  const size = central.reduce((s, a) => s + a.length, 0),
    end = new Uint8Array(22),
    v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, files.length, true);
  v.setUint16(10, files.length, true);
  v.setUint32(12, size, true);
  v.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
export const toPNG = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败，请降低分辨率重试。'))),
      'image/png',
    ),
  );
export function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  return url;
}
export async function exportSequence({
  canvas,
  effect,
  settings,
  fps,
  render,
  signal,
  onProgress,
}) {
  const count = settings.duration * fps,
    files = [];
  for (let i = 0; i < count; i++) {
    if (signal.aborted) throw new DOMException('已取消导出', 'AbortError');
    render(canvas, effect, settings, i / Math.max(1, count - 1));
    const blob = await toPNG(canvas);
    files.push({
      name: `frames/frame_${String(i).padStart(5, '0')}.png`,
      data: new Uint8Array(await blob.arrayBuffer()),
    });
    onProgress(i + 1, count);
    await new Promise((r) => setTimeout(r, 0));
  }
  if (signal.aborted) throw new DOMException('已取消导出', 'AbortError');
  const { image, ...config } = settings;
  const metadata = {
    effect: effect.id,
    width: canvas.width,
    height: canvas.height,
    fps,
    frameCount: count,
    durationSeconds: settings.duration,
    alpha: 'RGBA PNG; no checkerboard encoded',
    imageAttached: !!image,
    settings: config,
  };
  files.push(
    { name: 'manifest.json', data: encoder.encode(JSON.stringify(metadata, null, 2)) },
    {
      name: 'README.txt',
      data: encoder.encode(
        `动效工坊 · 透明动画素材\n\n1. 解压 ZIP；frames 文件夹内为连续编号的透明 PNG。\n2. 在支持 PNG 图片序列的剪辑软件中，以图片序列方式导入 frame_00000.png。\n3. 设置素材解释帧率为 ${fps} fps，时长为 ${settings.duration} 秒。\n4. 放到主视频上方轨道。背景棋盘格没有写入图片。\n\n分辨率：${canvas.width} × ${canvas.height}\n该文件不是 MOV。不同剪辑软件的序列导入能力不同，请先验证。\n`,
      ),
    },
  );
  return { blob: zipFiles(files), metadata };
}
