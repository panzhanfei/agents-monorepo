# 实践路线与工程建议（架子搭好后）

本文汇总「骨架已完成 → 逐个实践」时的 **推荐顺序**、**每阶段验收点**、**横切关注点** 与 **刻意延后的项**，与 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) 配合使用。**架构边界（信任域、契约、状态机归属、风险与非功能约束等）**见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 推荐实践顺序（由里到外）

### 1. 配置加载与校验

- 启动时合并 **`agents.config.yaml`** 与 **`.env`**，用 schema（推荐 **Zod**）校验。
- **多目标**：根 YAML 中 **`target.projects`** 常见为 **`{ id, definitionPath }`** 指向 **`customer-targets/<id>/target.yaml`**；加载路径经由 **`hydrateAgentsConfigTargetProjects`** 合并磁盘定义与内联字段（见 [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-配置架构yaml--env)）。控制台可维护 **`ai-rules/`** 规则文件。
- 尽早发现：缺字段、端口语义冲突、`TARGET_PROJECT_SOURCE=local` 却仍强依赖远端 URL、`security.requiredForActions` 与路由表不一致等。
- **验收**：故意填错配置时进程启动失败且错误信息可读。

### 2. orchestrator：最小闭环（可先不接真飞书）

编排层早期 **只做两件事** 即可：健康检查 + 一条可从本地回归的「假飞书」入口。

- 保留 `/health`，增加 **「模拟飞书」** 入口：例如 `POST` JSON 假装飞书 payload（或与 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) 对齐的简化 body）。
- 实现 **意图路由**：文本 → **与 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) 一致的内部动作名**（如 `requirements_analysis`、`code`）+ 参数抽取（可先关键词 + 轻量正则，不接真飞书也能钉死链路）。
- 统一 **超时、错误体、`taskId` 日志**。
- 产品侧若需 **每步群内汇报并人工点「继续」**：实现 `feishu.confirmBetweenPipelineSteps` 与 **`workflow_*`** 回复路由（见 [FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md) §14、[ARCHITECTURE.md](./ARCHITECTURE.md) §4）；**一键发布**动作为 **`full_release`**（§15），须异步编排且走验证码。
- **任务状态**：编排侧使用 **`ITaskStore`**（`@agents/pipeline-core`）；MVP 为 **`MemoryTaskStore`**，`TASK_STORE_DRIVER=memory`。接 PostgreSQL 时实现同级 **Postgres 适配器** 并替换工厂即可（见 `docs/ARCHITECTURE.md` §4）。
- **验收**：一条请求进、一条结构化响应出（哪怕下游还是 mock）。

### 3. 单 Agent 端到端穿透

- 任选 **`requirements-agent`** 或 **`coding-agent`**：`orchestrator` → HTTP 调用 → 返回固定 JSON / Markdown。
- **验收**：超时与失败路径可测；日志带 `taskId`、动作名、目标 workspace（路径可截断）。

#### 第 3 步：本周验收 Checklist（二选一）

先选定 **「第一个打通的是需求分析还是编码」**，按下面任一套打勾即可单独结项；另一路下一步复制模式。

**A. 优先打通 `requirements-agent`（需求分析）**

1. [ ] 模拟飞书请求能稳定路由到内部动作 `requirements_analysis`（或你在 `pipeline-core` 中与此等价的枚举），且缺参时返回 **4xx + 可读 body**（不崩）。
2. [ ] `orchestrator` → `requirements-agent` 的 HTTP 调用使用 **共享契约类型**（或 JSON Schema），请求里带 `taskId`（或由编排生成并贯穿）。
3. [ ] 成功路径：下游返回 **固定结构**（可先静态 Markdown/JSON），编排原样或包装写回响应。
4. [ ] 失败路径：下游不可达 / 非 2xx 时，编排返回 **统一错误体**，且日志中有 `taskId`、`action`、`workspacePath`（可截断）。
5. [ ] 超时：对 `requirements-agent` 配置合理超时，超时后客户端拿到明确错误（非挂死）。
6. [ ] 本地用一条 curl/脚本可 **重复执行** 做回归（无需真飞书）。

**B. 优先打通 `coding-agent`（编码）**

1. [ ] 模拟飞书请求能稳定路由到内部动作 `code`（或与 FEISHU 文档一致的编码动作名），缺参时 **4xx + 可读 body**。
2. [ ] `orchestrator` → `coding-agent` 使用 **共享契约类型**（或 JSON Schema），`taskId` 贯穿。
3. [ ] 成功路径：下游可先返回 **占位结果**（例如「本会话将修改的文件列表」固定 JSON），不实改仓库也允许，先把链路拉通。
4. [ ] 失败路径与超时：同 A 第 4、5 条。
5. [ ] **说明本阶段是否验收「需求已完成」门禁**：若尚未做第 4 步状态机，应在编排或文档中注明「先放行 / 临时跳过」，避免与最终产品规则混淆。
6. [ ] 本地 curl/脚本可回归。

（第 4 步再接「编码前必须需求分析完成」等状态机时，将 B.5 从临时跳过改为硬门禁即可。）

### 4. 第二条 Agent + 状态机

- 例如：编码前要求 **「需求分析已完成」** 的状态位。
- 状态可先在 **内存** 实现，再迭代为 Redis/DB。
- **验收**：非法顺序（未分析直接编码）被拒绝并提示清晰。

