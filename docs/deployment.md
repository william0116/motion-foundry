# 部署与发布

## 部署模型

Motion Foundry 是纯静态应用。网站根目录应指向 `dist/`，不需要数据库、环境变量、应用进程或构建命令。部署程序若强制要求构建步骤，可设置为空步骤，并将发布目录设置为 `dist`。

站点通过相对路径加载资源，可部署在独立域名根目录或带结尾斜杠的子路径，例如 `/motion-foundry/`。服务器需要正确返回 JavaScript MIME 类型；未知文件应返回 404，不要统一回退到 HTML，避免掩盖缺失的 JS 模块。

开发用的 Python 或 `npm start` 服务不是生产服务器。

## 静态服务器配置示例

以下 Nginx 示例中的域名和磁盘路径需替换为实际值。TLS、访问控制和运维监控由部署环境配置；此片段不提供完整生产安全配置。

```nginx
server {
    listen 80;
    server_name motion.example.com;
    root /srv/motion-foundry/current/dist;
    index index.html;

    include mime.types;
    default_type application/octet-stream;

    add_header X-Content-Type-Options nosniff always;
    # 文件名没有内容哈希，要求浏览器重新验证缓存。
    add_header Cache-Control "no-cache" always;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
    }
}
```

若前面还有 CDN，需要同步设置缓存重新验证或在发布后失效旧缓存。不要给未版本化的 `.js` / `.css` 使用长期 `immutable` 缓存。`/qa.html` 是本地自检页，不处理私有数据；生产环境可限制该页面访问，但应保留测试环境可访问。

## 分支规则

- `main`：日常开发、合并和回归验证。
- `prod`：唯一正式发布分支，只接受经过维护者确认的提交。
- 功能分支：从 `main` 创建，通过审查后合入；不要在 `prod` 上直接开发。

建议在托管平台配置 `prod` 保护规则，限制直接推送和强制推送；本仓库文档不代表远程保护规则已启用，也不包含已配置的自动部署服务。

## 一次发版

1. 确认工作区干净，更新远程引用，选择已审查的 `main` 提交。
2. 在该提交上执行 `npm ci`、`npm run check`、`npm test`、`npm run test:browser`；视觉或导出变更增加人工验收。
3. 记录提交 SHA、变更说明、测试结果和回滚目标，获得维护者发布确认。
4. 将 `prod` 快进到**指定的已验证提交**，再推送 `prod`；不要使用 `--force`。
5. 将该提交的完整 `dist/` 放入新的版本目录，验证后原子切换服务指向；保留上一版。
6. 检查首页、模板筛选、编辑、GIF 下载及 PNG 下载，确认静态资源来自同一版本。

Git 操作示意（不要把占位 SHA 原样执行）：

```sh
git fetch origin
git switch prod
git merge --ff-only origin/prod
git merge --ff-only <已验证的提交SHA>
git push origin prod
git switch main
```

快进失败说明分支存在分歧，应先检查历史，不要用强制覆盖解决。只有推送分支不等于服务器部署成功，需要确认实际部署系统的结果。

## 模板同步与回滚

新增模板属于代码变更，没有远程模板数据库。完整部署新代码并让浏览器重新加载后即可获得新模板。已有打开的页面不会自动热更新；提醒正在编辑的使用者先导出，再刷新。

收藏依赖模板 ID；保持 ID 稳定，不能将旧 ID 随意用于另一种模板。

紧急回滚优先将静态服务切回上一个已验证的完整版本目录。后续通过正常的修复或 revert 提交更新开发与发布分支，不改写公开历史。没有数据库迁移需要回退，但浏览器缓存仍需处理。

## 首次公开仓库

上线网站与公开源码是不同操作。首次公开前还须完成[开源发布检查表](release-checklist.md)，尤其审查 Git 历史、许可证、素材来源及安全报告渠道。
