# ARCHITECTURE（控制面 · 与实现同步扩展）

本文件与 [v1 设计清单与实施进度](./v1-design-and-progress.md) 及 **`apps/api` 实现**对齐迭代；**不含密钥值**，环境变量见各包 `.env.example`。

**当前代码入口**：[apps/api README](../apps/api/README.md)。

---

## 1. 网络与信任边界（定稿）

| 角色 | 与控制面的连接 | 说明 |
|------|----------------|------|
| **浏览器 / Electrobun 内 React** | **HTTP API**（生产建议 **HTTPS**）→ Express | 用户 UI；后续可叠加 SSE / WebSocket（见 §5）。 |
| **Runner（Python，用户本机）** | **仅经 HTTP API** 访问 Express（**生产环境用 HTTPS**） | **认领、心跳、上报结果** 全部走 API；**永不直连 Redis / 消息 broker**。 |
| **Redis** | **仅部署在控制面可信网络**（如同 VPC / docker-compose 内网） | 供 BullMQ、缓存、频控等 **服务端内部** 使用；**Runner 永不直连 Redis**。 |
| **PostgreSQL** | 同上，仅服务端可达 | 任务状态、用户、项目、Runner 登记等 **唯一持久真源**（任务派发面向 Runner 时以 DB 状态为准）。 |

**本地开发**：Runner 与浏览器均可使用 **`http://127.0.0.1:<PORT>`**（或 `localhost`），与「只走 API、不连 Redis」**不冲突**——约束的是 **拓扑**（Runner 不对 broker 建连），不是要求本机也必须 TLS。若前端与 API **协议不一致**（例如页面用 `https://` 而 API 仅 `http://`），可能触发浏览器 **mixed content** 或 Cookie `Secure` 问题；本地统一用 HTTP 即可。**生产**再对公网 API **强制 HTTPS**（证书、HSTS 按部署方式配置）。

**非默认形态**：Runner 通过 **VPN / 专线直连队列** 可作为企业内网特例，**不作为本 SaaS 产品默认架构**。

---

## 2. Runner 任务派发模型（定稿）

目标：**云端编排 + 本机执行**；调度逻辑在服务端，执行在用户磁盘。

### 2.1 认领（Claim）

Runner **不消费 BullMQ**；通过 **HTTP API**（轮询、长轮询或 WebSocket；**生产建议 TLS**）实现「拉任务」：

- **轮询**：`GET …/tasks/next` 或等价路径，短间隔（需注意配额与退避）；或  
- **长轮询**：同一语义，服务端挂起至有任务或超时；或  
- **WebSocket**：连接保持，服务端推送「有待认领任务」后再走 HTTP claim（或 WS 内嵌 claim 消息）。

**服务端行为**：根据 **DB** 中任务状态（如 `QUEUED`、目标 `runnerDeviceId`、可选优先级）挑选一条；使用 **可选 Redis 分布式锁 / lease**（仅 VPC 内）防止 **双 Runner 重复认领**；将任务原子更新为 `PROCESSING`（或 `CLAIMED` + 过期租约，实现期二选一）并返回 **任务 DTO**（含 `taskId`、`payload`、`skillSchemaVersion` 等）。

### 2.2 执行与回写

Runner 在本机 `workspaceRoot` 执行；完成后 **HTTPS** 调用 **结果回写** API（如 `PATCH /tasks/:taskId/complete` / `…/fail`），服务端更新 DB；必要时触发内部队列做后续步骤（仍不经 Runner 直连 Redis）。

### 2.3 与 BullMQ / `pnpm worker:api` 的关系（重要）

- **BullMQ + Node Worker** 定位为 **控制面内部异步**：例如延迟调度、向内部服务发通知、或 **开发阶段占位**。  
- **生产语义**：**任务执行完成状态必须由 Runner 通过 HTTPS 回写**（或由 API 在确认 Runner 租约失效后标记失败），**不得**依赖「云端 Node Worker 假装执行完」代表用户侧 Agent。  
- **当前仓库**：`apps/api/src/jobs/processAgentJob.ts` 仍为 **占位模拟**；引入 **认领 API** 后，应 **关闭或收窄** 该 Worker（仅保留真正无需触盘的内部 job），避免与 Runner 争抢同一任务语义。

---

## 3. JWT 与 Runner 凭证（Node 层）

- **用户（浏览器）**：登录 / 注册后为 **`Authorization: Bearer <JWT>`**（access；refresh 策略实现期定稿）。业务路由、多项目 CRUD、前端 SSE/WS（若与用户绑定）均在该身份下。  
- **Runner**：与用户 token **分离**——推荐 **deviceKey + 注册时登记的密钥** 换 **短期 access**，或 **Runner 专用 JWT**（claims 含 `runnerDeviceId`、`userId`，权限收窄）。具体路径与轮换写入 OpenAPI / `.env.example`。  
- **开发路由**：`/dev/*` 仅在非生产启用或受环境变量闸门。

