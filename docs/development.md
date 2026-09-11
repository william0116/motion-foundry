# 架构、开发与测试

## 技术选择

应用采用 HTML、CSS、原生 ES Modules 和 Canvas 2D。没有服务端、数据库、框架或构建步骤。`dist/` 是手工维护的源文件；目录名称保留部署兼容性，并不意味着它由其他目录生成。

Node.js 22+ 用于开发工具。`npm start` 只运行仓库内的静态服务脚本，不依赖 `node_modules`；格式化和自动化测试需要 `npm ci`。

## 模块职责

| 模块                                                                     | 职责                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `data.js`、`extra-effects.js`、`expanded-effects.js`、`story-effects.js` | 分类、模板定义、默认参数和校验                                       |
| `workbench.js`                                                           | 当前模板与编辑状态、筛选收藏、预览进度、上传及导出交互               |
| `collections-ui.js`、`schemes.js`                                        | 合集与扩展控件、配色数据                                             |
| `renderer.js`                                                            | `renderFrame(canvas, effect, settings, progress)` 统一入口与基础效果 |
| `card-renderer.js`、`expanded-renderer.js`、`story-renderer.js`          | 按模板类型绘制对应动效                                               |
| `exporter.js`                                                            | Canvas 转 PNG、ZIP STORE 打包、CRC32、导出清单                       |
| `gif-exporter.js`                                                        | 采样共用渲染器、量化调色板、透明处理与 gifenc 调用                   |

编辑状态传给统一渲染入口；预览按播放进度采样，导出按帧数采样。帧绘制不依赖 DOM 动画、墙上时间或未固定的随机源，因此可重复渲染与拖动定位。字体和浏览器栅格化仍会影响跨机器像素结果。

PNG 序列与 GIF 均采样 `i / (frameCount - 1)`，包括起止帧。GIF 的帧延迟按百分之一秒分配，避免 15 fps 的累计时长漂移。ZIP 保持 PNG 数据不变，不二次压缩。

## 本地命令

```sh
npm ci
npm start
npm run format
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

- `start`：在 `127.0.0.1:4173` 提供 `dist/`；端口占用会明确失败，不悄悄换端口。可用 `npm start -- --port 4174` 指定端口。
- `format`：格式化手写 JS、CSS、HTML、Markdown、JSON；排除第三方 vendor 目录和生成物。
- `check`：检查 JavaScript 语法、本地模块及静态资源引用、文档文件链接，并检查格式。
- `test`：Node 内建测试，覆盖模板注册、默认输入、数据边界、CRC/ZIP 和开发服务器路径约束。
- `test:browser`：Playwright 启动无头 Chromium 和临时端口上的隔离服务；不会占用正在运行的工作台端口。每次运行创建独立的 `test-results/` 子目录。

首次安装浏览器需要网络。Linux 如缺少系统库，使用 `npx playwright install --with-deps chromium`；这可能需要系统包管理权限。也可指定已有 Chrome：

```sh
# macOS / Linux
MOTION_BROWSER_CHANNEL=chrome npm run test:browser
```

```powershell
# Windows PowerShell
$env:MOTION_BROWSER_CHANNEL = 'chrome'
npm run test:browser
```

`MOTION_TEST_URL` 可将测试定向到已有本地测试站点；`MOTION_TEST_OUTPUT` 可指定输出的父目录。请不要把自动化导出测试指向陌生网站或有未保存工作的浏览器会话。

## 测试分层

1. **数据与工程检查**：唯一模板 ID、有效分类、默认参数、数值边界、资源引用与静态服务器行为。
2. **浏览器渲染回归**：`/qa.html` 对所有模板的三画幅、五个时间点进行确定性检查，并运行卡片、扩展与解说专项检查。
3. **文件格式与交互**：PNG Alpha、序列 ZIP 条目和 CRC；GIF 帧数、时长、透明、循环和取消；真实下载、错误恢复和对话框布局。
4. **独立解码（可选）**：用 Pillow 读取下载到磁盘的 GIF，再核对帧数、时长、透明度和帧变化。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python tests/verify-gif.py <本次测试输出目录>
```

Windows 对应解释器为 `.venv\Scripts\python.exe`。测试输出目录会打印在浏览器测试日志中；不要将历次文件混放。Pillow 校验针对默认五秒测试样例，改变测试参数时需同步更新断言。

浏览器 QA 在支持 `ImageDecoder` 的 Chromium 中包含额外 GIF 像素解码检查；不支持时会跳过对应三项，不能把较少的总项数当成相同的覆盖度。自动化不覆盖声音、真实剪辑软件导入、AE 逐像素对照或完整无障碍验收。

## 可选的浏览器工具接口

当浏览器提供 `document.modelContext.registerTool` 时，工作台会注册受控的读取与配置操作。该接口是渐进增强，不是通用 AI 后端；普通浏览器不提供它也能完成全部手动制作流程。导出仍由用户在界面确认。

## 维护依赖

运行时仅依赖随仓库分发的 gifenc。不要直接编辑其压缩代码；升级时记录上游版本、许可证和包校验值，重新运行导出回归。开发依赖使用精确版本及锁文件，避免仅提交 `package.json` 而遗漏 `package-lock.json`。
