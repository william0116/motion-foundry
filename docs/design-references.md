# 设计参考与来源边界

Motion Foundry 围绕常见的视频表达任务组织模板：建立标题、突出重点、解释数据、展示证据、切换章节。以下链接记录项目早期研究的参考入口，不是产品功能对比或对其当前价格、能力的保证。

## 产品设计参考

- [Jitter 模板库](https://jitter.video/templates/all/)：用于研究模板分类与动画预览入口。
- [Animation Composer](https://misterhorse.com/animation-composer-for-premiere)：用于研究“选择、替换、复用”的动效工作方式。
- [Canva 文字动画](https://www.canva.com/features/text-animations/)：用于研究低门槛的效果命名与直接修改内容的交互。
- [Motion Array 动效模板](https://motionarray.com/motion-graphics-templates/)：用于研究按用途、素材类型与画幅组织模板。

项目未随附上述产品的商业模板或素材；参考来源不代表授权、合作或背书。

## 解说视频的视觉参考

早期研究对以下视频的部分关键画面进行观察，用来理解“人物主导、证据主导、图解主导”之间的切换。不是逐帧复刻、完整转写、音效复刻或新闻真实性核验。

- [Deepseek突然连融两轮500亿，梁文锋到底想干嘛？](https://www.bilibili.com/video/BV18Ut76rEdb/)
- [韩股腰斩崩盘，背后的“推手”是…？](https://www.bilibili.com/video/BV1dL8J6ZEV8/)
- [Kimi K3是咋回事？怎么就让美国“吵”起来了？](https://www.bilibili.com/video/BV1TZ3x6SEKM/)

对应的独立实现包括报道摘录卡、分层数据图、关系连线、观点对照、章节角标与透明人物窗框。`story-effects.js` 保留参考链接和观察时间点，便于区分设计依据与当前实现。

## 本项目没有提供的参考素材

参考视频、人物肖像、声音、第三方截图、平台账号资料和商业字体均未作为内置素材提供。图片占位需由使用者替换为有权使用的素材。

透明窗框并不意味着已实现人物视频抠像；截图加摘录不意味着已实现 OCR；图表聚焦不意味着接入实时行情或判断因果。具体能力边界以[使用指南](usage.md)和实际输入控件为准。