---

## 4. 心跳与在线门禁

- Runner **周期性 HTTPS** `POST /runners/heartbeat`（载荷可扩展：`contractVersion`、`projectId` 摘要等，见 [v1 设计清单](./v1-design-and-progress.md)）。  
- **`enqueue` / `claim`**：实现 **在线判定**（如 `lastSeenAt` 距现在 ≤ N 秒）；离线 Runner **不入队或不可认领**。默认阈值与回收策略见 **下文 §9**。

---

## 5. 实时通道（Socket / SSE）

- **默认**：任务进度以 **轮询任务详情** + **日志片段字段** 可满足 MVP。  
- **增强**：对浏览器提供 **SSE** 或 **WebSocket**（同一 Express 或旁路 Gateway），**认证与 `projectId` 作用域**必校验；Runner **仍以 HTTPS claim 为主**，避免把 Runner 绑死在长连接实现上。

---

## 6. 校验与错误体

- **Zod**：HTTP body/query **入口校验**；统一错误体（`code`、`message`、可选 `details`），与前端约定一致。  
- **日志**：第一期即落实 **`traceId` 贯通与结构化日志**（单行 JSON），详见 [清晰日志 · 第一期底线](./logging.md#phase1-logging-baseline)；错误路径必须可用人 **`traceId` + `taskId`** 在日志与 DB 间对齐。

---

## 7. 数据库

- **Prisma schema**：[`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)；迁移策略见 `apps/api` README。  
- **多项目**：所有写操作 **`userId` + `projectId` 作用域**；`workspaceRoot` 仅存 **登记路径**，真实 IO 仅在 Runner，且须 **路径规范化防逃逸**（Runner 实现）。

---

## 8. 待实现期补齐（占位清单）

- OpenAPI 或 JSON Schema **单源**与 CI diff（见 [坑点](./pitfalls.md)）。  
- `traceId` / `X-Request-Id` 贯通（见 [清晰日志](./logging.md)）。  
- DLQ、任务取消、`CLAIMED` 租约超时回收。  
- `/health` vs `/ready`（依赖 DB/Redis）。  
- **进程优雅退出**：API 与 Worker **分进程**各自监听 **`SIGTERM`/`SIGINT`**，见 **§10**。

---

<a id="phase1-runner-dispatch"></a>

## 9. 第一期推荐落地方案（队列 · Worker · 鉴权 · 门禁 · 租约）

本节把「云端 Worker 假完成 / 双调度 / 裸路由 / 僵尸任务」收口为 **一套默认可实施方案**；实现时以 **环境变量** 闸门为准，避免与 Runner 认领语义冲突。

### 9.1 队列与 Worker：避免「双执行」

| 策略 | 做法 |
|------|------|
| **Runner 可执行任务** | **仅用 PostgreSQL** 表达 `QUEUED` →（Runner `claim`）→ `PROCESSING` →（Runner `complete`/`fail`）→ 终态。**默认不向 BullMQ 投递**该类任务，或投递但 **Worker 明确不消费**（见下）。 |
| **BullMQ** | 保留给 **控制面内部异步**（延迟提醒、非触盘作业等），队列名与 **`agent-tasks`（Runner 任务）分离**。 |
| **环境变量（推荐命名）** | `RUNNER_TASK_DISPATCH_MODE=db-only`（默认）：`enqueue` **只写 DB**，不写 BullMQ。**若暂时保留 BullMQ 写入**：必须设 `PROCESS_RUNNER_TASKS_IN_WORKER=false`（默认 **false**），使 `pnpm worker:api` **绝不**将 Runner 任务标为 `COMPLETED`。 |

**迁移提示**：现有实现若已写入 `bullmqJobId`，可在改为 `db-only` 后停止写入该字段或仅作审计占位；旧 Job 由运维排空即可。

### 9.2 鉴权分期（防冒充注册 Runner）

| 阶段 | 要求 |
|------|------|
| **本地开发** | 可用种子用户；`/dev/*` 仅当 `NODE_ENV !== "production"` 或 **`ENABLE_DEV_ROUTES=true`**。 |
| **第一期正式路由** | `POST /runners/register`、`POST /tasks/enqueue`、项目 CRUD：**必须** `Authorization: Bearer`（用户 JWT）；**禁止**在 body 里裸传 `userId` 注册 Runner（改为从 token 取 `userId`）。 |
| **Runner 侧** | `claim` / `complete` / `fail` / `heartbeat`：**Runner 专用凭证**（如 `X-Device-Key` + `X-Device-Secret` 或与 §3 一致的短期 Runner JWT），与用户浏览器 token **分离**。 |

### 9.3 在线门禁（enqueue / claim 一致）

- 配置 **`RUNNER_HEARTBEAT_TTL_SEC`**（建议默认 **60～120**）。  
- **`enqueue`**：`lastSeenAt` 超出 TTL → **409** `runner_offline`（或业务码一致）。  
- **`claim`**：同上；防止离线设备抢走任务。

### 9.4 认领租约与僵尸任务（最小可行）

| 字段（建议迁移增加） | 含义 |
|---------------------|------|
| `claimedAt` | Runner 成功 claim 的时间 |
| `leaseExpiresAt` | 租约到期时间（如 claim 时 **now + 120s～300s**，可配置） |

- **`claim`**：仅允许 `QUEUED` 且目标 `runnerDeviceId` 匹配 **在线** Runner；原子更新为 `PROCESSING`，写入租约。  
- **回收**：定时任务（**服务端内部**，可用 BullMQ repeatable、cron 容器或 API 内 `setInterval` **仅 dev**）扫描：`status === PROCESSING` 且 `leaseExpiresAt < now()` → 重置为 **`QUEUED`**（清空租约字段，`lastError` 可写 `lease_expired`），次数上限可作为二期增强。

### 9.5 第一期自检顺序（建议）

1. `PROCESS_RUNNER_TASKS_IN_WORKER=false` +（可选）`RUNNER_TASK_DISPATCH_MODE=db-only`。  
2. 用户 JWT protected `enqueue`；Runner 凭证 protected `claim`/`complete`。  
3. 心跳 TTL + enqueue/claim 门禁。  
4. curl：**claim → complete**，DB 终态正确；确认 **Worker 日志无 COMPLETED**。

---

<a id="graceful-shutdown"></a>

## 10. 优雅退出（Graceful shutdown）

部署在 **Docker / K8s / systemd** 时，进程必须能 **`SIGTERM` / `SIGINT` 干净收尾**，避免：**HTTP 半关闭**、**BullMQ Worker 任务半截**、**DB 连接泄漏**、**Redis 连接悬挂**。

### 10.1 HTTP（`apps/api` 主进程）

| 步骤 | 说明 |
|------|------|
| 1 | 收到 **`SIGTERM`/`SIGINT`** 后先打 **`shutdown_started`** 结构化日志（含 `signal`）。 |
| 2 | **`server.close()`**：停止接受 **新** TCP 连接；已有请求继续处理。 |
| 3 | **超时**：若在 **`HTTP_SHUTDOWN_TIMEOUT_MS`**（建议默认 **30000**）内仍有未完成请求，记录 **`shutdown_timeout`** 后进入下一步（策略可按部署约定 `exit 1` 或仍断开）。 |
| 4 | **`prisma.$disconnect()`**；本进程内打开的 **Redis / BullMQ 连接** **关闭**。 |
| 5 | 打 **`shutdown_complete`** 日志，`process.exit(0)`。 |

**注意**：**Worker 单独进程**时，API 进程 **不要** 代为关闭 Worker。

### 10.2 BullMQ Worker（`pnpm worker:api`）

| 步骤 | 说明 |
|------|------|
| 1 | 收到信号 → **`shutdown_started`**。 |
| 2 | **`worker.close()`**（BullMQ）：等待 **进行中 job** 结束；配置 **`WORKER_CLOSE_TIMEOUT_MS`**（建议 **30000～60000**）防止永不退出。 |
| 3 | 超时后记录 **`worker_close_timeout`**；滞留 job 是否回到队列由 **BullMQ `lockDuration` / stalled** 策略决定，须在运维说明中写明。 |
| 4 | **`prisma.$disconnect()`**（若 Worker 使用 DB）、**Redis `quit`**。 |
| 5 | **`shutdown_complete`**，`process.exit(0)`。 |

### 10.3 编排与其它

- **Kubernetes**：`terminationGracePeriodSeconds` **≥** HTTP 与 Worker **退出超时之和**（留余量）。  
- **本地**：`Ctrl+C` 与 **`SIGINT`** 走同一套逻辑。  
- **日志**：退出路径见 [清晰日志 · 第一期底线](./logging.md#phase1-logging-baseline)，便于排查 Pod **Terminating** 卡住。

---

## 关联文档

- [实施分段](./phased-delivery.md)  
- [远程部署与 Electrobun](./remote-desktop-electrobun.md)（**Runner 单一实现**，浏览器与打包共用同一 Runner）  
- [模块拓扑](./module-topology.md)  
- [高并发](./high-concurrency.md)

← [返回文档索引](./README.md)
