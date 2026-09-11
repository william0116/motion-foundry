# 模板扩展指南

模板定义负责“有什么可改”，渲染器负责“每一帧怎样画”。不要只新增一张预览卡片而没有对应的绘制实现。

## 选择接入位置

- 基础标题、标注等：`dist/data.js` 的基础条目与 `dist/renderer.js`。
- 竖版卡片：`dist/extra-effects.js` 与 `dist/card-renderer.js`。
- 文字、图表、流程、图片等扩展形式：`dist/expanded-effects.js` 与 `dist/expanded-renderer.js`。
- 解说证据卡、图表聚焦和人物窗框：`dist/story-effects.js` 与 `dist/story-renderer.js`。

`data.js` 汇总全部模板。模板 ID 必须稳定且全库唯一，否则收藏、最近使用、测试与导出清单会混淆。删除或重命名已有 ID 前先讨论兼容性。

## 示例：在已有渲染形式上增加预设

以下条目可放入 `expanded-effects.js` 的 `expandedEffects` 数组，复用已经实现的 `cascade` 渲染形式：

```js
make('my-cascade', '重点逐字出现', 'text', 'cascade', '让重点逐步出现', 'ONE IDEA AT A TIME', {
  ratio: '9:16',
  duration: 3,
  scheme: 'mint',
  tags: '口播 标题 重点',
  release: 5,
  isNew: false,
}),
```

`make` 会生成带 `x-` 前缀的 ID，设置 `engine: 'expanded'`。这只是**复用形式的预设**，不是新动画机制。示例中的 `release` 是合集筛选元数据，不是软件版本；不要直接沿用旧的 `release: 3` 默认值，把新贡献误计入历史“形式扩展包”。

如果贡献的是新的运动形式，需新增 `variant` 对应绘制分支，不能指向不存在的变体。扩展渲染器还按 `category` 组织逻辑，应将分支放在相应分类内。

## 常用字段

| 字段                                 | 约定                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| `id`、`name`、`category`             | 唯一标识、显示名称、已有分类 ID                         |
| `engine`、`variant` / `kind`         | 与真实渲染分支一致；不同模板家族使用不同派发字段        |
| `title`、`subtitle`、`body`、`badge` | 默认示例内容，不含真实个人或客户数据                    |
| `ratio`、`duration`                  | 默认画幅与时长；仍需检查三种画幅                        |
| `scheme`、`color`                    | 有效配色 ID、自由配色强调色                             |
| `bodyMode`、`maxLines`               | `text` / `lines` / `series`；行数上限必须与绘制容量一致 |
| `numeric`                            | 需要时指定 `percent` 或 `integer`，匹配输入校验         |
| `imageRole`、`tags`                  | 可替换图片的用途说明、搜索关键词                        |
| `usage`、`collection`                | 按已有界面逻辑使用；不代表任意字符串都会创建新合集      |

修改字段能力时，同时检查 `defaults`、`validateContent`、`validateBody` 和工作台控件更新逻辑。当前不是 JSON 插件系统，不能只上传一个模板配置就上线任意新效果。

## 渲染契约

```js
renderFrame(canvas, effect, settings, progress);
```

- `progress` 为 0–1；同一画布尺寸、模板、设置和进度，应得到相同帧。
- 每帧先清空画布；成对使用 `save()` / `restore()`，避免透明度、变换和裁切状态污染后续绘制。
- 使用 `canvas.width` / `height` 计算画幅；预览缩略图与高清导出不得使用不同设计逻辑。
- 不绘制预览棋盘格、安全区或编辑器控件。
- 动画起止、面板底色和透明窗口要符合模板用途；覆盖转场在中点必须真正遮住底层画面。
- 不在帧内请求网络或读取真实时间；需要随机视觉时，用稳定的种子或确定性公式。
- 长文本须缩放、换行或明确报错，不静默吞掉关键内容。图表不能用装饰性假数据冒充计算结果。

## 验证与文档

1. 使用 16:9、9:16、1:1，检查起止和中间帧。
2. 检查最长中文、空值、数据超限、不同配色和图片比例。
3. 在对应 `*-tests.js` 中加入专项断言；全库采样只能证明基础可渲染，不能代替新模板的设计验收。
4. 导出 PNG 序列和 GIF，确认预览一致性、透明孔和边缘质量。
5. 运行完整检查；如果数量或能力发生变化，同步更新 README。

当前模板随代码部署。[发布流程](deployment.md)确认后更新 `prod`，服务端部署完整静态目录；浏览器无需数据库迁移。
