# 架构说明（边界与演进约定）

本文描述 **架构层面** 的信任边界、共享契约、配置与任务状态、同步/异步形状、可观测性、幂等，以及 **规划期易漏的风险与非功能约束**（§8–§11）；与 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md)（人机指令）、[IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)（落地顺序）并列。实现细节见各 `apps/*` 与 `.cursor/rules/*.mdc`。

---

## 附图：系统与仓库结构（Mermaid）

与 **§15**「六段 Skill 逻辑视图」互补：此处强调 **部署信任边界、Monorepo 分层、`customer-targets` 配置合并、飞书主路径与本地 dev 启动关系**。

### 附图-1 系统上下文（信任边界）

```mermaid
flowchart TB
  subgraph external [外部]
    U[飞书 / 用户]
    LLM[(LLM\nOpenAI 兼容)]
  end
  subgraph dmz [可选公网]
    NG[ngrok]
  end
  subgraph host [编排机 · 默认回环]
    OR[orchestrator\n飞书验签 / 任务真相]
    AG[各 Agent\nHTTP]
    AC[agent-console\nUI + API]
    CFG[(agents.config.yaml)]
    CT[(customer-targets/\n各 id · target.yaml · ai-rules)]
    E[(.env)]
    WS[(客户业务仓库)]
  end
  U <--> NG
  NG <--> OR
    OR --> AG
    OR --> CFG
    AG --> WS
    AG -.-> LLM
    AC --> CFG
    AC --> CT
    AC -.读写根 .-> E
    AC -.LLM 转发.-> LLM
    AC -.pipeline 联调.-> OR
    CFG -.definitionPath.-> CT
    AG -.绑定目标 id 时读 ai-rules.-> CT
  OR -.-> E
  AG -.-> E
```

### 附图-2 Monorepo：共享包 → 应用（主要依赖）

```mermaid
flowchart BT
  subgraph pkgs [packages]
    PC[pipeline-core]
    ACfg[agents-config]
    LOG[logger]
    HTTP[http-errors]
  end
  subgraph apps [apps]
    O[orchestrator]
    RQ[requirements-agent]
    CD[coding-agent]
    RV[review-agent]
    TS[test-agent]
    OP[ops-agent]
    UI[agent-console]
  end
  PC --> O
  PC --> RQ
  PC --> CD
  PC --> RV
  PC --> TS
  PC --> OP
  ACfg --> O
  ACfg --> RV
  ACfg --> CD
  ACfg --> UI
  LOG --> O
  LOG --> RQ
  LOG --> CD
  LOG --> RV
  LOG --> TS
  LOG --> OP
  LOG --> UI
  HTTP --> O
  HTTP --> RQ
  HTTP --> CD
  HTTP --> RV
  HTTP --> TS
  HTTP --> OP
  HTTP --> UI
```

> **约定**：以各 `package.json` 为准；**禁止** `apps/*` 之间 **直接 import 源码**（经 HTTP 或 `@agents/*` 通信）。

### 附图-3 飞书「编码」类动作：主路径（概念）

```mermaid
sequenceDiagram
  participant F as 飞书
  participant O as orchestrator
  participant C as coding-agent
  participant W as 客户仓库
  F->>O: Webhook / 文本意图
  O->>O: 验签 · 状态机 · workspace 解析
  O->>C: POST /v1/coding/run
  Note right of C: taskId, instruction, workspacePath?
  C->>W: 路径存在性 · AI 规则 glob 枚举等自检
  C-->>O: accepted / summaryMarkdown / configAssessment
  O-->>F: feishuReplyText
```

### 附图-4 根目录 `pnpm dev`（ngrok + turbo）

```mermaid
flowchart LR
  A[build @agents/*] --> B[ngrok → ORCHESTRATOR_PORT]
  B --> C[turbo run dev\n并行各 app]
```

另：**无隧道**全量本地并行：`pnpm exec turbo run dev` 或 `bash scripts/dev-local-stack.sh`（仅脚本提示，非根 `package.json` 收录）。

### 附图-5 `customer-targets/` 与配置合并（概念）

