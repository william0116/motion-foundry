# 动效工坊内部原型

静态 HTML/CSS/JavaScript，浏览器 Canvas 2D 渲染，无运行时依赖、外部字体、AI 请求或用户素材上传。需要通过 HTTP 服务访问，不能直接双击 file:// 文件加载 ES Modules。

本地：在本目录运行 `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist`，打开 http://127.0.0.1:4173/ 。

自检页面：`/qa.html`，点击运行，覆盖 24 个模板、三个画幅、五个时间点、确定性渲染、PNG 解码 Alpha、48 帧 ZIP CRC、取消及输入校验。自检不替代目标剪辑软件验收。

导出真实 PNG 序列 ZIP 和当前帧 PNG。透明 MOV、AI、团队共享尚未实现。页面刷新丢失当前编辑；收藏/最近使用仅本浏览器保存。使用系统中文字体，不承诺跨系统像素完全一致。

核心文件：data.js 定义模板与校验，renderer.js 负责确定性绘制，exporter.js 负责 PNG 和无压缩 ZIP 容器，workbench.js 负责交互。
