# v1 设计清单与实施进度

阶段一（Node + Agent）与阶段二（React）开战前，建议把下列项 **要么定稿进 `ARCHITECTURE.md` / OpenAPI，要么在评审里显式记「暂缓 + 原因」**，避免实现到一半返工。

## 设计范畴清单（对照用）

| 范畴 | 你已有规划 | 建议一并拍板的内容 |
|------|------------|---------------------|
| **数据库** | 表结构、关系 | **迁移策略**（Prisma 等）、**软删 / 审计字段**（`createdAt`/`updatedAt`、操作者）、枚举与状态机是否在 DB 层约束 |
| **Redis** | 缓存 / BullMQ | **键命名空间**、与队列的 **部署拓扑**（同实例 vs 拆分）、**TTL 策略**、是否兼作 **频控 / 会话黑名单** |
| **Runner 心跳** | 周期上报 | **载荷字段**（设备 id、契约版本、`projectId` 摘要）、**在线判定**（超时秒数、连续 N 次未收到）、与 **入会队门禁** 的先后次序 |
| **消息队列** | 入队 / Worker | **分区键**（按 `runnerDeviceId` 等）、**幂等键**（如 jobId = taskId）、**可见性超时 / 重试 / DLQ**、失败时 **如何回写任务状态** |
| **实时通道** | WebSocket / SSE | **用哪一种**（推送用 SSE 还是 WS；Runner 拉队列是否就够了）、**鉴权**（握手带 JWT 或短期 ticket）、**断线重连与游标**、与 **心跳** 是否合并一条连接 |
| **JWT 鉴权** | 登录后发 token | **access / refresh** 策略、**签发方与密钥轮换**、claims 里是否带 **`userId` + 设备/session id**、**Runner 专用凭证**（与浏览器 token 分离与否） |
| **业务 HTTP** | CRUD、入队 | **统一错误体**（code、message、可暴露的 detail）、**分页 / 排序约定**、**`projectId` 强约束**、写盘类接口是否 **只允许「创建任务」而不直连 Runner** |
| **对 Agent（Runner）** | 消费队列、执行 | **任务 DTO**（步骤类型、Skill、payload 版本）、**结果回传**（HTTP 回调 vs 队列 ack + DB 更新）、**超时与取消**语义 |
| **对前端** | React 调 API | OpenAPI 或 JSON Schema 单源、列表/详情/SSE 事件名。**第一期**：对话与任务载荷以 **文本 / JSON** 为主，**不提供**通用文件上传；第二期若要附件再定义存储方案 |

**还建议显式设计的补充项**（容易漏）：

- **任务状态机**：允许迁移边（如 PENDING→PROCESSING→COMPLETED/FAILED）、谁有权触发、是否允许 **取消中** / **CANCELLED**。
- **Quota / 限流**：按 `userId`、`projectId`、**每 Runner 并行任务数** 的上限；429 与文案约定。
- **HTTP 幂等与重试**：写接口是否要求 **`Idempotency-Key`** 头或业务层幂等键；与队列 **jobId = taskId** 的关系（避免用户连点、客户端超时重放）。
- **API 版本与废弃**：路径前缀（如 `/v1`）或 `Accept-Version`；不兼容变更如何通知 Runner / 前端（可与 **契约版本** 合一）。
- **运维面**：`GET /health`（存活）vs **`/ready`（依赖 DB/Redis 就绪）**；指标（Prometheus 等）是否 v1 就要；**graceful shutdown** 时队列与 Worker 行为。
- **时间与边界**：DB **一律 UTC**；`lastSeenAt`、任务耗时统计的时区与展示约定。
- **附件与大对象**：**第一期已定**：用户可见内容与任务 `payload` **仅用文本 / JSON 落库**，**不做**通用上传接口与对象存储；截图/大文件等延至二期再设计。**第二期起**：可按编码角色在 Cursor 使用 **不同 `.cursor/rules`**（目录 globs），与本条存储策略无关但一并落地 Agents 仓库时再启用。
- **可观测性**：`traceId` / `requestId` **从网关到 Runner 日志**是否贯通；结构化日志字段表见 [清晰日志](./logging.md)。
- **安全与合规**：CORS、**敏感字段脱敏**、审计日志（危险操作记一条不可改记录）；**设备注册 / 吊销** 流程（新 Runner 如何绑定用户）。
- **契约版本**：Runner `contractVersion` 与 API **不兼容时** 降级策略（拒绝入队 vs 仅警告）。
- **多 Runner / 多设备**：同一用户多台机器时 **默认投递哪台**、UI 如何选设备。
- **环境与密钥**：`JWT_SECRET`、Redis、DB **各环境隔离**；见 `env-secrets.mdc`。