```mermaid
flowchart TB
  subgraph root [编排仓根]
    ROOTYAML[agents.config.yaml\ntarget.projects 桩]
    ENV[(.env)]
    subgraph ct [customer-targets/id/]
      DEF[target.yaml\nworkspacePath · Git · 运维…]
      AIR[ai-rules/\n*.md · *.mdc]
    end
  end
  ROOTYAML -->|definitionPath| DEF
  hydrate[hydrateAgentsConfigTargetProjects\n合并 DEF + 内联覆盖]
  DEF --> hydrate
  ROOTYAML --> hydrate
  hydrate --> runtime[ITargetProjectEntry[]\n供 orchestrator / Agent]
  AC[agent-console] --> DEF
  AC --> AIR
  AC --> ENV
  AC --> ROOTYAML
```

---

## 1. 信任边界与唯一入口

| 位置 | 职责 |
|------|------|
| **orchestrator** | 唯一 **对外边界**：飞书 / Webhook / 公网可直达的 HTTP。验签、验证码、幂等键、任务生命周期、是否允许进入某步骤（状态机）**优先落在此层**。 |
| **各 Agent** | **对内服务**：假定由受信方（本机回环、内网、或 mTLS 后的同伴）调用；契约为带 `taskId` 等的 **内部任务请求**，不重复解析飞书协议。 |

**实现时需明示**：Agent 监听地址是否仅绑定 `127.0.0.1`、是否另有内部令牌；避免将 Agent 端口误暴露到公网却未鉴权。

---

## 2. 契约层（`pipeline-core` 与扩展）

- **现状**：`@agents/pipeline-core` 提供流水线 **步骤种类**（如 `requirements_analysis`、`qa_full_suite`、`ops_publish`）等枚举。
- **演进**：orchestrator ↔ 各 Agent 的 **请求/响应模型、错误码、任务状态枚举** 应集中在 **单一事实来源**：
  - 优先在 `packages/pipeline-core` 中扩展；或
  - 另建 `packages/contracts`（若希望 core 保持「纯步骤」、DTO 体量大时再拆）。

**原则**：跨进程边界只依赖 **版本化** 的共享包；禁止 `apps/*` 互相直接 import，禁止各应用私下 duplicate 一套 DTO。

**兼容与发布**：契约或 DTO 发生 **破坏性变更** 时，应 **显式升版本**（包 semver 或契约 `version` 字段），并约定 **orchestrator 与下游 Agent 同仓/同版本部署** 或短暂 **双读兼容窗口**；避免「仅升级一侧」导致静默解析失败。

---

## 3. 配置架构（YAML + env）

| 来源 | 适用 |
|------|------|
| **`agents.config.yaml`** | 可提交的默认与非秘密项：端口、流水线命令占位、审核 profile、`feishu.*` 开关等。 |
| **`.env` / 环境变量** | 秘密、机器相关覆盖、本地路径；优先级 **env 覆盖 YAML**（与仓库注释一致）。 |

**读取策略**：

- **orchestrator**：需要 **聚合视图**（安全、飞书、下游 Agent 基址、目标工作区等）。
- **各 Agent**：理想为 **最小子集**（本服务端口、超时、`TARGET_WORKSPACE_PATH` **或单次请求体内的** `workspacePath` 字段等），避免每个 Agent 再充当全局配置中心。
- **实现落点**：共享 **`loadAgentsConfig()`**（`@agents/agents-config`）解析 `agents.config.yaml` 并经 **Zod 校验**，而非分散重复读文件。

**多目标业务仓库（推荐形态）**：`agents.config.yaml` 的 `target.projects` 每项为 **`{ id, definitionPath?, …内联可选字段 }`**（Zod：`@agents/agents-config`）。推荐 **`definitionPath`** 指向编排仓内 **`customer-targets/<id>/target.yaml`**（单文件里含 `workspacePath`、`label`、Git/运维字段等）；启动时 **`hydrateAgentsConfigTargetProjects`** 把定义文件与 YAML 行上非空内联字段 **合并** 为运行时 **`ITargetProjectEntry[]`**（合并后不再暴露 `definitionPath`）。**飞书链路**仍由 orchestrator 按「会话绑定 / 首行目标指令 / `defaultProjectId`」选出 **单一 `id`**，解析出 **`workspacePath`（绝对路径）** 再调用编码、审核与测试 Agent（与单机 `.env` 的 `TARGET_WORKSPACE_PATH` 等价语义）。详见 `docs/FEISHU_COMMANDS.md`。未配置 `projects` 时可回落 **遗留** 配置。

