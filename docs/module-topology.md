# 各模块功能说明（桌面 / API / Agents / 契约）

## 本地客户端：Electrobun + React（`apps/desktop` 等）

基于 [Electrobun](https://blackboard.sh/electrobun/docs/)：**Bun** 侧主进程 + **系统 WebView** 渲染 **React**。职责如下。

| 能力 | 说明 |
|------|------|
| 唯一操作入口（产品侧） | 登录、**当前项目切换**、多项目配置、对话、任务时间线；安装包分发与版本更新可走 Electrobun 自带或自建通道 |
| 与云端 API | `PUBLIC_API_BASE` / `VITE_*` / `import.meta.env` 等 **构建期或首次启动配置**，指向 **云服务器上的 Express**；**HTTPS**、证书校验按发布环境配置 |
| 与本机 Runner | **同机** 启动/守护 Python Runner，或通过 **Electrobun RPC** 把「选定的根目录、环境变量」交给子进程；**不在桌面里硬编码密钥** |
| 实时反馈 | **SSE / WebSocket** 连云端，或由 Runner **回传** 经本地桥接展示流式日志（具体桥接在实现期定一种主路径） |
| 安全 | 危险操作二次确认、Token 仅存 **本机安全存储**（由 Electrobun/OS 能力选型），不写死口令进仓库 |

**运行手册**：子包就绪后在本目录补 `README`；控制面见 [apps/api README](../apps/api/README.md)。

---

## Express 接口中间层（`apps/api` 等）

| 能力 | 说明 |
|------|------|
| 对外 API | 面向 **Electrobun 桌面端内嵌的 React** 与（可选）自动化脚本的 REST/JSON；内部 **`/internal/*`** 可仅供内网 |
| 编排 | 任务状态机、步骤枚举与 **Skill** 注入；长任务用队列 + 轮询/SSE，避免阻塞 worker |
| 调用 Agents / Runner | 将 **需触碰客户磁盘的步骤** **投递至绑定的 Runner**（队列、设备路由）；Express **自身**不对 `workspaceRoot` 做 IO；可另有无状态轻任务留在服务端（仅以 DB/远程 API 为界） |
| 安全 | **helmet**、CORS 白名单、请求体大小限制；敏感操作用户身份 + **二次确认令牌**（服务端签发与校验，**不落明文**到日志与响应） |
| 存储 | 用户、**项目（每用户多项目）**、会话、任务、Artifact 路径；**每条记录带 `userId` + `projectId` 作用域**；不把客户仓库密钥写入日志 |

典型目录：`src/config`、`src/routes`、`src/services`、`src/middlewares`、`src/workers`。

**运行手册**：[../apps/api/README.md](../apps/api/README.md)

---

## Python Agents（`agents/*`，包管理：**uv**）

各 Agent **运行在用户侧 Runner**，与 Express 之间为 **任务投递与回调**（如队列 + Runner 拉取、或 Runner 对控制面暴露的受控 HTTP）；须 **拒绝** 任何未与 **`userId` + `projectId` + 已登记 Runner** 绑定的裸路径。返回结构化 JSON；流式可由 Runner **回传** 至 Express 再转前端。

**技术选型（定稿，2026-05-14）**：见 [**Python Runner 技术选型**](./agents-runner-tech-stack.md）。摘要：**FastAPI + Uvicorn**（本机 **`127.0.0.1`**）、**Pydantic**、**httpx** 调 Node；编排 **LangGraph + LangChain**；检索与 RAG **LlamaIndex**；实时 **SSE** 为主；**LiteLLM** 或官方 SDK 接模型；向量库 **Qdrant / pgvector** 实现期二选一。练习路径与边界见 [Agent 学习模块](./agents-learning.md)；专项坑点见 [Agent 难点与坑点](./agents-challenges.md)。

**uv 约定（落地时）**：每个 Agent 目录（或 monorepo 级 workspace）维护 `pyproject.toml`；本地 `uv sync` 安装依赖，`uv run pytest` / `uv run uvicorn ...` 运行与测试；不把 `venv/` 提交进 Git，由 `uv.lock` 保证可复现构建。

| Agent | 职责概要 |
|--------|----------|
| **requirements** | 自然语言 → 结构化 PRD、验收标准、风险与待确认项 |
| **coding** | 在白名单路径与分支策略下修改客户仓库或脚手架 |
| **review** | 确定性命令（lint、类型检查等）+ 模型规则评审 → blocking / warnings |
| **test** | 执行配置中的全量测试命令，产出结构化测试报告 |
| **ops** | 发布、备份、回滚、只读巡检；仅在中间层判定前置步骤通过后允许 |

**边界**：Agent **仅**认 **Runner 进程** 与约定载荷；**不**对 **除云端编排通道外的裸 HTTP** 开放等价于「产品 REST」的写盘能力；与中间层约定版本化 API。

---

## 共享契约（推荐）

- 仓库根或 `contracts/`：`openapi.yaml` 或 JSON Schema 目录；CI 校验 Node/Python 客户端与文档一致。
- 若保留 TypeScript 包：可放置轻量 **`packages/api-types`** 仅从 OpenAPI 生成类型；Python 侧可用相同 spec 生成 **pydantic** 模型（生成步骤作为 dev dependency，由 **`uv run`** 执行）。

← [返回文档索引](./README.md)
