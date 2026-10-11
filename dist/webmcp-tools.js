// WebMCP tools that let a browser-embedded AI complete the full
// select → configure → export loop. The export tools are standalone:
// they render and encode with the same deterministic renderer and
// exporters as the UI, but do not depend on workbench UI state.
import {
  effects,
  defaults,
  dimensions,
  validateContent,
  validateBody,
  categories,
} from './data.js';
import { schemes } from './schemes.js';
import { renderFrame } from './renderer.js';
import { toPNG, download, exportSequence } from './exporter.js';
import { exportGIF } from './gif-exporter.js';

const categoryName = (id) => categories.find((c) => c[0] === id)?.[2] || id;
// Matches the UI: duration options, positions, and valid export parameters.
const DURATIONS = [2, 3, 5];
const FRAME_RESOLUTIONS = ['720', '1080'];
const SEQUENCE_RESOLUTIONS = ['720', '1080'];
const SEQUENCE_FPS = ['24', '25', '30'];
const GIF_RESOLUTIONS = ['360', '480', '720'];
const GIF_FPS = ['10', '15', '20'];
const BACKGROUNDS = ['transparent', 'white', 'black'];
const POSITIONS = ['top', 'center', 'bottom'];

// Standalone export task registry. Tasks run off the UI state; resolve_export
// polls progress/result and can cancel the underlying AbortController.
const tasks = new Map();
let nextTask = 1;

function fieldInfo(effect) {
  const fields = [];
  const notes = [];
  if (effect.category !== 'transition') {
    fields.push({
      key: 'title',
      label: '主标题',
      maxLength: 40,
      required: true,
      note: effect.numeric
        ? effect.numeric === 'percent'
          ? '0–100 的数字'
          : effect.numeric === 'integer'
            ? '0–999999 的整数'
            : '数字'
        : effect.id === 'bars'
          ? '2–6 个数字，用逗号分隔，每项不超过 999999'
          : '正文文字',
    });
  }
  if (effect.subtitle || effect.engine || effect.kind)
    fields.push({ key: 'subtitle', label: '辅助文字', maxLength: 70, required: false });
  if (effect.bodyMode === 'series')
    fields.push({
      key: 'body',
      label: '数据（每行 名称:数值）',
      maxLength: 180,
      required: true,
      note: `2–${effect.maxLines} 行，名称最多 12 字，数值 0–999999，至少一项大于 0，不支持负数`,
    });
  else if (effect.bodyMode === 'lines')
    fields.push({
      key: 'body',
      label: '正文（每行一项）',
      maxLength: 180,
      required: true,
      note: `1–${effect.maxLines} 行，每行一项`,
    });
  else if (effect.bodyMode === 'text')
    fields.push({
      key: 'body',
      label: '正文',
      maxLength: 180,
      required: false,
      note: '支持换行，最多 180 字',
    });
  if (effect.badge || (effect.engine && effect.category === 'portrait'))
    fields.push({ key: 'badge', label: '标签', maxLength: 20, required: false });
  if (effect.imageRole)
    fields.push({
      key: 'image',
      label: effect.imageRole,
      required: false,
      note: '本地图片；AI 导出时保持为空，用户可稍后上传',
    });
  return { fields, notes };
}

function outputInfo(effect) {
  const portrait = (effect.ratio || '16:9').startsWith('9:16');
  return {
    ratios: ['16:9', '9:16', '1:1'],
    defaultRatio: effect.ratio || '16:9',
    durations: DURATIONS,
    schemes: schemes.map((s) => s.id),
    defaultScheme: effect.scheme || 'free',
    formats: effect.category === 'transition' ? ['sequence', 'gif'] : ['frame', 'sequence', 'gif'],
    pngFrame: { resolutions: FRAME_RESOLUTIONS.map(Number) },
    pngSequence: { resolutions: SEQUENCE_RESOLUTIONS.map(Number), fps: SEQUENCE_FPS.map(Number) },
    gif: {
      resolutions: GIF_RESOLUTIONS.map(Number),
      fps: GIF_FPS.map(Number),
      backgrounds: BACKGROUNDS,
    },
    transparent: 'PNG single frame and PNG sequence keep full RGBA; GIF uses binary alpha.',
    note: portrait ? '默认竖屏 9:16' : '默认横屏 16:9',
  };
}