### 5. review / test / ops（按依赖展开）

- **review-agent**：先 **子进程** 跑 blocking 命令（如 `.env` 中 **`REVIEW_BLOCKING_COMMAND`**，默认 `pnpm run lint && pnpm run check-types`），再接 LLM + 规则文件。
- **test-agent**：在文档中 **写死**「全量测试 = 根目录哪几条脚本」，与 Turbo `pnpm run test` 是否内含 e2e 要 **明确策略**（避免本地与 CI 行为 silently 不一致）。
- **ops-agent**：先 **dry-run**、备份开关与回滚脚本路径；再上真实 SSH/rsync。

### 6. 真飞书接入（最后）

- 验签、解密、事件类型与官方文档对齐。
- **保留**本地「假飞书 POST」用于回归，避免每次联调都依赖外网。

---

## 最小可演示闭环（MVP 建议）

优先打通：

**校验过的配置 → orchestrator 假飞书 → 单一 Agent 端到端 → 响应里结构化结果**

等价表述：**飞书（或模拟）→ orchestrator → 单一 Agent → 群内/响应里结构化结果**。

再横向加审核、全测、运维。六路 Agent 并行集成容易全部「半截」；单路跑通后再复制模式。这样骨架会 **持续可用**，而不是堆一堆半截集成。

---

## 横切关注点（每阶段顺带做）

| 主题 | 建议 |
|------|------|
| **契约** | orchestrator ↔ 各 Agent 的请求/响应用 **TypeScript 类型** 或 **JSON Schema** 固化，可放在 `packages/pipeline-core` 或独立小 package，避免口头约定漂移。 |
| **幂等** | 飞书/Webhook **易重复投递**；`publish`、`rollback`、改配置等需 **task 级幂等** 或「同一 task 关键步骤只执行一次」。 |
| **机密** | 静态验证码适合内测；**SSH 私钥、Token** 仅 `.env`/密钥管理，**禁止**写入 YAML 与日志。**静态口令**若群规模大，后续可评估私聊校验或轮换（非必须首日做）。 |
| **可观测** | 尽早统一结构化日志字段：`taskId`、`action`、`workspacePath`（脱敏/截断）、下游 Agent 名称与耗时。 |

---

## 需求 → 编码契约（建议在实现 requirements / coding 时约定）

- **requirements-agent** 输出建议固定结构：用户故事、**验收标准（AC）**、非功能约束、边界、开放问题。
- **coding-agent** 只消费 **带版本号或哈希的 PRD 引用**（便于回溯「按哪版需求实现」）。
- 见 `.cursor/rules/requirements-agent-app.mdc` / `coding-agent-app.mdc` 与后续 DTO。

---

## 刻意延后的项（避免早期拖慢）

- **过度完美的 NLU**：先用 **关键词 + 轻量解析 + `docs/FEISHU_COMMANDS.md` 约定格式**，再考虑大模型做意图分类。
- **全自动「扫描服务器生成运维脚本」**：先有 **手写一版 publish + manifest 指纹**（`generatedOps`），再渐进做生成器。

---

## 客户/首次接入 Checklist（可选打印给使用方）

1. 复制 **`.env.example`** → `.env`，填写飞书（若已接）、`VERIFY_CODE`（若用 env 覆盖）、`TARGET_*` 等。
2. 按需编辑 **`agents.config.yaml`**（端口、`pipeline`、`security`、`server` 等）。
3. `pnpm install`
4. `pnpm run dev` 或单独起 `orchestrator` + 目标 Agent。
5. 用 **模拟飞书请求** 或真群，按 **`docs/FEISHU_COMMANDS.md`** 发一条 **需求分析** 或 **绑定工作区** 做联调。

### agent-console（可选 · 本地配置与联调 UI）

- **与第 1 步配合**：浏览器编辑 **`target.projects`** 与单目标字段、YAML 全文校验/写回（服务端 Zod 与 **`@agents/agents-config`** 同源），减少手改 YAML 的低级错误。
- **与第 2 步配合**：**`/api/pipeline/invoke`** 将控制台指令转发到 **orchestrator**（配置 **`AGENTS_ORCHESTRATOR_URL`** 或默认同机端口），可与 **[FEISHU_COMMANDS.md](./FEISHU_COMMANDS.md)** 及 curl 对照调试。
- **验收**：仅 **`127.0.0.1`/内网**；若设 **`AGENT_CONSOLE_API_TOKEN`**，请求需带 **Bearer**；写盘与备份见 **[ARCHITECTURE.md](./ARCHITECTURE.md) §13.1**。
- **非目标**：**不**替代任务存储真相、**不**承担飞书验签；**`localStorage`** 仅存放 UI 偏好（Zustand `persist`），与编排任务状态无关。

---

## 静态验证码边界（心里有数）

- 适合 **PoC / 小范围内网群**。
- 若群可见性高：关注 **转发泄露**；敏感操作可改为 **私聊校验** 或增强方案（后续迭代）。
- 与 **`security.verificationCode`**、`VERIFY_CODE` 说明一致，实现时务必 **只在 orchestrator 校验**，下游 Agent 相信已签发的内部任务令牌或内网调用。

---

*文档随实现迭代可自行增删阶段；骨架阶段以「可运行、可测试、可回归」为先。*