---

<a id="phase1-backlog"></a>

## 第一期任务 backlog（颗粒度 · 优先级）

**范围**：对齐 [实施分段 · 第一期](./phased-delivery.md)——**Node（Express）+ 浏览器内 React 页面**；**Python Runner 真实执行第二期再做**，本期 Runner 侧接口只需可被 **curl/占位脚本** 调用验收。**日历（已定）**：**2 个工作日**，按下列 **优先级 1～22 全量交付（需求不砍）**，穿插前后端并行时可仍按优先级主线验收。

**约定**：下表 **优先级数字越小越优先**；标注 **占位** 的项必须固定响应形状，便于第二期替换实现。**内容载体（第一期）**：不经由 API 做通用「文件上传」；正文与结构化数据使用 **字符串 / JSON**（DB）。

| 优先级 | 范围 | 任务 | 交付 / 占位说明 |
|--------|------|------|-----------------|
| **1** | DB | Prisma 迁移：**用户密码哈希**（如 `passwordHash`）、**刷新令牌表**（可先空表占位）、**Task** 增加认领语义字段（如 `claimedAt`、`leaseExpiresAt` 或 `PROCESSING` 细则）、Runner **设备密钥哈希**（若注册时下发明文密钥仅存哈希） | 迁移可运行、`db:seed` 调整 |
| **2** | API · 安全基础 | **密码**：注册 **bcrypt**、登录校验 | 无明文密码入库 |
| **3** | API · JWT | **签发 access JWT**（claims 含 `userId`）；**鉴权中间件**保护业务路由 | refresh **占位**（接口返回 `501` 或 TODO 固定 JSON 亦可） |
| **4** | API · 横切 | **统一错误体**（`code`/`message`/`detail?`）；**Zod** 校验封装；**CORS**（`ALLOWED_ORIGINS` 含前端 dev 端口）；**结构化日志 + `traceId`/`X-Request-Id` 中间件 + 响应头回写**，单行 JSON（stdout），请求耗时与关键业务字段（见 [清晰日志 · 第一期底线](./logging.md#phase1-logging-baseline)） | 与前端约定一致；**排障主手段** |
| **5** | API · 认证路由 | `POST /auth/register`、`POST /auth/login`、`GET /auth/me`（需 Bearer） | 登录响应含 `accessToken` |
| **6** | API · 项目 | **多项目 CRUD**：列表/创建/更新/删除（名称、`workspaceRoot`）；**全部校验 `userId` 归属** | `projectId` 全程强制 |
| **7** | API · Runner | **Runner 注册**（绑定当前用户 JWT）：生成或接收 `deviceKey` + **设备密钥**（响应仅此一次）；入库 **密钥哈希** | 与用户浏览器 token **分离** |
| **8** | API · Runner | **心跳** `POST /runners/heartbeat`：扩展载荷 **占位**（如 `contractVersion`、`mountedProjectIds` 可选空数组） | 更新 `lastSeenAt` |
| **9** | API · 门禁 | **在线判定**公共函数：`now - lastSeenAt <= RUNNER_HEARTBEAT_TTL_SEC`（env，默认如 60） | `enqueue` / `claim` 共用 |
| **10** | API · 任务 | `POST /tasks/enqueue`：**requireUser**；校验 **project 归属**；校验 **runner 归属同一用户**；**runner 在线** 否则 409；body **Zod**（`payload` 可为占位对象） | BullMQ **可选**：仅写 DB `QUEUED` + 入队元数据；不与「Runner 执行」混一谈 |
| **11** | API · 认领 | **`POST /v1/runner/tasks/claim`**（或等价路径）：**Runner 鉴权**（device key + secret **Header**）；原子挑选一条该设备的 `QUEUED` → `PROCESSING`，返回 **任务 DTO**（含 `taskId`、`payload` **占位**、`skillSchemaVersion` **占位**） | **只走 HTTPS API**；**不占 Redis 直连**；可选 **Redis 分布式锁**仅在服务端内部 |
| **12** | API · 回写 | **`PATCH /v1/runner/tasks/:taskId/complete`** / **`…/fail`**：Runner 鉴权；更新状态、`lastError`；body **占位**（如 `resultSummary` JSON） | 第二期 Python 接入同一契约 |
| **13** | API · Worker | **收窄云端 Worker**：`pnpm worker:api` 默认 **不** 将任务直接标记 `COMPLETED`（**环境变量闸门**，或拆队列：internal vs runner-task） | 与 [ARCHITECTURE](./ARCHITECTURE.md) §2.3 一致，避免假完成 |
| **14** | API · 运维 | **`GET /ready`**：检测 DB + Redis；**`/health`** 保持极简；**优雅退出**：API 与 Worker 进程分别监听 **`SIGTERM`/`SIGINT`**，`server.close` / **`worker.close`**、`prisma.$disconnect`、Redis 关闭，超时与环境变量见 [ARCHITECTURE §10](./ARCHITECTURE.md#graceful-shutdown) | 前端可不接 `/ready`；**日志打 `shutdown_*`** |
| **15** | API · 占位 | **Agent 相关**：若有单独路由（如「预览下一步」），**固定 JSON** 返回 `stepKind`/`mockOutput` | 第二期替换 |
| **16** | 前端 · 工程 | 新建 **`apps/web`**：`pnpm` + **Vite + React + TS**；`VITE_API_BASE` 指向本地 API | 浏览器开发与日后 Electrobun **同源 UI** |
| **17** | 前端 · 认证 | **登录 / 注册页**；token 存 **memory+localStorage（占位）**；axios/fetch 封装 **Authorization** | — |
| **18** | 前端 · 项目 | **项目列表**、创建/编辑、`workspaceRoot` 输入；**当前项目** Context（localStorage 占位） | 所有任务请求带 `projectId` |
| **19** | 前端 · 任务 | **创建任务**（选 Runner、`enqueue`）、**任务列表**与 **详情**（轮询 **占位**，间隔可配置） | 不接 SSE 亦可 |
| **20** | 前端 · Runner | **设备注册向导占位**：展示「复制 deviceKey + secret」、一键「我已心跳」说明 | 第二期换真实 Runner 引导 |
| **21** | 前端 · 占位页 | **设置 / 关于**：API base、当前用户邮箱 **展示** | — |
| **22** | API · 实时 | **SSE 或 WebSocket** `/v1/events`（**占位**：连接成功推送 `hello`，任务进度 **固定假事件**） | **最低优先级**；可与 **19** 二选一延后 |

**做完第一期后的自检**：浏览器用户注册→登录→建项目→注册 Runner→心跳→enqueue→用 **curl** 以 Runner 凭证 **claim→complete**，DB 状态正确；**云端 Worker 不会抢跑 COMPLETED**。

<a id="phase2-agents-calendar"></a>

### 第二期（Agents）日历与范围（粗估 · 细则第二期开局敲定）

- **量级占位**：约 **10～14 个工作日**（Python Runner、`agents/*`、真实消费与回写；含与现有 Node、`apps/web` 联调）。**非合同工期**：须在第二期 **架构 / 选型 / 流程** 定型后重拍里程碑。  
- **第二期开局须先定型**：Agents **整体技术架构**、依赖与 **技术选型**、**步骤与状态流转**、少进程 vs 多进程边界；结论进 ARCHITECTURE / ADR / OpenAPI 后再大规模编码。  
- **不含**：第一期控制面重写；进入编码前须完成 [第二期门禁](./phased-delivery.md#phase2-agents) 中的对齐梳理。

---

## 实施进度（随做随记）

以下 **只追加新行、尽量不改写旧行**（便于以后复盘）。日期可用 `YYYY-MM-DD` 或 `YYYY-MM-DD 晚` 等简短写法。

| 日期 | 在做什么 | 已解决的问题 | 遇到的问题 / 待决项 | 备注 |
|------|----------|----------------|------------------------|------|
| 2026-05-11 | 对齐 v1 实施范围：**库表、Redis、心跳、消息队列、实时通道（Socket/SSE）、JWT、业务与 Runner/前端接口**；README 增加进度记录方式 | 设计清单与「易漏项」写入文档，便于评审对照 | 逐项定稿进 `ARCHITECTURE.md` 或 OpenAPI 时再逐行补充本表 | 本表专注 v1；只**追加**新行、**少改写**旧行，便于复盘 |
| 2026-05-11 | README 拆成 `docs/*.md`，根目录只保留「文档地图」+ 子项目入口 | 单文件过长；进仓第一眼仍可跳转到全部说明 | — | 与 [docs/README.md](./README.md) 两处索引保持同步 |
| 2026-05-11 | **实施分段定稿**：见 [phased-delivery.md](./phased-delivery.md) | **第一期** Node + 前端收口；需 Agent 的接口 **占位固定返回**。**第二期** 再写 Agents 与联调；进入第二期编码前 **预留半天～一天** 核对 Node/前端与 Agents 契约对齐 | — | 交付顺序：**本地开发 → 桌面打包 / H5 → 最后云服务部署** |
| 2026-05-12 | [ARCHITECTURE.md](./ARCHITECTURE.md)：**Runner 派发模型定稿** | Runner **仅 HTTPS**（轮询/长轮询/WS 认领）；服务端 **DB + 可选 VPC 内 Redis** 调度；**禁止公网暴露 Redis 给 Runner**；BullMQ Worker 为内部/占位，与 Runner 执行语义分离 | 认领 API、`enqueue`/heartbeat **在线门禁**、JWT、收窄 `worker:api` 等待实现 | VPN 直连队列 **非默认 SaaS** |
| 2026-05-12 | **第一期 backlog 颗粒化**（本文「第一期任务 backlog」表） | Node 层任务拆到 **认领/回写/JWT/在线门禁/收窄 Worker**；前端 **apps/web** 页面清单；优先级 **1～22**；**预估 2～3 天**按序开工 | 实施时每日可在下表 **追加一行进度** | 与 [phased-delivery · 第一期](./phased-delivery.md) 对齐 |
| 2026-05-12 | **第一期内容载体**：仅 **文本/JSON**；不做通用文件上传 | 简化第一期；附件与对象存储 **defer** | — | **第二期起** 可按 `agents/*` 角色拆 **Cursor rules** |
| 2026-05-12 | [ARCHITECTURE §9](./ARCHITECTURE.md#phase1-runner-dispatch)：**队列/Worker/门禁/租约** 默认可实施方案 | **db-only 派发 + Worker 默认不完成 Runner 任务**；JWT 分期；**在线门禁**；**claimedAt/leaseExpiresAt** 与过期回收 | 代码侧 env 闸门待接入 | 防双执行与裸路由冒充 |
| 2026-05-13 | [logging.md](./logging.md#phase1-logging-baseline)：**第一期日志底线** | **traceId 贯通**、单行 JSON、请求耗时、Worker 继承 traceId；与 backlog **优先级 4** 合并交付 | — | 排障主手段，与 ARCHITECTURE §6 对齐 |
| 2026-05-13 | [ARCHITECTURE §10](./ARCHITECTURE.md#graceful-shutdown)：**优雅退出** | API `server.close` + Prisma/Redis 关闭；Worker `worker.close` + 超时；**shutdown_* 日志**；与 backlog **优先级 14** 合并 | K8s `terminationGracePeriodSeconds` 留余量 | 避免 Terminating 卡住 / 连接泄漏 |
| 2026-05-13 | **阶段衔接**：第一期后再做 Agents | Node + `apps/web` **闭环后再** 细分 Agents、梳理契约与排期；不与第一期并行铺开 | — | 见 [phased-delivery · 第二期](./phased-delivery.md#phase2-agents) |
| 2026-05-14 | **日历拍板** | 第一期 Node + React **`apps/web`：2 个工作日**（backlog 全量不砍） | — | 第二期 Agents：**10～14 个工作日**（含与前后端联调），见 [v1 · 第二期日历](./v1-design-and-progress.md#phase2-agents-calendar) |
| 2026-05-14 | **第二期细则 defer** | Agents **架构 / 技术选型 / 流程细节** 第二期开局再定型；**10～14 天为粗估**，定型后重排里程碑 | — | 见 [phased-delivery · 第二期](./phased-delivery.md#phase2-agents) |

← [返回文档索引](./README.md)
