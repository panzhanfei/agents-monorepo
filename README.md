# Agents Monorepo

**个人向**的一条龙骨架：人不在工位时，用 **飞书** 一句话触发本机（或你绑定的环境）上的 **需求整理、编码登记、审核门禁、全量测试、打包与发布/巡检**——先求 **轻量、可跑通**，再按需要加厚。

**本版范围**：用户侧 **只做飞书**（自建应用、事件订阅、机器人发消息）；**不**为企业微信、Slack、钉钉、通用 Web 对话台等做多通道产品化。编排器上的其它 HTTP 主要用于 **联调、健康检查、以及你本地用 curl 模拟飞书 body**，不视为对外多入口。若日后要换通道，优先在 orchestrator 前加一层适配，而不是在各 Agent 里分叉。

| 典型场景 | 说明 |
|----------|------|
| 离桌补需求 | 群里发「需求分析：…」出 PRD；要改同一版用 **「需求分析 修订 &lt;任务ID&gt;：…」**（见飞书「帮助」文案） |
| 离桌跟质量 | 「审核」「全量测试」在 `TARGET_WORKSPACE_PATH` 下跑门禁与测试 |
| 离桌触运维 | 发包、巡检等走 `ops-agent`，敏感动作受验证码等配置约束（见 `.env.example`、`agents.config.yaml`） |
| 重置编排记忆 | 群内发 **「清空任务」**：`TASK_STORE_DRIVER=memory` 时清空本地任务表（不删代码仓库）；要避免误用旧任务 ID 或嫌「状态」太乱时用 |

底层仍是 **Turborepo + pnpm**、共享 ESLint/TS、根 `.env` 与 **`.cursor/rules`**，方便和日常 Cursor 开发习惯对齐。若将来扩到多人协作，可把同一套编排接到共享任务存储与权限，而不必推翻结构。

## `apps/*`：编排 + 五类 Agent + 本地控制台（7 个应用）

| 应用 | 职责 |
|------|------|
| **`orchestrator`** | **唯一对外飞书/Webhook 边界**：意图路由、验证码、任务状态、调用各 Agent、汇总 `feishuReplyText` |
| **`requirements-agent`** | **需求分析**：口头需求 → 结构化 PRD / 验收标准 / 风险 |
| **`coding-agent`** | 编码（当前 MVP：配置自检与占位应答，演进真实改仓） |
| **`review-agent`** | 审核：确定性门禁（脚本）+ 与 **`agents.config` 同源** AI 规则 glob |
| **`test-agent`** | 全量测试命令与报告摘要 |
| **`ops-agent`** | 打包 / 发放 / 备份回滚 / 只读巡检（由配置与安全口令约束） |
| **`agent-console`** | **可选本地 Web UI**（Vite + API）：多项目 `target` 编辑、整份 YAML 校验/写回、经服务端转发的 LLM 流式对话；**不是**飞书第二入口，默认仅回环 |

默认 HTTP 端口见 **`agents.config.yaml`** 与 **`.env.example`**（编排约 **4010–4060**；控制台默认 **5275 / 5280**）。

## 仓库内其它路径

| 路径 | 说明 |
|------|------|
| `packages/pipeline-core` | 流水线步骤类型、任务存储契约、运行时 Skill 枚举与各 Agent 间 DTO |
| `packages/agents-config` | `agents.config.yaml` 的 Zod 模型、工作区/飞书目标解析、审核 profile 等与编排共享的配置逻辑 |
| `packages/logger` | 结构化日志 + 加载 monorepo 根 `.env`（`loadMonorepoEnvFromEntry`） |
| `packages/http-errors` | `AppError`、Express 统一错误、`helmet`、404 |
| `packages/eslint-config`、`packages/typescript-config` | 共享工程配置 |
| `.env`（自 `.env.example`，**勿提交**） | 端口、目标路径、密钥；含 **`TASK_STORE_DRIVER`**（MVP 常用 `memory`）及预留 `DATABASE_URL` / `REDIS_URL` |
| `e2e` | Playwright：拉起各应用 `/health` 冒烟 |
| `agents.config.yaml` | `pipeline.fullTestCommand` / `publishCommand`、`review` 等结构化默认 |
| `docs/FEISHU_COMMANDS.md` | 飞书话术、验证码；**第 4 节** PRD（新建、`修订+<任务ID>`、引用机器人 PRD **回复**、新开题）；**第 12 节**「状态」「清空任务」（memory） |
| `docs/CUSTOMER_GUIDE.md` | **客户导引**；与群内 **「帮助」** 相辅相成 |
| `docs/ARCHITECTURE.md` | **架构**：契约、附图（部署/分层/序列）、HTTP 栈、Skill 载荷等 |
| `docs/IMPLEMENTATION_ROADMAP.md` | **落地顺序**与自检清单 |

