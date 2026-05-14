# Python Runner 技术选型（定稿）

**范围**：`agents/runner`（及后续 `agents/*` 中与 Runner 同进程部署的 Python 能力）。**数据面**：会话、任务、权限、消息持久化等 **均在 `apps/api`（Node）**；Runner **不直连业务数据库**，通过 **HTTPS** 调用中间层 API。

**定稿日期**：2026-05-14（后续变更请在本文件更新版本说明或关联 ADR）。

## 选型总表

| 类别 | 选型 | 说明 |
|------|------|------|
| **运行时与依赖** | **Python 3.11+** + **uv**（`pyproject.toml` + `uv.lock`） | 与 [模块说明 · Python Agents](./module-topology.md) 及 [总览](./overview.md) 中 uv 约定一致 |
| **本机入站** | **FastAPI** + **Uvicorn** | 仅绑定 **`127.0.0.1`** ，供 Electrobun / 本机进程访问；**不**将 Runner 当作对公网产品 API |
| **契约与校验** | **Pydantic v2** | 路由 DTO、tool 入参、与 Node 对齐的请求/响应模型 |
| **出站调中间层** | **httpx**（**async**） | Runner → Node 的唯一业务/数据通道；超时、连接池与流式响应 |
| **Agent 编排** | **LangGraph**（主编排）+ **LangChain**（消息 / Tools / 与模型侧胶水） | 状态机、分支、checkpoint 以图为单位；**练习目标**为熟练掌握两栈配合方式 |
| **RAG / 检索** | **LlamaIndex**（**仅**索引、检索、query 管线） | **不**在 LlamaIndex 内承载业务级状态机；检索能力以 **Tool / Retriever** 形式供 LangGraph 节点调用 |
| **向量存储** | **实现期二选一锁定**：**Qdrant** 或 **pgvector** | 与现有 Postgres 强绑定可偏 **pgvector**；独立检索服务可偏 **Qdrant**；选定后写入本文或 ADR |
| **模型调用** | **LiteLLM** 或 **单厂商官方 async SDK** | 多模型与网关练习优先 LiteLLM |
| **实时（Runner → 本机客户端）** | **SSE** 为主 | 流式 token、日志、进度事件；不足再评估 **WebSocket** |
| **工程化** | **结构化日志**（**structlog**）；**单元测试**按排期后续再加（`extra dev` 中可保留 pytest 依赖） | 可选后续：**OpenTelemetry** / Langfuse 等 |

## 刻意不包含

- **业务库 ORM / Prisma / 直连 Postgres 业务表**：归属 **`apps/api`**，Runner 不得引用。

<a id="runner-repo-layout"></a>

## 仓库布局与文件职责（实现）

代码根目录：**[`agents/runner/`](../agents/runner/)**（含 **`pyproject.toml`**、`README`、**`src/runner/`** 分层）。

| 路径（相对 `agents/runner`） | 职责 |
|-----------------------------|------|
| **`pyproject.toml`** | 已对齐本页选型：FastAPI、uvicorn、httpx、Pydantic、structlog、LangChain、LangGraph、llama-index-core、LiteLLM；**`extra dev`**（ruff，及预留 pytest）；**`extra vector-qdrant`** / **`extra vector-pg`**（两种向量库路径，实现期二选一启用）。 |
| **`uv.lock`** | 由 **`uv lock`** 生成后提交，保证可复现安装（若当前缺失，在子目录执行一次即可）。 |
| **`.env.example`** | `RUNNER_*` 环境变量说明（无密钥）。 |
| **`src/runner/config/`** | **`pydantic-settings`** 读取配置。 |
| **`src/runner/interfaces/`** | FastAPI **`create_app`**、路由、SSE 占位等。 |
| **`src/runner/application/`** | LangGraph 用例编排（随功能增量）。 |
| **`src/runner/domain/`** | 领域规则与类型。 |
| **`src/runner/infrastructure/`** | **NodeApiClient（httpx）**、structlog 初始化；后续 LLM/向量适配。 |

更细的命令与说明见 [**`agents/runner/README.md`**](../agents/runner/README.md)。

## 相关文档

- 分层与安全边界：[agents-python 规则](../.cursor/rules/agents-python.mdc)。  
- 练习侧重点与边界：[Agent 学习模块](./agents-learning.md)。  
- 框架组合常见坑：[Agent 难点与坑点](./agents-challenges.md)。

← [返回文档索引](./README.md)
