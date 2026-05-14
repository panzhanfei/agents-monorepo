# 总览、版本节奏与必选基础设施

本仓采用 **云端控制面 + 本机 Electrobun 桌面端** 架构（前端 **React**）：

| 层级 | 技术 | 职责 |
|------|------|------|
| **本机客户端** | **[Electrobun](https://blackboard.sh/electrobun/docs/) + React** | 打包为 **桌面应用**：多项目配置、对话与任务视图、流式日志；通过 **HTTPS** 连云端 API；与本机 **Runner（Python）** 同进程或 RPC 协作，**唯一**经授权操作 `workspaceRoot` 的入口 |
| **接口 / 中间层（部署在云端）** | **Node.js + Express** | 鉴权、多项目元数据、任务编排；**经消息队列** 投递异步任务；**不在服务器上对客户工程目录做增删改查**；将需落盘 / Git / 子进程的步骤 **发布到绑定 `runnerDeviceId` 的队列分区** |
| **Agents / Runner** | **Python（[uv](https://github.com/astral-sh/uv)）** | **跑在用户电脑上**：**消费队列（拉取/ACK）** 执行各 Agent；**周期性上报心跳** 至云端以标记在线；服务器 **无** 客户仓写权限；依赖由本机 **uv** 管理 |

共享的 **步骤类型、任务 DTO、运行时 Skill** 等契约，建议在仓库内以 **OpenAPI / JSON Schema**（或等效单一源码）描述，由 Node 与 Python 共同遵循，避免双端各写一套枚举。

## 版本落地顺序（当前约定）

| 阶段 | 范围 | 说明 |
|------|------|------|
| **一** | **Node + Agent/Runner** | **v1 核心**：云端 Express（控制面、队列、任务状态）与本机 Python Runner 跑通闭环；契约与入队语义优先在这里定型。 |
| **二** | **React 客户端** | 用 **React** 做主要操作界面；产品壳为 **Electrobun 桌面**（开发期也可浏览器直连 API 联调）。 |
| **三（更后）** | **小程序 / 飞书 H5 / 通用 H5** | 在 **同一套 Express API** 上增加渠道；**飞书机器人**（会话内 @、卡片、事件回调）**不纳入近期排期**，有精力再接入，届时再定是否只要通知推送或完整指令能力。 |

> **目录形态**：例如 `apps/desktop`（**Electrobun + React**）、`apps/api`（Express，云端）、`agents/*`（Runner 内 Python，各目录 **`pyproject.toml` + `uv.lock`**）；下文以逻辑名称为准，可对齐调整。

## pnpm + uv 混合 monorepo

- **pnpm**：管理 React 桌面壳（Electrobun 工程）、Express 与 TS 共享包（`pnpm-workspace.yaml`、`pnpm-lock.yaml`）；Electrobun 主体依赖 **Bun** 运行时，与 pnpm 并存时以各子包 README 为准。  
- **uv**：管理全部 Python Agent（每个服务一个项目，或仓库根一个 **uv workspace** 统揽多个 `agents/*` 子包）。  
- **关系**：同属一个 Git 仓库；**不要求** 把 Python 放进 `package.json`。根目录可用脚本把两端串起来，例如 `"dev:agents": "uv run --directory agents/coding python -m coding.cli"`，或在 Turborepo 里为 Python 任务单独配置 `outputs` / `cache`。  
- **锁文件**：Node 与 Python 各一把锁（`pnpm-lock.yaml` + 各 `uv.lock`），CI 中同时安装两者即可。

## 必选基础设施：消息队列与 Runner 心跳

两者均为 **架构必选**，不是可选优化项。

| 组件 | 部署位置 | 作用 |
|------|----------|------|
| **消息队列** | **云端**（与 Express 同 VPC 或托管服务） | **削峰、异步、可靠投递**：Express 只做「校验 + 入队 + 更新任务状态」；Runner **拉取 / 订阅并 ACK** 任务，避免同步 HTTP 阻塞与易丢消息；支持 **按 `runnerDeviceId` / `projectId` 分区**，防止错投；**DLQ、可见性超时、幂等键** 在 `ARCHITECTURE.md` 定稿（技术选型如 Redis Streams、RabbitMQ、NATS、SQS 等）。 |
| **Runner 心跳** | **本机 Runner → 云端 API** | **在线状态真源**：周期性上报（或 WebSocket 保活），载荷含 `runnerDeviceId`、`userId`、Runner/契约版本、可选已挂载 `projectId` 摘要；云端维护 **`lastSeenAt`**，用于 **仅向在线 Runner 派发可写盘任务**、桌面与各 **远端渠道（小程序、飞书 H5 等）** 展示「设备离线」及告警。**间隔、超时判定（如连续 N 周期未收到即离线）** 写入 `ARCHITECTURE.md`。 |

**关系简述**：写盘类步骤 **先入队**；调度或消费前校验 **目标 Runner 心跳仍有效**，否则 **延迟入队或返回明确失败**，与 **小程序、飞书 H5** 等远端渠道的门禁一致（若日后加飞书机器人，同一套规则）。

---

## 文档与约定

| 资源 | 说明 |
|------|------|
| **本目录** `docs/` | 仓库说明的 **拆分正文**；根目录 `README.md` 提供 **一页式文档地图** |
| [v1 设计清单与实施进度](./v1-design-and-progress.md) | 库表 / Redis / 队列 / 实时通道 / JWT / 接口对照；[**第一期 backlog**](./v1-design-and-progress.md#phase1-backlog)；[**实施进度表**](./v1-design-and-progress.md#implementation-progress) |
| [Python Runner 技术选型](./agents-runner-tech-stack.md) | **定稿**：FastAPI、httpx、LangGraph+LangChain、LlamaIndex、SSE、uv |
| [Agent 学习模块](./agents-learning.md) | 三栈练习边界与阅读顺序 |
| [Agent 难点与坑点](./agents-challenges.md) | Runner / Python / RAG 专项难点 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | HTTP 契约、步骤机、Skill、消息队列与心跳策略、部署拓扑（持续补齐） |
| `FEISHU_COMMANDS.md` | **（可选、后期）** 飞书机器人指令映射；飞书 H5 走 API，不依赖此文 |
| `WECHAT_MINIPROGRAM.md` | **（后续规划）** 微信小程序 |
| `../.cursor/rules/project-conventions.mdc` | Monorepo 通用约定 |
| `../.cursor/rules/env-secrets.mdc` | 环境变量与密钥 |

（若 `FEISHU_COMMANDS.md` / `WECHAT_MINIPROGRAM.md` 尚未创建，以评审中定稿为准。）

← [返回文档索引](./README.md)