持久化 AI 编码约定见 **`.cursor/rules/*.mdc`**。更细的**信任边界、配置策略、多张架构图（部署 / Monorepo / 可选 DFD）**见 **`docs/ARCHITECTURE.md`**。

## 命令（根目录仅保留）

```bash
pnpm install
pnpm run dev           # 先 build @agents/*，再 ngrok + turbo run dev（全 apps 并行）
pnpm run logs          # 另开终端聚合 logs/*.log
pnpm run build
pnpm run test
pnpm run test:coverage
pnpm run knip
pnpm run e2e
pnpm run e2e:ui
```

- **`dev`**：`scripts/dev-with-ngrok.sh`（需 **ngrok** 与仓库根 **`.env`**）；无隧道本地全量：`pnpm exec turbo run dev` 或 `bash scripts/dev-local-stack.sh`。  
- 飞书话术、验证码、群内「帮助」： **`docs/FEISHU_COMMANDS.md`**。

**编排并发（MVP）**：同一 **`action`** 在任务处于 `pending` / `running` / `awaiting_confirmation` 时不重复建独占任务 → **`409`**，响应体可有 **`feishuReplyText`**。可在 `metadata` 中带 **`channelId`** 实现按会话互斥（不传则单机下常为全局互斥）。

飞书入口示例：`POST /feishu/webhook`（或 `/v1/feishu/webhook`），极简 body：`{"text":"编码：修登录","channelId":"oc_xxx"}`；真飞书事件需按开放平台字段做解析适配。

## 架构拓扑（摘要）

```mermaid
flowchart TB
  subgraph entry [接入]
    Feishu[飞书消息 / Webhook]
    Ngrok[ngrok · pnpm dev]
  end
  subgraph orch [编排]
    Orch[orchestrator\n任务 · action 路由]
  end
  subgraph agents [Agent HTTP]
    Req[requirements-agent\nPRD]
    subgraph impl [实现与验证]
      direction TB
      Cod[coding-agent\n编码]
      Rev[review-agent\n门禁 + AI 审核]
      Tst[test-agent\n全量测试]
    end
    Ops[ops-agent\n打包 / 发布 / 巡检]
  end
  subgraph ops_ui [运维 / 开发者 · 可选]
    ConsoleUI[agent-console\nUI http://127.0.0.1:5275]
    ConsoleAPI[agent-console API\n:5280]
  end
  subgraph skill_ctx [运行时 Skill · v1]
    direction LR
    Role[implementationRole]
    Stack[stackProfile]
    OpsMode[opsMode]
  end
  subgraph shared [共享]
    Core[@agents/pipeline-core]
    Cfg[@agents/agents-config]
  end
  Feishu --> Ngrok --> Orch
  Orch --> Req
  Orch --> Cod
  Orch --> Rev
  Orch --> Tst
  Orch --> Ops
  Orch -. 载荷 .-> Role
  Orch -. 载荷 .-> Stack
  Orch -. 载荷 .-> OpsMode
  Role -. 可选 .-> Req
  Stack -. 可选 .-> Req
  Role -.-> Cod
  Stack -.-> Cod
  Role -.-> Rev
  Stack -.-> Rev
  Role -.-> Tst
  Stack -.-> Tst
  OpsMode -.-> Ops
  Req --> Core
  Cod --> Core
  Rev --> Core
  Tst --> Core
  Ops --> Core
  Orch -.读配置.-> Cfg
  ConsoleUI --> ConsoleAPI
  ConsoleAPI -.读写.-> Cfg
  ConsoleAPI -.LLM 转发.-> LLMUp[LLM · OpenAI 兼容]
  Req -.-> LLMUp
  Rev -.-> LLMUp
```

### 职责边界（摘要）

| 层级 | 职责 |
|------|------|
| **orchestrator** | 解析意图、验证码、任务状态、调下游、回写群消息 |
| **requirements-agent** | 需求结构化，**不**直接改业务仓库 |
| **coding-agent** | 编码任务（与编排策略一致；演进中） |
| **review-agent** | blocking 脚本 + 规则化 LLM 评审 |
| **test-agent** | 在 `TARGET_WORKSPACE_PATH` 下执行配置的全量测试 |
| **ops-agent** | 构建、发布、备份回滚、只读探测（由配置约束命令） |
| **agent-console** | 本地配置与对话工具；**不**承担飞书鉴权与任务真相 |
| **pipeline-core** | 跨应用共享类型、任务契约与步骤枚举 |
| **agents-config** | YAML/env 解析与校验，供 orchestrator、review、coding、console 等复用 |

**配置**：非敏感默认在 `agents.config.yaml`；**密钥、SSH、API Key** 仅在 `.env`（见 `.env.example`）。更细的信任边界与演进见 **`docs/ARCHITECTURE.md`**、落地步骤见 **`docs/IMPLEMENTATION_ROADMAP.md`**。
