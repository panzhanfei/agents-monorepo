# 可预见坑点与对策

以下为落地前即可预判的问题：**左列为风险或反模式，右列为推荐做法**。实施时把关键项写进 `ARCHITECTURE.md` 或 ADR，避免口头约定。

## 契约、版本与 CI

| 坑点 / 不合理之处 | 优化方案 |
|-------------------|----------|
| Node 与 Python 各写一套 DTO / 枚举，字段悄悄不一致 | **OpenAPI 或 JSON Schema 作为单一事实来源**；TS 类型与 Python 模型由生成或 CI **diff 校验**保证同步 |
| 中间层已发新 Skill 字段，部分 Agent 未升级，静默丢字段或解析错误 | 任务载荷带 **`skillSchemaVersion` / `apiVersion`**；中间层按版本路由；旧 Worker **显式拒绝或降级策略**，禁止「半升级」 |
| Review / Test Agent 跑的命令与客户 **真实 CI** 不一致，出现「Agent 通过、流水线失败」 | **与客户仓同源配置**：从 `agents.config.yaml` 或仓库约定路径读 `lint` / `fullTestCommand`；文档写明 **以何者为准** |

## 运行时模型与可观测

| 坑点 / 不合理之处 | 优化方案 |
|-------------------|----------|
| 长任务（全量测试、发布）同步阻塞 Express，连接超时、难扩容 | **短 HTTP 仅负责入队 + 返回 `taskId`**；Worker 执行；状态 **queued / running / succeeded / failed** 持久化；前端 **SSE 或轮询** |
| 多路流式（模型 token、子进程日志、步骤心跳）各走各的协议，前端与排障困难 | **中间层汇聚为统一 SSE/WebSocket 事件**（含 `runId`、`step`、`source`）；前端只对接一套协议 |
| React 桌面端 → Express → Python Runner → 本机仓 → 外部模型，排障无串点 | 全链 **`X-Request-Id` / `traceId`**；结构化日志带 **`runnerDeviceId`**；可选 **OpenTelemetry** |

## Agent 拓扑与安全

| 坑点 / 不合理之处 | 优化方案 |
|-------------------|----------|
| 每个 Agent 一个 HTTP 服务，端口与部署矩阵爆炸，团队小时运维成本高 | 早期可 **减少进程数**（单机多路由的 Python 网关、或队列 + 单类 worker）；若坚持微服务，必备 **健康检查、版本清单、统一配置基址** |
| Coding Agent **任意 shell / 开放网络**，误用或滥用时攻击面大 | **能力白名单**：写路径、分支、受控工具 API；敏感操作需中间层 **二次确认 + 权限**；禁止默认「全机 exec」 |
| 多轮对话只靠模型记忆，无会话真源 | **会话与任务快照以 DB 为准**；Agent 仅带摘要与 `taskId`；避免无状态 HTTP 导致上下文碎裂 |

## 产品与编排

| 坑点 / 不合理之处 | 优化方案 |
|-------------------|----------|
| 危险操作（发布、改全局规则）仅靠「信任操作者」 | Web **显式二次确认** + 服务端 **一次性 token**；**审计日志**（谁、何时、对哪一 `taskId`、何种动作） |
| 阶段越多，状态机越难维护，一味全自动易把错需求推到生产 | **可配置人工闸门**（如 PRD 确认、发布前确认）；失败与重试策略在编排层统一，避免每 Agent 自建一套 |
| **uv** 在 `agents/*` 里一半独立项目、一半 workspace，新人无从下手 | **立项时定一种**：「根 uv workspace 统管多包」或「每 Agent 独立 `pyproject.toml`」；README/脚手架只推一种 **黄金路径** |
| 一人多项目但请求 **不带 `projectId`**，会话与工作区串台 | 所有写操作与长连接 **强制作用域**（`userId` + `projectId`）；`workspaceRoot` 仅在对照 DB 与 **Runner 设备** 后下发任务；日志带 **`projectId`** |
| **服务已上云**，仍假设用 **纯浏览器页** 即可由服务器直接读写用户工程 | **禁止**：产品形态为 **Electrobun + Runner**；服务器只编排，**不** 碰客户盘（见 [远程部署与 Electrobun 桌面](./remote-desktop-electrobun.md)） |

## 小结（优先级建议）

1. **契约 + CI 校验**（防双端漂移）  
2. **异步任务 + 统一流式**（防阻塞与观测混乱）  
3. **traceId + 结构化日志**（防跨语言排障地狱）  
4. **同源测试/门禁命令 + Skill 版本**（防「绿了但 CI 红」与半升级）  
5. **DB 会话/任务 + 危险操作审计**（防责任不可追溯与状态黑洞）  
6. **无状态 API + 消息队列 + Runner 心跳 + 可扩展消费端**（见 [总览](./overview.md)「必选基础设施」及 [高并发](./high-concurrency.md)）  
7. **全服务统一 JSON 日志字段与脱敏策略**（见 [清晰日志](./logging.md)）  
8. **客户工程不落服务器盘**：文件类步骤 **只** 由 **Runner** 完成；标配客户端为 **Electrobun + React**（见 [远程部署与 Electrobun 桌面](./remote-desktop-electrobun.md)）

← [返回文档索引](./README.md)