**每目标编排侧语义规则**：目录 **`customer-targets/<id>/ai-rules/`**（`*.md` / `*.mdc`）由 **agent-console** 上传并随编排仓 Git 版本化；当任务 **绑定该 `id`** 时，**review-agent** 可将 **LLM 规则输入** 限定为上述编排目录（与客户仓内 `review.profiles.*.aiRulesGlob` / `customerRulesDir` **脱钩**）；**确定性 blocking** 仍以 **`agents.config.yaml` → `review.profiles.*.blockingCommands`**（及 env 覆盖）为真源。未绑定多目标或旧链路仍可按 profile 扫客户工作区。

**客户业务仓前置条件**：实际执行仍以 **某一个解析后的 workspace 根** 为客户项目 cwd；须在文档或自检中约定 **Node / pnpm（或包管理器）/ 可选 Turbo 版本** 与客户仓一致，否则「模板里能跑、客户仓里挂」的漂移属于 **环境类问题**，不靠编排代码单独解决。

---

## 4. 任务与状态（编排内核）

- **职责归属**：**任务图、当前步骤、业务状态机**（例如「需求分析未完成则禁止编码」）由 **orchestrator** 持有；Agent **汇报结果**，不把全局任务真相分散到多服务。
- **演进**：
  - 早期：进程内 `Map` / 内存结构即可。
  - 后期：抽象 **TaskStore**（接口），背后换 Redis / DB，**不改变** orchestrator 对外与对 Agent 的契约形状。

**实现近况（MVP）**：`@agents/pipeline-core` 导出 **`ITaskStore` / `ITaskRecord` / `TaskStatus`**；orchestrator 默认 **`MemoryTaskStore`**，环境变量 **`TASK_STORE_DRIVER=memory`**。**同 `action` 并发**：创建任务前调用 **`findActiveTaskByAction`**（见 `IFindActiveTaskQuery`），冲突时 **`409`** + **`feishuReplyText`**，避免飞书侧重复「编码」等。后续可新增 **`PostgresTaskStore`**（Prisma + 任务表）、**向量检索**（pgvector 等）作为 **独立模块**，与 TaskStore **正交**（检索不替代任务持久化）。**Redis / Bull** 用于队列与分布式锁时，再按需接入；orch 对外路由与 `ITaskStore` 签名保持不变。

**需求（PRD）与编码的语义**：在状态机中显式区分 **需求产物「草稿」** 与 **「已确认 / 可实施」**（命名以契约枚举为准），避免未对齐口径即进入 `coding`。**谁在什么动作下完成确认**（飞书指令、确认回调或 orchestrator 固定规则）应在产品上定死，减少与需求 Agent 输出之间的扯皮。

**群内分步确认（可选）**：当 `feishu.confirmBetweenPipelineSteps: true`（见 `agents.config.yaml`）时，每个主要子步骤结束后由 orchestrator **向群推送摘要**，并等待用户 **`workflow_continue` / `workflow_pause` 类** 回复再推进（话术见 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) §14）。任务状态须能表示 **`pending_confirmation`** 与 **已完成子步骤**，并与 `taskId`、幂等键协同，避免 Webhook 重试导致 **重复推进或跳过确认**。

**组合流水线**：内部动作 **`full_release`** 表示 **全量测试 → 打包（构建）→ 发包**，顺序绑定 `pipeline.fullTestCommand`、`pipeline.publishCommand`（或等价 build）及既有 ops 发布路径；须 **验证码**，且整体应按 **§5（同步 HTTP 与异步执行）** **异步执行**，分步确认打开时在测试后、构建后、**最终发包前** 等边界停顿（见 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) §14–§15）。

---

## 5. 同步 HTTP 与异步执行

