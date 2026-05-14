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
| **工程化（脚手架阶段即具备）** | **pytest** + **结构化日志**（stdlib JSON 或 **structlog**） | 可选后续：**OpenTelemetry** / Langfuse 等 |

## 刻意不包含

- **业务库 ORM / Prisma / 直连 Postgres 业务表**：归属 **`apps/api`**，Runner 不得引用。

## 相关文档

- 分层与安全边界：[agents-python 规则](../.cursor/rules/agents-python.mdc)。  
- 练习侧重点与边界：[Agent 学习模块](./agents-learning.md)。  
- 框架组合常见坑：[Agent 难点与坑点](./agents-challenges.md)。

← [返回文档索引](./README.md)
