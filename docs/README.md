# 文档索引（仓库说明正文）

仓库根目录 [`README.md`](../README.md) 提供 **一页式文档地图**（进入仓库第一眼即可跳到任意章节）。

**以下为同一套内容的拆分文件**，按主题维护；改某一主题时只改对应文件，避免单文件过长。

| 文档 | 内容提要 |
|------|----------|
| [总览与版本节奏](./overview.md) | 三层架构、阶段一/二/三、pnpm+uv、消息队列与 Runner 心跳（必选） |
| [**实施分段（已定稿）**](./phased-delivery.md) | **第一期 Node+前端收口（Agent 仅占位）**；第二期 Agents 与半天～一天对齐门禁；本地→打包→上云顺序 |
| [v1 设计清单与实施进度](./v1-design-and-progress.md) | 设计对照表；**第一期任务 backlog（优先级 1～22）**；实施进度（随记） |
| [业务域：用户与多项目](./business-domain.md) | 工作区形态、Runner 安全与并发 |
| [远程部署与 Electrobun 桌面](./remote-desktop-electrobun.md) | 云 + 本机职责边界、选型理由 |
| [架构图与流程](./architecture-diagrams.md) | Mermaid：逻辑架构、时序、步骤流水线 |
| [运行时 Skill 分层](./runtime-skills.md) | 契约 / 编排 / 执行三层 |
| [模块说明：桌面 · API · Agents](./module-topology.md) | 各层职责、与 `apps/api` 的链接 |
| [**Python Runner 技术选型（定稿）**](./agents-runner-tech-stack.md) | FastAPI、httpx、LangGraph+LangChain、LlamaIndex（检索）、SSE、uv、工程化 |
| [**Agent 学习模块**](./agents-learning.md) | 三栈练习边界、与 Node/分层约束、推荐阅读顺序 |
| [**Agent 难点与坑点**](./agents-challenges.md) | Python Runner 专项：版本/双编排/RAG 隔离/SSE/契约/打包 |
| [坑点与优先级小结](./pitfalls.md) | 契约、流式、安全、编排风险与对策 |
| [高并发](./high-concurrency.md) | 队列、扩缩、背压、幂等 |
| [清晰日志](./logging.md) | 结构化字段、脱敏、聚合；**第一期 Express 底线（traceId · pino · Worker）** |
| [数据概念图](./data-model-concept.md) | User / Project / Task / Thread |
| [本地开发与自测](./local-development.md) | 联调要点 |
| [后续渠道：小程序与飞书](./future-channels.md) | 阶段三，H5 优先、机器人可选 |
| [ARCHITECTURE](./ARCHITECTURE.md) | Runner **HTTP API**（生产 TLS）；Redis **不暴露**给 Runner；JWT；心跳门禁；BullMQ 定位；[**§10 优雅退出**](./ARCHITECTURE.md#graceful-shutdown) |

**子项目手册**

| 路径 | 说明 |
|------|------|
| [apps/api README](../apps/api/README.md) | Express 本地启动、迁移、Worker |