| 形态 | 适用 |
|------|------|
| **同步请求–响应** | 短路径：需求摘要触发、单次审核触发等（受网关超时约束）。 |
| **异步** | 长耗时：全量测试套件、发布/滚动。HTTP 可仅表示 **接纳任务**（入队）；执行在 **worker / 子进程**，通过 **状态查询或回调** 汇报 completion。 |

不必首日引入消息队列，但 **orchestrator** 侧建议按 `.cursor/rules/orchestrator-app.mdc` 为 **`workers` / 长任务** 预留模块边界，避免长逻辑堆在单个 HTTP handler 里。

**网关与客户端**：对外 HTTP **不得依赖「单请求直到全量测/发布跑完」**；否则易出现 **网关超时** 与 **客户端重试导致双跑**（与幂等设计联动）。接纳请求与 **实际执行完成** 应能在架构上拆开。

**容量与背压**：为子进程 / Worker 设 **全局并发上限**、单任务 **超时** 与 **队列或拒绝策略**，避免弱 Runner 上 **OOM 或拖死** 整台编排机（具体阈值由部署环境配置）。

---

## 6. 可观测性（关联 ID）

- **约定**：`taskId` 由 orchestrator 生成（或与飞书侧 id 可逆映射），并 **贯穿** 日志与对下游的调用（HTTP header 或 body 字段任选其一为固定规范）。
- **可选**：`traceId` / OpenTelemetry 等与 `taskId` 并列；日志字段建议至少包含 `taskId`、`action`、**截断后的** `workspacePath`、下游 Agent 名与耗时。

**日志与合规（原则）**：飞书正文、用户标识、完整路径可能含 **PII**；架构上应约定 **默认脱敏或截断**、**保留周期**、以及是否与第三方日志平台同步——满足内审或辖区合规时再细化策略。

---

## 7. 幂等与重试

- **假设**：飞书/Webhook 可能 **至少投递一次**；编排层应设计 **任务级幂等** 或「同一任务的破坏性操作只提交一次」。
- **引用回复（需求修订）**：编排可解析 IM 消息中的 **`parent_id` / `root_id`**，并与 **机器人成功发出的 PRD `message_id`** 在进程内建立 **临时锚点**，将用户补充 **合并进既有** `requirements_analysis` 任务（与「同一次 Webhook 重复投递」的去重策略正交）；细节见 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) **第 4、12 节**。
- **落点**：幂等键、去重窗口、**发布/回滚/改配** 等关键操作应在 **orchestrator**（或其后继 TaskStore）统一策略，而非每个 Agent 各自防重。

---

## 8. 人机指令与内部动作的一致性

- [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) 描述 **用户可见** 的句子与示例。
- **内部**须映射到稳定 **`action` / `PipelineStepKind` / 契约枚举**，与 `pipeline-core` 保持一致，避免「文档一套名字、代码另一套」长期分叉。

**同步约束**：飞书侧文案、**意图路由表**、**状态机允许的下一步** 三者应同事务变更；推荐 **更新 FEISHU 文档时顺带更新路由/映射或契约单测**，减少群里说法与系统拒答理由不一致的运维纠纷。

---

## 9. 安全与输入（HTTP + 工作区）

- 新增或扩展 **对外 HTTP** 时，在统一入口配置常见安全响应头（如 `X-Content-Type-Options`、`Referrer-Policy` 等），与部署方式一致；敏感接口限流与鉴权。详见仓库 `.cursor/rules/security-coding.mdc`。

**不可信输入**：从消息或查询中解析的 **工作区路径、分支名、自定义命令片段** 等，在写入 shell 或 `exec` 前须 **校验与白名单化**（解析为真实路径、禁止 `..` 逃逸、禁止拼接未转义片段），优先 **参数数组** 调用子进程，避免 **命令注入**。

**静态验证码**：适合小范围 PoC；群可见性高时存在 **转发泄露** 风险；增强方案（私聊校验、轮换）见 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) 与实现时的 `security.verificationCode` 约定。

---

## 10. 质量与工程一致

