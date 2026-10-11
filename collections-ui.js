import { schemes } from './schemes.js';
import { effects, categories } from './data.js';
export function mountCollections() {
  const shelf = document.createElement('nav');
  shelf.className = 'collection-tabs';
  shelf.setAttribute('aria-label', '动效合集');
  for (const [id, name, count] of [
    ['all', '全部动效', effects.length],
    ['story', '口播解说套装', effects.filter((e) => e.collection === 'story').length],
    ['new', '形式扩展包', effects.filter((e) => e.release === 3).length],
    ['portrait', '竖版卡片', effects.filter((e) => e.category === 'portrait').length],
    ['lexseek', 'LexSeek 套装', effects.filter((e) => e.category === 'lexseek').length],
  ]) {
    const b = document.createElement('button');
    b.dataset.collection = id;
    b.textContent = name;
    const small = document.createElement('small');
    small.textContent = count;
    b.append(small);
    shelf.append(b);
  }
  document.querySelector('.search-row').before(shelf);
  const format = document.createElement('select');
  format.id = 'formatFilter';
  format.setAttribute('aria-label', '筛选默认画幅');
  for (const [value, label] of [
    ['all', '全部画幅'],
    ['9:16', '默认竖屏'],
    ['16:9', '默认横屏'],
  ]) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    format.append(opt);
  }
  document.querySelector('.search-row').append(format);
  const guide = document.createElement('p');
  guide.id = 'libraryGuide';
  guide.className = 'library-guide';
  guide.textContent = '支持按用途搜索：口播、开场、知识、产品、互动、转场。所有动效均可切换画幅。';
  document.querySelector('.search-row').after(guide);
  document.getElementById('search').placeholder = '搜名称或用途，如：口播、图表、开场…';
  const fields = document.createElement('div');
  fields.id = 'extraContent';
  const field = (label, id, tag = 'input') => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.append(document.createTextNode(label));
    const input = document.createElement(tag);
    input.id = id;
    wrap.append(input);
    fields.append(wrap);
    return input;
  };
  field('小标签', 'badgeInput').maxLength = 20;
  const body = field('正文 / 要点', 'bodyInput', 'textarea');
  body.maxLength = 180;
  body.rows = 4;
  const hint = document.createElement('p');
  hint.id = 'bodyHint';
  hint.className = 'setting-note';
  fields.append(hint);
  const error = document.createElement('p');
  error.id = 'bodyError';
  error.className = 'validation';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  fields.append(error);
  document.getElementById('uploadLabel').before(fields);
  const row = document.createElement('label');
  row.className = 'field';
  row.textContent = '动效配色方案';
  const select = document.createElement('select');
  select.id = 'schemeSelect';
  for (const s of schemes) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.append(opt);
  }
  row.append(select);
  const note = document.createElement('p');
  note.id = 'schemeNote';
  note.className = 'setting-note';
  row.append(note);
  document.querySelector('.settings .setting-row').before(row);
  const safe = document.createElement('button');
  safe.id = 'safeButton';
  safe.className = 'safe-toggle';
  safe.textContent = '短视频参考安全区';
  safe.setAttribute('aria-pressed', 'false');
  document.querySelector('.preview-toolbar').after(safe);
  const safeGuide = document.createElement('div');
  safeGuide.id = 'safeGuide';
  safeGuide.className = 'safe-guide';
  safeGuide.hidden = true;
  safeGuide.setAttribute('aria-hidden', 'true');
  safeGuide.textContent = '内容参考区';
  document.getElementById('previewStage').append(safeGuide);
  const cardNote = document.createElement('p');
  cardNote.id = 'cardNote';
  cardNote.className = 'setting-note card-note';
  cardNote.textContent = '卡片外透明 · 卡片底色保留 · 安全区不导出';
  document.querySelector('.playback').after(cardNote);
  const reference = document.createElement('div');
  reference.id = 'referenceNote';
  reference.className = 'reference-note';
  reference.hidden = true;
  cardNote.after(reference);
  const expand = document.createElement('button');
  expand.id = 'expandPreview';
  expand.className = 'expand-preview';
  expand.textContent = '放大';
  expand.setAttribute('aria-label', '放大动效预览');
  document.getElementById('previewStage').append(expand);
  const dialog = document.createElement('dialog');
  dialog.id = 'largePreviewDialog';
  dialog.className = 'large-preview-dialog';
  dialog.setAttribute('aria-labelledby', 'largePreviewTitle');
  dialog.innerHTML =
    '<div class="modal-head"><h2 id="largePreviewTitle">动效放大预览</h2><button id="closeLargePreview" class="secondary">关闭预览</button></div><div class="large-preview-stage checker"><canvas id="largePreviewCanvas" width="540" height="960"></canvas></div><p class="small-note">与导出共用渲染器 · 背景棋盘格不会导出</p>';
  document.body.append(dialog);
  document.querySelector('.library-foot').lastElementChild.textContent =
    `${categories.length} 个类型 · 品牌方案可选 · GIF / 透明 PNG`;
  const help = document.querySelector('#helpDialog .small-note');
  help.textContent = `${effects.length} 个动画预设，${categories.length} 个类型。支持本地生成 GIF、PNG 单帧与透明 PNG 序列。配色只作用于当前动效；字幕为固定节奏，波形不随音频变化，转场为覆盖层。编辑内容刷新后会丢失；AI 生成、透明 MOV 与团队共享尚未实现。`;
}
