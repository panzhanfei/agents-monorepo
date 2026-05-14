# agents-monorepo（软件研发智能群体）

**云端控制面（Node / Express）+ 本机 Electrobun + React + Runner（Python / uv）**：客户工程 **仅在用户侧 Runner 落盘**，服务器不直接读写客户仓库。

---

## 一眼导航：完整文档地图

**以下链接覆盖原「单巨型 README」的全部内容**；进入仓库后 **先看本表** 即可跳转到对应主题。正文已全部拆到 [`docs/`](./docs/README.md)。

| 文档 | 内容提要 |
|------|----------|
| [README · Agent 细分 / 少进程 / 解耦](#agent-subroles-runner-decouple) | **逻辑角色（①～⑫）**、Runner 四进程映射、解耦边界表 |
| [总览与版本节奏](./docs/overview.md) | 三层架构表、阶段一/二/三、pnpm+uv、**消息队列与 Runner 心跳**（必选） |
| [实施分段（已定稿）](./docs/phased-delivery.md) | **一期 Node+前端（Agent 路由占位固定返回）**；二期 Agents + 联调前 **半天～一天对齐**；本地→打包/H5→上云 |
| [v1 设计清单与实施进度](./docs/v1-design-and-progress.md) | 库表 / Redis / 队列 / JWT；[**第一期 backlog 1～22**](./docs/v1-design-and-progress.md#phase1-backlog)；[**实施进度表**](./docs/v1-design-and-progress.md#implementation-progress) |
| [业务域：用户与多项目](./docs/business-domain.md) | `workspaceRoot`、多项目隔离、Runner 安全与并发 |
| [远程部署与 Electrobun 桌面](./docs/remote-desktop-electrobun.md) | 云 + 本机职责边界、桌面选型 |
| [架构图与端到端流程](./docs/architecture-diagrams.md) | Mermaid 逻辑图、时序图、步骤流水线 |
| [运行时 Skill 分层](./docs/runtime-skills.md) | 契约 / 编排 / Python 执行 |
| [模块说明：桌面 · API · Agents](./docs/module-topology.md) | `apps/desktop`、`apps/api`、`agents/*`、共享契约 |
| [Python Runner 技术选型（定稿）](./docs/agents-runner-tech-stack.md) | FastAPI、httpx、LangGraph+LangChain、LlamaIndex（检索）、SSE、uv |
| [Agent 学习模块](./docs/agents-learning.md) | 三栈练习边界与阅读顺序 |
| [Agent / Python 一日学习计划](./docs/agents-learning-day-plan.md) | 整日/半天排期、走读顺序、自测与勾选清单 |
| [Agent 难点与坑点](./docs/agents-challenges.md) | Runner/Python 专项坑点 |
| [坑点与对策](./docs/pitfalls.md) | CI、流式、Agent 拓扑、产品与编排 |
| [高并发](./docs/high-concurrency.md) | 队列分区、无状态 API、背压与幂等 |
| [清晰日志](./docs/logging.md) | `traceId`、字段表、脱敏；[**第一期 API 底线**](./docs/logging.md#phase1-logging-baseline) |
| [数据概念图](./docs/data-model-concept.md) | User / Project / Task / Thread |
| [本地开发与自测](./docs/local-development.md) | 桌面 / API / Runner 联调要点 |
| [后续渠道：小程序与飞书](./docs/future-channels.md) | 阶段三；飞书 H5、机器人可选 |
| [ARCHITECTURE（控制面定稿）](./docs/ARCHITECTURE.md) | Runner **HTTP API**（生产 TLS）；Redis **不暴露**给 Runner；JWT；心跳门禁；BullMQ 与 Worker **占位说明**；[**§10 优雅退出**](./docs/ARCHITECTURE.md#graceful-shutdown) |

**索引入口**：[docs/README.md](./docs/README.md)（与上表同步维护即可）

---

## 子项目

| 路径 | 说明 |
|------|------|
| [apps/api](./apps/api/README.md) | 云端 Express：迁移、Redis、BullMQ、本地运行命令 |
| apps/desktop | （待建）Electrobun + React；设计见 [module-topology](./docs/module-topology.md) |
| [agents/runner](./agents/runner/) | Python Runner（**已初始化**：`pyproject` + `src/runner`）；说明见 [agents/runner README](./agents/runner/README.md) |

---

<span id="agent-subroles-runner-decouple"></span>

## Agent：细分角色、少进程映射与解耦

**原则**：对外心智按 **细分角色**（流水线职责）说清楚；落地采用 **少进程、多角色**——同一 Runner 进程内用 **步骤（step）+ 载荷字段（lane/profile/phase）** 切换提示词与工具，避免「一职一进程」爆炸。

### 细分角色清单（运行时职责）

以下均为 **逻辑角色**（可映射到编排步骤 / task payload），序号与桌面脑图 `软件研发智能群体.xmind` 主线一致（可用仓库脚本 [`scripts/update-xmind-software-research-agents.py`](./scripts/update-xmind-software-research-agents.py) 重新生成该脑图）。

| 序号 | 角色 | 职责边界 |
|------|------|----------|
| ① | **入口 Router** | 意图分类、会话路由；可落在控制面首跳或 Runner 第一步；**不写客户仓库业务代码**。 |
| ② | **需求 Analyst** | 自然语言 → 结构化需求；支持多轮；**持久状态以 DB 会话/任务为准**，模型仅带摘要。 |
| ③ | **PM Spec** | 将需求拆为可执行 issue、优先级与依赖。 |
| ④ | **架构 Architect** | 输出系统/模块级架构方案（交付物可版本化进任务 Artifact）。 |
| ⑤ | **契约与拆分** | 划定前端/后端/全栈/BFF 边界，产出 **接口契约**，并 **下发** 后续 coding 任务（含并行批次约束）。 |
| ⑥～⑨ | **Coding（后端 / 前端 / 全栈 / BFF）** | 在各 lane 内按白名单路径与分支策略改代码；四者可 **并行**，受编排门禁约束（见下）。 |
| ⑩ | **Verify·单元测试** | 按模块跑单测；命令与客户仓约定一致（见 [`docs/pitfalls.md`](./docs/pitfalls.md) 中与 CI 对齐）。 |
| — | **门禁·分批联调（编排策略）** | **控制面职责**：按依赖分批调度 coding/verify；**每批最多两条 coding lane 并行**（与脑图「最多两个模块」一致）。 |
| ⑪ | **Verify·联调 / E2E** | 整体联调、端到端与全量用例覆盖。 |
| ⑫ | **Ops·打包运维** | 构建、发布、巡检、回滚；**仅在前面门禁通过后**允许执行；与写代码进程 **隔离**（见下表）。 |

### Runner 少进程映射（多角色如何落在进程里）

v1 推荐 **4 个 Runner 侧 worker（进程）**；逻辑角色通过 **队列任务类型 + 载荷字段** 区分，而非「每个细分角色常驻一个进程」。

| Runner 进程（示例名） | 承载的逻辑角色 | 载荷上常用区分字段（示意） |
|----------------------|----------------|----------------------------|
| **runner-planning** | ② 需求 Analyst → ③ PM Spec → ④ Architect → ⑤ 契约与拆分 | `planningStep` / `implementationPhase` 等（实现期写入契约即可） |
| **runner-coding** | ⑥⑦⑧⑨ 四类 Coding | `codingLane`：`backend` \| `frontend` \| `fullstack` \| `bff`；叠加 **`stackProfile`**（与客户栈画像对齐，见 [`docs/runtime-skills.md`](./docs/runtime-skills.md)） |
| **runner-verify** | ⑩ 单测；⑪ 联调/E2E | `verifyPhase`：`unit` \| `integration_e2e` |
| **runner-ops** | ⑫ Ops | `opsMode` / 发布清单；与 coding **进程隔离** 以降低误操作面 |

**入口 Router ①**：优先落在 **控制面（`apps/api`）** 做薄路由（规则或小模型），只负责 **分类与入队**；重推理仍可委派 `runner-planning` 的第一步，避免双轨逻辑分叉。**门禁·分批联调**：只在 **控制面编排** 实现（状态机 + 队列分区），不单独占 Runner 进程。

### 解耦边界（详细）

| 层级 | 解耦什么 | 怎么做（约定） |
|------|----------|----------------|
| **契约** | 控制面与 Runner、与未来多端 **字段与枚举一致** | 任务 DTO、步骤类型、`skillSchemaVersion` / `apiVersion` **单一事实来源**（OpenAPI 或 JSON Schema）； breaking change 升版本。 |
| **编排** | 「谁能下一步」与 Runner **执行** 分离 | **只允许**：API 校验 → 入队 → Runner 消费 → 结果回写；Runner **不**互相 RPC 调业务链；**会话与任务状态以 DB 为真源**。 |
| **数据与上下文** | 避免「只靠模型记会话」 | 任务/会话 ID、摘要注入载荷；详见 [`docs/data-model-concept.md`](./docs/data-model-concept.md)。 |
| **观测** | 跨进程可追溯 | **`traceId`** 贯通 API / Worker / Runner；结构化日志字段见 [`docs/logging.md`](./docs/logging.md)。 |
| **安全与 IO** | 客户仓 **仅 Runner 可写** | `workspaceRoot` **登记 + 路径规范化防逃逸**；危险 Ops **二次确认令牌**（控制面签发）；参见 [`docs/business-domain.md`](./docs/business-domain.md)。 |
| **演进** | 进程可合可拆 | **升级 Runner 进程数不改变契约语义**；细分角色增减优先体现在 **步骤枚举与载荷**，而非强行增减进程。 |

更细的模块分层仍见 [`docs/module-topology.md`](./docs/module-topology.md)；运行时 Skill 与契约分层另见 [`docs/runtime-skills.md`](./docs/runtime-skills.md) 与 [`.cursor/rules/runtime-skills-layering.mdc`](./.cursor/rules/runtime-skills-layering.mdc)。

---

## 约定与其它资源

| 资源 | 说明 |
|------|------|
| `docs/FEISHU_COMMANDS.md` / `docs/WECHAT_MINIPROGRAM.md` | 阶段三再建即可 |
| [.cursor/rules/](./.cursor/rules/) | 密钥、Monorepo 约定等 |

控制面技术定稿集中维护在 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)（上表「文档地图」中已链出）。

---

## 许可证

以仓库根目录 `LICENSE` 为准（若尚未添加，由项目维护者补充）。