- **CI 与 Agent**：`review-agent` / `test-agent` 执行的 **lint / typecheck / fullTest** 等应与 **CI 真源**一致（同源配置：`agents.config.yaml` 的 `pipeline` / `review`、或仓库内单一脚本入口）。避免「Agent 通过、流水线挂」或反向漂移。
- **LLM 路径**（需求 / 评审）：约定 **超时、重试上限、输出结构校验**（如 JSON schema 或必选 Markdown 小节），并设 **成本与配额上限**（按部署可配置）；避免无界重试与不可解析输出进入下游。
- **评审可复盘**：LLM 或规则评审应能附带 **可引用证据**（规则文件条目、diff 范围摘要等），不仅输出结论短语，便于事后审计与拒绝申诉。

---

## 11. 运维与演化

- **配置 ≠ 已验证**：`backup` / `rollback` / `publish` 仅在 YAML 中存在不等于可恢复；架构上应安排 **周期性演练**（备份成功、回滚到上一版本在目标环境可执行）。
- **文档与代码**：规则与架构说明会慢于代码；用 **关键路径自动化**（健康检查、模拟飞书到单 Agent、契约单测）比单靠人工同步文档更能防止漂移。

---

## 12. ops-agent：职责边界与可选拆分

当前设计把 **与工作区构建、产物校验、远端发放（rsync 等）、备份/回滚、只读巡检** 放在同一 **`ops-agent`**，由 orchestrator 按步骤触发（参见 `.cursor/rules/ops-agent-app.mdc`）。

**默认建议：不拆成多个独立 Agent 进程**，在同一应用内用 **子模块** 区分即可（例如 `packaging/`、`deploy/`、`probe/`、`backup/`），共享配置加载与日志，降低编排面复杂度。

**可考虑拆进程（或拆部署单元）的典型条件**：

| 条件 | 说明 |
|------|------|
| **权限与网络域不同** | 巡检仅需 **只读** SSH，发布需要写目录与重启；若安全策略要求 **不同密钥、不同跳板或不同 VPC**，可拆 **probe** 为独立服务或使用单独只读账号（仍可在同一 repo 两个 app，或同进程两套 client）。 |
| **构建与发放分离** | 产物在 **CI 构建** 后只下发 artifact；运行侧 **不再在目标机执行 build**。此时「本地打包」可由 orchestrator 调 shell/CI 产物，`ops-agent` 收窄为 **发放 + 健康检查 + 回滚**。这是 **职责收窄**，未必新增第二个 Agent。 |
| **扩缩与隔离** | 巡检高频、发布低频且资源争抢；或希望发布服务挂掉时 **巡检/只读健康检查仍可用**（较少见，可用队列与超时区分优先）。 |

**与 `full_release` 的关系**：一键流水线中的 **测试** 偏 `test-agent`，**打包** 常与 `pipeline.publishCommand` 在 **目标工作区** 执行，**上传与重启** 偏 `ops-agent`；若你希望「打包」永远在 CI，只需在契约里写明由谁执行，**不必**为 nomenclature 再拆第三个 Agent。

---

## 13. HTTP 服务技术栈（Node + Express）

各 **`apps/*`** 中对外提供 HTTP 的服务（**`orchestrator`** 与各 **Agent**）**默认采用 Node.js + Express** 实现路由、中间件与错误处理；与现有 **ESM（`"type": "module"`）**、**TypeScript** 一致。

**建议一致性**：

| 项 | 说明 |
|------|------|
| **入口** | `src/index.ts` 创建 Express `app`，监听端口仍由 env / `agents.config.yaml` 决定。 |
| **分层** | 与 [orchestrator-app.mdc](../.cursor/rules/orchestrator-app.mdc) 一致：`routes` → handlers/controllers → `services` → `clients`；长任务不接在同步请求里完结。 |
| **安全头** | 在 **统一入口** 挂载安全相关中间件（如 **`helmet`** 或等价响应头），与 `.cursor/rules/security-coding.mdc` 对齐；对外路由限流、体大小上限按需加。 |
| **解析与校验** | JSON body 解析 + **Zod**（或同类）在 **handler 边界**校验；错误映射为稳定 JSON，**不**回堆栈给客户端。 |
| **下游调用** | 对其它 Agent 使用 **带超时的 HTTP 客户端**（如 `fetch` + `AbortController`），`taskId` 经 header 或 body 贯穿。 |