export function describeTemplate(effectId) {
  const effect = effects.find((e) => e.id === effectId);
  if (!effect) throw new Error('未找到该动效');
  return {
    id: effect.id,
    name: effect.name,
    category: effect.category,
    categoryName: categoryName(effect.category),
    style: effect.style,
    collection: effect.collection || null,
    tags: effect.tags || '',
    usage: effect.usage || null,
    source: effect.source || null,
    fieldInfo: fieldInfo(effect),
    output: outputInfo(effect),
    bodyMode: effect.bodyMode || null,
    maxLines: effect.maxLines || null,
    numeric: effect.numeric || null,
  };
}

// Standalone export. Does not touch workbench selection or settings; render
// and encode run through the same functions the UI uses, so preview and
// exported frames are deterministic. Returns a task id for resolve_export.
export function startExport({
  effectId,
  title,
  subtitle,
  body,
  badge,
  scheme,
  ratio,
  duration,
  format = 'sequence',
  resolution = format === 'gif' ? 480 : 1080,
  fps = format === 'gif' ? 15 : 25,
  gifBackground = 'transparent',
  progress = 0.3,
  download: shouldDownload = true,
}) {
  if (typeof effectId !== 'string') throw new Error('参数 effectId 缺失');
  const effect = effects.find((e) => e.id === effectId);
  if (!effect) throw new Error('未找到该动效');
  if (!['frame', 'sequence', 'gif'].includes(format)) throw new Error('导出格式无效');
  if (ratio !== undefined && !['16:9', '9:16', '1:1'].includes(ratio)) throw new Error('画幅无效');
  if (scheme !== undefined && !schemes.some((s) => s.id === scheme))
    throw new Error('配色方案无效');
  if (duration !== undefined && !DURATIONS.includes(Number(duration)))
    throw new Error('时长仅支持 2、3、5 秒');
  const settings = { ...defaults(effect), image: null };
  if (title !== undefined) settings.title = title;
  if (subtitle !== undefined) settings.subtitle = subtitle;
  if (body !== undefined) settings.body = body;
  if (badge !== undefined) settings.badge = badge;
  if (scheme !== undefined) settings.scheme = scheme;
  if (ratio !== undefined) settings.ratio = ratio;
  if (duration !== undefined) settings.duration = Number(duration);
  const contentError =
    validateContent(effect, settings.title) || validateBody(effect, settings.body ?? '');
  if (contentError) throw new Error(contentError);
  const res = Number(resolution);
  const allowed = format === 'gif' ? GIF_RESOLUTIONS : FRAME_RESOLUTIONS;
  if (!allowed.includes(String(res))) throw new Error(`分辨率仅支持 ${allowed.join('、')} 短边`);
  if (format !== 'frame' && !(format === 'gif' ? GIF_FPS : SEQUENCE_FPS).includes(String(fps)))
    throw new Error('帧率无效');
  if (format === 'gif' && !BACKGROUNDS.includes(gifBackground)) throw new Error('GIF 背景无效');
  const controller = new AbortController();
  const taskId = `export-${nextTask++}`;
  tasks.set(taskId, { controller, status: 'running', progress: [0, 0], result: null, error: null });
  const run = async () => {
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = dimensions(settings.ratio, res);
    const task = tasks.get(taskId);
    const onProgress = (done, total) => {
      const t = tasks.get(taskId);
      if (t) t.progress = [done, total];
    };
    let blob, metadata;
    if (format === 'frame') {
      renderFrame(canvas, effect, settings, progress);
      blob = await toPNG(canvas);
      metadata = { format: 'PNG', width: canvas.width, height: canvas.height, frameCount: 1 };
    } else {
      const exporter = format === 'gif' ? exportGIF : exportSequence;
      const result = await exporter({
        canvas,
        effect,
        settings,
        fps,
        background: gifBackground,
        render: renderFrame,
        signal: controller.signal,
        onProgress,
      });
      blob = result.blob;
      metadata = result.metadata;
    }
    if (controller.signal.aborted) throw new DOMException('已取消导出', 'AbortError');
    const extension =
      format === 'sequence'
        ? `-${fps}fps.zip`
        : format === 'gif'
          ? `-${fps}fps-${metadata.background}.gif`
          : '.png';
    const filename = `motion-${effect.id}-${canvas.width}x${canvas.height}${extension}`;
    if (shouldDownload) download(blob, filename);
    const current = tasks.get(taskId);
    if (current) {
      current.status = 'done';
      current.result = { ...metadata, filename, bytes: blob.size };
    }
  };
  run().catch((error) => {
    const t = tasks.get(taskId);
    if (t && t.status === 'running') {
      t.status = 'error';
      t.error = error.name === 'AbortError' ? '已取消导出' : error.message || '导出失败';
    }
  });
  return {
    taskId,
    status: 'running',
    format,
    effectId,
    estimateFrames: Math.round(settings.duration * fps),
  };
}

