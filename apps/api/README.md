# `apps/api` — Express 控制面

## 本地运行

1. 启动依赖：`docker compose up -d`（PostgreSQL + Redis）。
2. 复制环境变量：`cp apps/api/.env.example apps/api/.env`，按需修改密钥。
3. 安装依赖：仓库根目录 `pnpm install`。
4. 迁移与种子：`pnpm db:migrate`（首次可先 `pnpm --filter api db:migrate:dev` 交互命名迁移）、`pnpm db:seed`。
5. 启动 API：`pnpm dev:api`；队列 Worker（可选）：`pnpm worker:api`。

默认 **`RUNNER_TASK_DISPATCH_MODE=db-only`**，`enqueue` 只写 PostgreSQL；`pnpm worker:api` 在 **`PROCESS_RUNNER_TASKS_IN_WORKER=false`** 时不会对 Runner 任务写 **`COMPLETED`**。

## 主要路由（第一期）

| 区域 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 健康 | GET | `/health` | 存活 |
| 就绪 | GET | `/ready` | DB + Redis |
| 认证 | POST | `/auth/register`、`/auth/login` | bcrypt |
| 认证 | GET | `/auth/me` | Bearer |
| 认证 | POST | `/auth/refresh` | 占位 **501** |
| 项目 | CRUD | `/projects` | Bearer |
| 任务 | POST | `/tasks/enqueue` | Bearer；Runner 在线门禁 |
| 任务 | GET | `/tasks/project/:projectId`、`/tasks/:taskId` | Bearer |
| Runner | POST | `/runners/register` | Bearer；响应 **`deviceSecret` 仅一次** |
| Runner | GET | `/runners` | Bearer；列出设备 |
| Runner | POST | `/runners/heartbeat` | `X-Device-Key` + `X-Device-Secret` |
| Runner API | POST | `/v1/runner/tasks/claim` | 设备头 |
| Runner API | PATCH | `/v1/runner/tasks/:taskId/complete` \| `/fail` | 设备头 |
| 占位 | GET | `/v1/agent/preview` | Bearer；固定 mock JSON |
| 占位 | GET | `/v1/events/stream` | Bearer；SSE `hello` + 假进度 |
| 开发 | GET | `/dev/whoami` | `NODE_ENV !== production` 或 `ENABLE_DEV_ROUTES=true` |

生产 **`JWT_SECRET`** 须足够长（`env` 校验至少 16 字符）。

← [文档索引](../../docs/README.md)