### 13.1 `agent-console`（可选 · 本地控制台）

#### 定位与非目标

| 项 | 说明 |
|------|------|
| **定位** | **非**飞书第二入口；**不写任务真相**（任务仍以 orchestrator + `ITaskStore` 为准）。供本机/受信网络内编辑 `agents.config.yaml`、校验 Zod、试用流式 LLM、按与飞书同构的 body **联调编排器**。 |
| **形态** | **Vite** 前端（默认 `127.0.0.1:5275`）+ **Express** API（默认 `127.0.0.1:5280`）。开发时前端将 **`/api/*`** 代理到 API 端口；**生产构建** 由服务端 `express.static` 托管 `dist/client`。 |
| **共享逻辑** | **`@agents/agents-config`**：`agentsConfigSchema`、`loadAgentsConfig` / **`hydrateAgentsConfigTargetProjects`**、`customer-targets` 布局与 **`TARGET_PROJECT_ID_RE`** 等 **与 orchestrator / 各 Agent / 控制台同源**；下游 Agent HTTP 基址拼接见 orchestrator `resolveAgentHttpBaseUrlFromEnv`。 |
| **安全** | 写 `agents.config.yaml` / `.env` / `target.yaml` 前 **自动备份**（时间戳 `.bak.*`）；可选 **`AGENT_CONSOLE_API_TOKEN`**：`/api/*`（健康检查与 SSE 代理等豁免策略以实现为准）要求 **`Authorization: Bearer <同值>`**；**禁止**将 API 端口无防护暴露公网。Bearer 可存浏览器 **`localStorage`**（仅本机，与飞书/编排密钥无关）。 |

#### 服务端 HTTP 面（摘要）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health`、`/api/health` | 存活探测（是否需鉴权以实现为准）。 |
| `GET` | `/api/config` | 配置路径、`yamlRaw`、`parsedUnknown`（原始 YAML 解析）及 **`parsedHydrated`**（合并 **`hydrateAgentsConfigTargetProjects`** 后的 `target.projects`，供控制台展示）。 |
| `POST` | `/api/config/validate` | 仅校验请求体中的 YAML 文本，**不写盘**。 |
| `PUT` | `/api/config` | 校验通过后整文件写回 `agents.config.yaml`（先备份）。 |
| `PUT` | `/api/config/target-projects` | 校验 **`targetProjectEntrySchema`** 列表；为每个 `id` 写 **`customer-targets/<id>/target.yaml`**，并把根 YAML 的 **`target.projects`** 收敛为 **`{ id, definitionPath }`** 桩（`definitionPath` 相对编排根）。 |
| `GET` | `/api/console-env` | 读取 monorepo 根 **`.env`**（解析为键值；不存在则空）。 |
| `PUT` | `/api/console-env` | **合并写回** `.env`（保留原有 `#` 注释行与其它非赋值行；写前可选时间戳备份）。 |
| `GET` | `/api/target-projects/:projectId/ai-rules` | 列出该目标 **`customer-targets/<id>/ai-rules/`** 下规则文件名与大小。 |
| `POST` | `/api/target-projects/:projectId/ai-rules` | **`multipart/form-data`** 字段 **`files`**，写入同上目录（文件名消毒、单文件 ≤ 2MiB）。 |
| `DELETE` | `/api/target-projects/:projectId/ai-rules/:fileName` | 删除该目录下单个 `.md` / `.mdc`。 |
| `POST` | `/api/chat/stream` | **OpenAI 兼容**对话流式转发（体为 `messages[]`，边界校验以服务端 Zod 为准）。 |
| `POST` | `/api/pipeline/invoke` | 将 **`text`**（及可选 **`channelId`**、引用消息 id、**`metadata`**）转发至 **`AGENTS_ORCHESTRATOR_URL`**（默认同机 orchestrator），供 UI **流水线指令**与飞书语义对齐；编排器须已可达。 |

