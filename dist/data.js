import { extraEffects } from './extra-effects.js';
import { expandedEffects, parseSeries } from './expanded-effects.js';
import { storyEffects } from './story-effects.js';
export const categories = [
  ['portrait', '▯', '竖版卡片'],
  ['lexseek', 'L', 'LexSeek 套装'],
  ['text', 'T', '文字标题'],
  ['caption', '≋', '动态字幕'],
  ['info', '▤', '信息字幕'],
  ['mark', '↗', '强调标注'],
  ['data', '▥', '数据动画'],
  ['diagram', '⌘', '流程图解'],
  ['media', '▧', '图片展示'],
  ['logo', '◈', 'Logo 演绎'],
  ['transition', '◧', '转场效果'],
  ['decor', '✧', '氛围装饰'],
  ['social', '▣', '社媒组件'],
];
export const colors = [
  ['#c4f36b', '青柠'],
  ['#b8a7ff', '紫罗兰'],
  ['#ffa788', '珊瑚'],
  ['#84d8e8', '冰蓝'],
  ['#f5df82', '奶油'],
  ['#ffffff', '纯白'],
];
const rows = [
  ['elastic', '弹性标题', 'text', '活力', '灵感，即刻发生', 'MAKE IT MOVE.', '#c4f36b'],
  ['wipe', '线条揭幕', 'text', '简约', '每一帧，都出彩', 'A NEW PERSPECTIVE', '#b8a7ff'],
  ['typewriter', '逐字登场', 'text', '科技', '好故事，从这里开始', 'STORY STARTS HERE', '#ffa788'],
  [
    'lowerthird',
    '人物信息条',
    'info',
    '简约',
    '陈一 · 内容创作者',
    '关于创作的一些小事',
    '#84d8e8',
  ],
  ['chapter', '章节卡片', 'info', '品牌', '第一章 · 重新出发', 'CHAPTER 01', '#f5df82'],
  ['location', '地点标签', 'info', '简约', '上海 · 西岸', '31.19° N / 121.46° E', '#b8a7ff'],
  ['underline', '荧光强调', 'mark', '活力', '这个，很重要', '划出你的重点', '#f5df82'],
  ['callout', '箭头标注', 'mark', '简约', '看这里', 'A LITTLE DETAIL', '#84d8e8'],
  ['circle', '手绘圈选', 'mark', '活力', '值得被看见', 'HIGHLIGHT THE MOMENT', '#ffa788'],
  ['counter', '数字增长', 'data', '科技', '98', '完成率 / PERCENT', '#c4f36b'],
  ['progress', '进度环', 'data', '科技', '85', '目标达成', '#b8a7ff'],
  ['bars', '柱状增长', 'data', '品牌', '12,28,45,68', '四个阶段的成长', '#84d8e8'],
  ['orbit', '品牌环绕', 'logo', '品牌', 'MOTION', 'MAKE YOUR MARK', '#b8a7ff'],
  ['logoreveal', 'Logo 显影', 'logo', '品牌', 'STUDIO', 'CREATED TO INSPIRE', '#c4f36b'],
  ['stamp', '印章登场', 'logo', '活力', 'GOOD', 'QUALITY APPROVED', '#ffa788'],
  ['diagonal', '斜切转场', 'transition', '活力', '斜切转场', '全画幅覆盖 → 透明', '#c4f36b'],
  ['shutters', '百叶转场', 'transition', '简约', '百叶转场', '交错展开 → 透明', '#b8a7ff'],
  ['circlewipe', '圆形转场', 'transition', '品牌', '圆形转场', '中心扩散 → 透明', '#84d8e8'],
  ['particles', '星点环绕', 'decor', '科技', '闪光时刻', 'A SPARK OF MAGIC', '#b8a7ff'],
  ['rings', '波纹扩散', 'decor', '简约', '扩散灵感', 'IDEAS IN MOTION', '#84d8e8'],
  ['confetti', '庆祝纸屑', 'decor', '活力', '值得庆祝！', 'LET’S CELEBRATE', '#f5df82'],
  ['message', '消息气泡', 'social', '简约', '嗨，有个新想法', '刚刚 · 来自动效工坊', '#c4f36b'],
  ['search', '搜索框', 'social', '科技', '寻找下一份灵感', 'SEARCH YOUR INSPIRATION', '#84d8e8'],
  ['follow', '关注提醒', 'social', '活力', '关注，保持灵感', '每周分享新鲜创意', '#ffa788'],
];
export const effects = [
  ...rows.map(([id, name, category, style, title, subtitle, color]) => ({
    id,
    name,
    category,
    style,
    title,
    subtitle,
    color,
  })),
  ...extraEffects,
  ...expandedEffects,
  ...storyEffects,
];
export const defaults = (effect) => ({
  title: effect.title,
  subtitle: effect.subtitle,
  body: effect.body || '',
  badge: effect.badge || '',
  scheme: effect.scheme || 'free',
  color: effect.color,
  ratio: effect.ratio || '16:9',
  duration: effect.duration || 3,
  intensity: 60,
  position: 'center',
  scale: 100,
  image: null,
});
export function dimensions(ratio, shortSide) {
  return ratio === '9:16'
    ? [shortSide, Math.round((shortSide * 16) / 9)]
    : ratio === '1:1'
      ? [shortSide, shortSide]
      : [Math.round((shortSide * 16) / 9), shortSide];
}
export function validateBody(effect, body = '') {
  const rows = body.split('\n').filter((x) => x.trim());
  if (effect.bodyMode === 'series') {
    const series = parseSeries(body);
    if (rows.length < 2 || rows.length > effect.maxLines)
      return `请输入 2–${effect.maxLines} 行，每行一个数据项。`;
    if (
      series.some(
        (x) =>
          !x || !x.label || x.label.length > 12 || !Number.isFinite(x.value) || x.value > 999999,
      )
    )
      return '每行填写「名称:数值」，名称最多 12 字，数值为 0–999999；不支持负数。';
    if (!series.some((x) => x.value > 0)) return '至少有一项数值需要大于 0。';
  }
  if (effect.bodyMode === 'lines' && (!rows.length || rows.length > effect.maxLines))
    return `请输入 1–${effect.maxLines} 项，每行一项。`;
  const limit = ['compare', 'question'].includes(effect.kind) ? 2 : 3;
  return ['stack', 'checklist', 'compare', 'question', 'timeline'].includes(effect.kind) &&
    rows.length > limit
    ? `这个版式最多显示 ${limit} 项，请删除多余行或选择其他版式。`
    : '';
}
export function validateContent(effect, title) {
  if (effect.category === 'transition') return '';
  if (!title.trim()) return '请填写主标题后再导出。';
  if (effect.numeric === 'percent' && (!/^\d+(\.\d+)?$/.test(title.trim()) || +title > 100))
    return '请输入 0–100 之间的数字。';
  if (effect.numeric === 'integer' && !/^\d{1,6}$/.test(title.trim()))
    return '滚轮计数器请输入 0–999999 之间的整数。';
  if (
    ['counter', 'progress'].includes(effect.id) &&
    (!/^\d+(\.\d+)?$/.test(title.trim()) || +title > (effect.id === 'progress' ? 100 : 999999999))
  )
    return effect.id === 'progress'
      ? '进度环请输入 0–100 之间的数字。'
      : '数字增长请输入 0–999999999 之间的数字。';
  if (
    effect.id === 'bars' &&
    (!/^\d+(\.\d+)?(\s*[,，]\s*\d+(\.\d+)?){1,5}$/.test(title.trim()) ||
      title.split(/[,，]/).some((n) => +n > 999999))
  )
    return '柱状增长请输入 2–6 个数字，用逗号分隔；每项不超过 999999。';
  return '';
}
