# apps/api

云端 **Express** 控制面：健康检查、Runner 心跳、任务入队（BullMQ + Redis）、PostgreSQL 持久化。

## 前置条件

- Node 18+、`pnpm`
- **Docker**：用于本地 PostgreSQL + Redis（见仓库根 `docker-compose.yml`）

## 首次初始化

```bash
# 仓库根目录：启动数据库
docker compose up -d

# 复制环境变量
cp apps/api/.env.example apps/api/.env

# 安装依赖（若在根目录已 pnpm install 可跳过）
pnpm install

# 迁移 + 生成 Prisma Client
pnpm --filter api exec prisma migrate deploy
pnpm --filter api db:generate

# 种子数据（dev@local.test / dev-runner-1）
pnpm --filter api db:seed
```

## 运行

两个终端：

```bash
# 终端 1：HTTP
pnpm dev:api

# 终端 2：BullMQ Worker（消费 agent-tasks）
pnpm worker:api
```

- 健康检查：`GET http://127.0.0.1:3001/health`
- 占位 ID：`GET http://127.0.0.1:3001/dev/placeholders`
- 心跳：`POST http://127.0.0.1:3001/runners/heartbeat`，JSON `{"deviceKey":"dev-runner-1"}`
- 入队：`POST http://127.0.0.1:3001/tasks/enqueue`，JSON `{"projectId":"<from placeholders>","runnerDeviceKey":"dev-runner-1"}`
- 查询任务：`GET http://127.0.0.1:3001/tasks/<taskId>`

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 存活 |
| GET | `/dev/placeholders` | 种子用户 / 项目 / Runner 占位信息 |
| POST | `/runners/heartbeat` | body: `{ deviceKey }`，更新 `lastSeenAt` |
| POST | `/runners/register` | body: `{ deviceKey, userId }`，注册新 Runner |
| POST | `/tasks/enqueue` | body: `{ projectId, runnerDeviceKey, payload? }` |
| GET | `/tasks/:taskId` | 任务状态（`taskId` 为 UUID） |
