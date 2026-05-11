# 清晰日志方案（设计约定）

目标：任何人用 **同一套查询方式**（`traceId`、`taskId`、时间窗）即可串起 **桌面端 → Express → 队列 → Runner → 子进程**，且 **生产日志可读、可聚合、不泄露密钥**。

## 统一结构化字段（建议最小集合）

| 字段 | 说明 |
|------|------|
| `timestamp` | ISO8601 / Unix ms，**UTC** 推荐 |
| `level` | `error` / `warn` / `info` / `debug`（生产默认 `info`，Debug 可抽样） |
| `service` | 固定服务名，如 `web`、`api`、`agent-coding`、`worker` |
| `env` | `development` / `staging` / `production` |
| `traceId` | **全链路透传**（HTTP Header，如 `X-Request-Id`，缺失则入口生成） |
| `taskId` / `runId` | 编排任务与单次运行标识，便于与 DB 状态对照 |
| `projectId` | **项目作用域**（一人多项目时排障与配额必选） |
| `runnerDeviceId` | **Runner 实例**（心跳、队列消费、多机排障） |
| `userId` | 仅存内部 id 或 **哈希**，避免可直接识别 PII |
| `msg` / `message` | 简短人类可读说明 |
| `err` | 错误时：`name`、`message`、**脱敏后的** `stack`（可选，按环境） |
| `extra` / `context` | 结构化附加键值（**禁止**在此放 token、Cookie、仓库 URL 中的凭据） |

Node 侧可用 **pino** 等输出一行 JSON；Python 侧可用 **structlog** 或 `logging` + JSON formatter，与上表字段 **对齐命名**（可在 `contracts/` 附「日志字段」小 schema 供审查）。

## 行为约定

- **入口生成**：Express（或边缘网关）**无则创建** `traceId`，向下游 Python 调用 **原样传入 Header**。  
- **子进程 / 工具 SDK**：在 spawn 或 HTTP 客户端中 **继承** `traceId`、`taskId`。  
- **脱敏**：统一中间件或日志封装对 **Authorization、Cookie、`password` 类 body 字段** 打 `[REDACTED]`。  
- **审计与调试分离**：危险操作（发布、改规则）写 **审计表 + 结构化 audit 日志**；海量 debug 可 **采样** 或单独 index，避免冲垮存储与费用。  
- **聚合**：**优先 stdout 单行 JSON**，由容器/K8s 侧采集进 **Loki、ELK、云厂商日志**；避免强绑定某一商业 SDK，便于换部署环境。  
- **性能**：日志 IO 异步、批量落盘（库默认行为）；极高 QPS 时对 **debug 全量** 关闭或按 **trace 采样**。

<a id="phase1-logging-baseline"></a>

## 第一期底线（Express · Worker · 排障优先）

第一期要把日志当成 **与路由同级的主功能**：没有统一字段，后续「认领 / 回写 / Worker」排障成本会指数上升。

| 必须项 | 说明 |
|--------|------|
| **`traceId` 贯通** | 入口中间件：读取 `X-Request-Id` / `X-Trace-Id`，无则 **uuid**；**响应头写回**同一 id；后续任务处理、Worker **继承同一字段**（可放进 BullMQ job data 元数据）。 |
| **单行 JSON（stdout）** | API、Worker 进程默认 **一行一条 JSON**（推荐 **pino**），便于 `pnpm dev` 管道与日后接入采集；不要用散落 `console.log` 字符串当长期方案。 |
| **请求日志** | 每条 HTTP：至少 `method`、`path`（可不含 query）、`statusCode`、**耗时 ms**；**不**记录完整 body（脱敏见上表）。 |
| **业务上下文** | 在 **认证通过后** 的子日志里带上 **`userId`**（内部 id）；任务相关路径带上 **`taskId`、`projectId`、`runnerDeviceId`**（若有）。 |
| **错误日志** | `errorHandler` 打 **`level=error`** + `err.name`/`err.message`；生产是否带 stack 按 `env`。 |
| **Worker** | 每条 job：`jobId`、`taskId`、`traceId`（若有）；失败打 **完整错误原因**（仍脱敏）。 |
| **优雅退出** | 收到 `SIGTERM`/`SIGINT` 时打 **`shutdown_started` / `shutdown_complete`**（或同级字段），与 [ARCHITECTURE §10](./ARCHITECTURE.md#graceful-shutdown) 一致，便于区分「正常收尾」与「被 kill -9」。 |

**第二期 Runner（Python）**：与上表 **字段同名** 输出 JSON；HTTP 调 API 时 **透传 `traceId`**。

---

## 与可观测性的关系

结构化日志解决 **「查一条线」**；若需延迟与依赖拓扑，可在后续引入 **OpenTelemetry**（与 `traceId` 对齐），二者不冲突：先统一字段再谈链路追踪。

← [返回文档索引](./README.md)
