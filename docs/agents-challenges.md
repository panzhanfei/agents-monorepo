# Agent 难点与坑点（Runner / Python 专项）

本文聚焦 **Python Runner** 与 **LangGraph + LangChain + LlamaIndex + RAG** 组合落地时的典型难点；通用全栈坑点仍见 [坑点与对策](./pitfalls.md)。

## 框架与依赖

| 难点 | 说明 | 对策 |
|------|------|------|
| **三栈版本漂移** | LangChain / LangGraph / LlamaIndex 迭代快，API 改名频繁 | **`pyproject` + `uv.lock` 锁主版本**；升级时一次性跑通测试与一条端到端用例 |
| **双编排** | LangGraph 与 LlamaIndex Agent **各有一套循环** | **只保留 LangGraph 为图**；LlamaIndex **仅 retriever + index**，禁止两条状态机并行驱动同一 `runId` |
| **LlamaIndex ↔ LangChain 桥接** | Retriever / Tool 接口需对齐 | 使用官方推荐的 **LangChain Retriever / Tool 包装**；在 **单一模块** 内集中转换，避免路由里散落 |
| **同步阻塞事件循环** | 部分 LLM 或本地嵌入默认同步 | 明确 **async** 路径；阻塞调用进 **线程池** 或单独进程，避免卡死 FastAPI |

## RAG 与多租户

| 难点 | 说明 | 对策 |
|------|------|------|
| **索引与 `projectId` 隔离** | 多项目共仓时向量误混检 | 检索 **过滤条件**（metadata 带 `userId` / `projectId`）；接入规则以 **Node 为准** |
| **权限与脱敏** | Runner 本地可扫盘，不等于可任意建库 | **谁能建索引 / 查哪部分文档**由 Node 签发或校验；敏感段落不进向量或加密元数据策略 |
| **解析质量** | PDF/扫描件导致检索「看似可用、实则胡说」 | 选稳定解析链；对关键路径做 **评测集** 回归 |

## 本机与实时

| 难点 | 说明 | 对策 |
|------|------|------|
| **SSE 在 WebView** | `EventSource` 能力或缓冲差异 | 备选 **`fetch` + ReadableStream** 读 `text/event-stream`；约定 **心跳与超时** |
| **FastAPI 仅 loopback** | 误绑 `0.0.0.0` 扩大攻击面 | **生产/打包默认 `127.0.0.1`**；进程间 **短期 token** |
| **取消与中断** | SSE 单向，用户点「停止」 | **另发 POST** 置 `cancel` 标志；LangGraph / 任务层协作中断 |

## 与 Node 的契约

| 难点 | 说明 | 对策 |
|------|------|------|
| **DTO 双源** | Python Pydantic 与 TS 类型不一致 | **OpenAPI 或 Schema 单源**；生成或 CI diff（见 [pitfalls · 契约](./pitfalls.md)） |
| **幂等与重试** | 网络抖动导致重复写 | 与 Node 约定 **`Idempotency-Key` / `runId`**；Runner 侧读响应再决断 |

## 打包与运维（桌面）

| 难点 | 说明 | 对策 |
|------|------|------|
| **uv 与安装包体积** | 依赖多、首次 sync 慢 | 分包镜像或 **PyInstaller/Nuitka** 策略与 CI 尽早试跑 |
| **可观测** | 用户现场问题难复现 | **`traceId`/`runId` 打满**结构化日志；关键步骤简要指标 |

---

← [坑点与对策（通用）](./pitfalls.md) · [技术选型](./agents-runner-tech-stack.md) · [学习模块](./agents-learning.md) · [文档索引](./README.md)
