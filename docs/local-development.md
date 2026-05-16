# 本地开发与自测（建议）

- **Electrobun + React**：按子包脚本启动（如 `bun run dev` / `pnpm --filter desktop dev`）；验证 **WebView 内 React** 能连 **本地或远程 Express**。  
- **一键本地**：仓库根目录 `pnpm dev` 会并行拉起 **`apps/api`**、`apps/web` 与 **`agents/runner`**（需本机已安装 **[uv](https://github.com/astral-sh/uv)**；Runner 的 `.env` / 绑定流程见 [agents/runner README](../agents/runner/README.md)）；也可分别 `pnpm dev:api`、`pnpm dev:web`、`pnpm dev:runner`。  
- **Express**：`pnpm dev:api` 或根目录一并启动；`GET /health`；CORS 允许 **桌面端来源**（开发可为 `localhost` 自定义 scheme，生产按 Electrobun 文档配置）。详见 [apps/api README](../apps/api/README.md)。  
- **Python（uv）**：Runner 侧 `uv sync`、`uv run …`；与桌面安装包或开发时子进程对齐。  
- **联调**：云端可 docker-compose **仅 API + DB**；桌面与 Runner **始终在本机** 跑；API 契约可用 mock。E2E 可测 **Express** 与 **Runner** 分离集成。  
- **密钥**：仅 `.env` / 密钥管理系统；见 `env-secrets.mdc`。

← [返回文档索引](./README.md)