JSON body 体积上限、字段长度等由 **`express.json`** 与 **Zod** 在 handler 边界约束；错误返回稳定 JSON，**不回栈**给客户端（与 §13 其它服务一致）。

#### 前端结构（实现约定）

| 主题 | 说明 |
|------|------|
| **数据获取** | **`@tanstack/react-query`**：编排配置走 **`/api/config`**，变更后 **`invalidateQueries`** 再拉取；**不**把 YAML 真源只放在浏览器内存而不经 API。 |
| **本地 UI 状态** | **`zustand`** + **`persist`（`localStorage`）**：仅 **页面偏好**（例如日志区逐字显示间隔、可覆盖的 **文案 key→展示串**）；**不**持久化任务列表或编排状态，避免与 orchestrator 真相分叉。 |
| **组件** | **React 19**、**Tailwind CSS v4**；**Radix UI**（Tabs、Label、Select）与自建 **`Console*`** 控件（`ConsoleSelect`、`ConsoleLabel`、`ConsoleTextInput` / `ConsoleNumberInput` / `ConsoleTextarea`）统一 **暗色控制台** 视觉。 |
| **反馈** | **`sonner`** Toast；**运行日志**面板仅前端聚合展示（非集中式日志真源）。 |
| **可选背景** | **`@react-three/fiber`** / **`three`**；WebGL 不可用时降级。**Three 的 JSX 类型**随模块 import 加载，避免在全局 `vite-env` 中强引 Fiber 以免拖垮普通页面的 JSX 推断。 |

#### TypeScript 与工程配置

- **`apps/agent-console/tsconfig.json`**：**`extends` `./tsconfig.app.json`** 且 **`include`: `src/**`**，使 IDE 与 **`jsx: react-jsx`**、`paths`（`~/*`）一致。
- **`check-types`**：`tsc -p tsconfig.json`（前端）+ **`tsc -p tsconfig.server.json`**（`server/`）；**`vite.config.ts`** 由 **`tsconfig.node.json`** 覆盖。
- **Radix + React 19**：必要时用 **`ComponentType<ComponentProps<typeof …>>`** 或 **`r19Radix()`** 收窄，避免 `ForwardRefExoticComponent` 与 JSX 工厂误推断。

**说明**：若个别 Agent 长期仅为极简 health，可暂缓引入 Express；**编排与飞书入口**应优先 Express，便于中间件与路由表演进。替换为 Fastify 等属同级别方案，需同步更新本文与规则。

---

## 14. 相关文档

| 文档 | 内容 |
|------|------|
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | 由里到外的 **实现顺序** 与首个 Agent 验收 Checklist |
| [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) | 飞书指令格式与验证码（含 **§0 帮助 / `help`**） |
| [CUSTOMER_GUIDE.md](./CUSTOMER_GUIDE.md) | 客户侧 **首次接触导引**（与群内「帮助」文案互补） |
| `README.md` | **快速入口**：命令、apps 表、摘要拓扑图；细节以本文 **「附图」** 与后续章节为准 |
| `.cursor/rules/orchestrator-app.mdc` 等 | 各 app 分层与目录习惯 |
| `.cursor/rules/ops-agent-app.mdc` | ops-agent 职责与安全 |

---

## 15. 运行时 Skill 划分（v1）

本节是 **脱离 Cursor、由编排调度** 的一版完整约定：**六段流水线各自对应一个 Skill 域**（仍为同一批 Agent 进程）；差异体现在 **任务载荷**（建议收敛进 `pipeline-core` DTO），而非首日拆更多 HTTP 服务。

### 15.1 六段 Skill 域与 v1 载荷

