# 文档索引（仓库说明正文）

仓库根目录 [`README.md`](../README.md) 提供 **一页式文档地图**（进入仓库第一眼即可跳到任意章节）。

**以下为同一套内容的拆分文件**，按主题维护；改某一主题时只改对应文件，避免单文件过长。

| 文档 | 内容提要 |
|------|----------|
| [总览与版本节奏](./overview.md) | 三层架构、阶段一/二/三、pnpm+uv、消息队列与 Runner 心跳（必选） |
| [v1 设计清单与实施进度](./v1-design-and-progress.md) | 库表 / Redis / 队列 / 实时通道 / JWT / 接口对照；**实施进度表** |
| [业务域：用户与多项目](./business-domain.md) | 工作区形态、Runner 安全与并发 |
| [远程部署与 Electrobun 桌面](./remote-desktop-electrobun.md) | 云 + 本机职责边界、选型理由 |
| [架构图与流程](./architecture-diagrams.md) | Mermaid：逻辑架构、时序、步骤流水线 |
| [运行时 Skill 分层](./runtime-skills.md) | 契约 / 编排 / 执行三层 |
| [模块说明：桌面 · API · Agents](./module-topology.md) | 各层职责、与 `apps/api` 的链接 |
| [坑点与优先级小结](./pitfalls.md) | 契约、流式、安全、编排风险与对策 |
| [高并发](./high-concurrency.md) | 队列、扩缩、背压、幂等 |
| [清晰日志](./logging.md) | 结构化字段、脱敏、聚合 |
| [数据概念图](./data-model-concept.md) | User / Project / Task / Thread |
| [本地开发与自测](./local-development.md) | 联调要点 |
| [后续渠道：小程序与飞书](./future-channels.md) | 阶段三，H5 优先、机器人可选 |
| [ARCHITECTURE](./ARCHITECTURE.md) | HTTP、队列与心跳、部署拓扑（**待与实现同步扩展**） |

**子项目手册**

| 路径 | 说明 |
|------|------|
| [apps/api README](../apps/api/README.md) | Express 本地启动、迁移、Worker |