export function resolveExport(taskId, action = 'query') {
  const task = tasks.get(taskId);
  if (!task) throw new Error('未找到该导出任务');
  if (action === 'cancel' && task.status === 'running') {
    task.controller.abort();
    task.status = 'cancelled';
  }
  return {
    taskId,
    status: task.status,
    progress:
      task.status === 'running' ? { done: task.progress[0], total: task.progress[1] } : null,
    result: task.result,
    error: task.error,
  };
}

export function registerWebMCPTools(register) {
  register({
    name: 'describe_template',
    title: '查看动效模板说明',
    description:
      'Return one template’s editable fields, input formats and export options without changing the workbench.',
    inputSchema: {
      type: 'object',
      properties: { effectId: { type: 'string', enum: effects.map((e) => e.id) } },
      required: ['effectId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input) => {
      if (!input || typeof input.effectId !== 'string') throw new Error('参数 effectId 缺失');
      return describeTemplate(input.effectId);
    },
  });
  register({
    name: 'export_motion',
    title: '导出动效素材',
    description:
      'Render and export a template as PNG single frame, transparent PNG sequence ZIP, or GIF. Runs standalone with the given content and export options; returns a task id to poll with resolve_export. May start a browser download when download is true.',
    inputSchema: {
      type: 'object',
      properties: {
        effectId: { type: 'string', enum: effects.map((e) => e.id) },
        title: { type: 'string', maxLength: 40 },
        subtitle: { type: 'string', maxLength: 70 },
        body: { type: 'string', maxLength: 180 },
        badge: { type: 'string', maxLength: 20 },
        scheme: { type: 'string', enum: schemes.map((s) => s.id) },
        ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'] },
        duration: { type: 'number', enum: DURATIONS },
        format: { type: 'string', enum: ['frame', 'sequence', 'gif'] },
        resolution: {
          type: 'number',
          enum: [...new Set([...FRAME_RESOLUTIONS, ...GIF_RESOLUTIONS].map(Number))],
        },
        fps: { type: 'number', enum: [...new Set([...SEQUENCE_FPS, ...GIF_FPS].map(Number))] },
        gifBackground: { type: 'string', enum: BACKGROUNDS },
        progress: { type: 'number', minimum: 0, maximum: 1 },
        download: { type: 'boolean' },
      },
      required: ['effectId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: (input) => {
      if (!input || typeof input.effectId !== 'string') throw new Error('参数 effectId 缺失');
      return startExport(input);
    },
  });
  register({
    name: 'resolve_export',
    title: '查询导出任务',
    description:
      'Poll an export_motion task for progress and result, or cancel it with action=cancel. Returns status, progress, result metadata or error.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        action: { type: 'string', enum: ['query', 'cancel'] },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input) => {
      if (!input || typeof input.taskId !== 'string') throw new Error('参数 taskId 缺失');
      return resolveExport(input.taskId, input.action || 'query');
    },
  });
}