| Skill 域（阶段） | 主要进程 | v1 载荷要点 |
|------------------|----------|-------------|
| **需求分析** | `requirements-agent` | 可选 **`targetStackTargets`**：`{ implementationRole, stackProfile }[]`，用于 PRD/验收对齐多面前端或前后端 |
| **编码** | `coding-agent` | **必选**（当进入实现类 action）：`implementationRole` + `stackProfile`（枚举见 15.4） |
| **审核** | `review-agent` | 与 **编码** **同链路同源**：同一组 `implementationRole` + `stackProfile` |
| **测试** | `test-agent` | v1 **携带与实现一致**的 `implementationRole` + `stackProfile`，用于报告维度、可选的按面用例说明；**执行命令**仍以 `agents.config.yaml` 的 `pipeline.fullTestCommand` 等为真源，由客户仓吸收栈差异 |
| **发布** | `ops-agent` | **`opsMode: publish`**（或等价枚举）；具体 build/发放脚本仍由配置驱动 |
| **巡检** | `ops-agent` | **`opsMode: patrol`**；与发布 **权限与频率** 隔离（参见 §12） |

### 15.2 通用字段

| 字段 | 说明 |
|------|------|
| **`implementationRole`** | `frontend` · `backend` · `fullstack`。**`fullstack`** 时编排器可对同一需求 **顺序或并行** 下发多条实现子链（各带子 `stackProfile`），或在契约中约定「主链 + 附链」；v1 文档以 **每条载荷单一 role** 为准。 |
| **`stackProfile`** | 与 `implementationRole` 组合的 **封闭枚举**（15.4）；未在表内的取值应 **拒绝** 或 **显式降级策略**（人工/默认 profile），并记录审计。 |
| **`opsMode`** | `publish` · `patrol` ·（可选）`backup` · `rollback`；与飞书 `action` / `PipelineStepKind` 的映射须单一事实来源，避免文案与内部枚举分叉（对齐 §8）。 |

**一致性**：`coding-agent` → `review-agent` → `test-agent` 在 **同一实现任务** 上应传递 **相同的 `implementationRole` + `stackProfile`**（`fullstack` 多子链时各自一条）。

### 15.3 `targetStackTargets`（需求侧，可选）

用于需求产物中声明「本需求涉及的面与栈」，供编排与下游选人/选提示词模板；**不改变**「一个需求 Agent」的进程边界。

示例形状（概念）：`[{ "implementationRole": "frontend", "stackProfile": "nuxt-3" }, { "implementationRole": "backend", "stackProfile": "node-nest" }]`。

### 15.4 `stackProfile` 枚举（v1）

扩展时 **追加行** 并 **升契约/配置版本**。

| `implementationRole` | `stackProfile` | 说明 |
|----------------------|----------------|------|
| `frontend` | `next-app-router` | Next.js App Router |
| `frontend` | `next-pages` | Next.js Pages Router |
| `frontend` | `react-spa` | React + Vite/类 SPA |
| `frontend` | `vue-spa-vite` | Vue 3 + Vite SPA |
| `frontend` | `nuxt-3` | Nuxt 3（SSR/SSG/约定式目录） |
| `backend` | `node-nest` | Node.js + Nest |
| `backend` | `node-express-fastify` | Express / Fastify 等轻量 API |
| `backend` | `go-gin` | Go + Gin（或同类路由栈） |

### 15.5 架构图（v1 逻辑视图）

```mermaid
flowchart LR
  subgraph phase [端到端·六段 Skill]
    S1[需求\ntargetStackTargets?]
    S2[编码\nrole+stack]
    S3[审核\nrole+stack]
    S4[测试\nrole+stack]
    S5[发布\nopsMode publish]
    S6[巡检\nopsMode patrol]
  end
  subgraph ctx [v1 载荷]
    R[implementationRole]
    P[stackProfile]
    O[opsMode]
  end
  S1 --> S2
  S2 --> S3
  S3 --> S4
  S4 --> S5
  S5 --> S6
  R -.-> S2
  P -.-> S2
  R -.-> S3
  P -.-> S3
  R -.-> S4
  P -.-> S4
  O -.-> S5
  O -.-> S6
```

---

*架构随实现迭代可修订本文；重大边界变更建议同步契约版本与 Release Note。文首 **「附图」** 含部署上下文、Monorepo 依赖、`customer-targets` 合并视图（附图-5）、飞书主路径与 §15 Skill 逻辑视图；§8–§11 对应前述风险域；§12 为 ops-agent 拆分策略；§13 为 HTTP 技术栈与 **agent-console** API；**§15** 为运行时 Skill v1。*
