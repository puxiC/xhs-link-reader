# XHS Link Reader

小红书链接读取服务：给 AI/家机提供笔记标题、正文、作者、图片 URL、互动数据、评论，以及可选的图片 base64。

## 功能

- `POST /api/xhs-card`：读取小红书笔记结构化信息
- `POST /api/xhs-images`：代理下载图片并转成 base64
- `POST /api/mcp`：远程 Streamable HTTP MCP endpoint，适合 ChatGPT Work/Chat 自定义 MCP 应用
- `src/mcp-server.ts`：本地 MCP stdio server，适合本地 MCP 客户端

## 本地运行

```bash
npm install
npm run dev
```

测试接口：

```bash
curl -X POST http://localhost:3000/api/xhs-card \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://www.xiaohongshu.com/explore/...\"}"
```

## 部署到 Vercel

1. 把这个文件夹推到 GitHub。
2. 在 Vercel 导入这个 GitHub 仓库。
3. Framework 选择 `Other` 即可。
4. 部署完成后，记录域名，例如 `https://xhs-link-reader.vercel.app`。

## MCP 用法

### ChatGPT Work / Chat

ChatGPT 网页端需要远程 MCP server。Vercel 部署后，在 ChatGPT 的自定义 MCP 应用里填写：

```text
https://你的-vercel-域名.vercel.app/mcp
```

`/mcp` 会被 Vercel 重写到真正的函数 `/api/mcp`，两个地址都可以用。ChatGPT 里请选择“无身份验证”；OAuth 需要额外实现 OAuth/OIDC 发现和授权流程，本项目默认不启用。

这个服务目前不做账号鉴权，只建议自己私用；如果要公开给别人用，建议加 OAuth 或至少加一个访问 token。

### 本地 stdio 客户端

如果你的 MCP 客户端支持本地 stdio server，配置命令：

```bash
npm run mcp
```

建议设置环境变量：

```bash
XHS_API_BASE_URL=https://你的-vercel-域名.vercel.app
```

不设置也可以，本地 MCP 会直接抓取小红书页面。

## 注意

小红书页面结构可能会变化，所以解析器做了多路径兼容和兜底搜索。短链 `xhslink.com` 和 `xhslink.cn` 都会跟随跳转。若后续失效，优先更新 `src/xhs.ts` 里的 `extractNoteFromState`。
