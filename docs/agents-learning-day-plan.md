# Agent / Python 一日学习计划（紧扣本仓库）

面向：**对 Python 与 Agent 技术栈不熟**，但需要从 **本 monorepo 的真实边界**出发建立整体认知的同事。  
目标：一天结束后能 **口头讲清架构分工**、**按目录打开 Runner 代码**、**知道三栈（LangGraph / LangChain / LlamaIndex）各管什么**，并具备继续深入官方文档与实践的路线图。

使用前请自定 **学习日期**，把下面「简明时间表」当作该日议程；可按可用时长压缩（见文末「半场压缩版」）。

---

## 简明时间表（约 8 小时，可整块挪到任一工作日）

假设 **10:00 开始**，含午休；仅作参考，按你作息平移时段即可。

| 时段 | 块 | 时长 | 做什么 |
|------|----|------|--------|
| 10:00–10:45 | §0 | 45m | 三层心智地图 + 文档路线（module-topology → tech-stack → ARCHITECTURE 节选 → README 角色表） |
| 11:00–12:30 | §1 | 90m | Python/uv、`pyproject.toml`、Runner README、`agents-python` 分层、`agents-runner` 启动自检 |
| 13:30–15:00 | §2 | 90m | 逻辑角色①～⑫与四进程映射、画控制面↔Runner 箭头、解耦边界 |
| 15:15–17:15 | §3 | 120m | Runner 源码走读（`__main__` → `api` → `settings` → `node_client` → routes → `application`）+ slots 精读 |
| 17:30–18:45 | §4 | 75m | 三栈边界表 + 官方文档「各读一章」不贪多 |
| 19:00–20:30 | （可选） | 90m | 本地 Web/API + Runner 初始化彩排；卡住就对照 `RUNNER_SETUP_*` |
| 任意 | （收尾） | 15–20m | 口试四题 + 勾选清单查漏 |

合计 **精读约 7h** + **选修动手 1～2h**；若只可投入半天，直接用文末「半场压缩版」。

---

## 学习前准备（建议前一天晚上 15 分钟）

| 事项 | 说明 |
|------|------|
| 仓库已 clone | `agents-monorepo` 为当前主线 |
| 可选：装 uv | Runner 文档推荐 [uv](https://github.com/astral-sh/uv)；也可用 venv + pip |
| 可选：读本页 + [Agent 学习模块](./agents-learning.md) 标题与各表 | 明天带着问题读长文 |

可选环境（**非必须同一天完成**：若动手环节时间不够，可先只做「读文档 + 目录走读」）：

- Node / pnpm：用于日后联调 `apps/api`、`apps/web`（详见 [本地开发](./local-development.md)）
- Python 3.11+：`agents/runner/pyproject.toml` 要求 `>=3.11`

---

## 0. 一开场的「一页心智地图」（30～45 分钟）

先建立 **三件东西各干什么**，之后再学 Python Agent 才不飘。

### 0.1 三层对照表（必须能复述）

| 层级 | 在仓库哪里 | 产品职责 |
|------|------------|----------|
| **控制面** | `apps/api`（Express、DB、Redis、BullMQ 等） | **权限、任务状态、编排** 的持久化与权威来源；定义「谁在什么条件下能进入下一步」 |
| **人机界面** | `apps/web` | 控制台、会话、槽位配置的 UI；敏感执行参数 **不指望长期停留在浏览器一侧** |
| **本机执行** | `agents/runner`（Python：FastAPI、httpx …） | **客户工程落盘与用户机执行**；模型调用与工具执行主要在这里生长 |

**死记一句**：云上 **Orchestration（编排）+ 真理在 DB**，本机 **Execution（执行）+ 读写 workspace**。

### 0.2 推荐阅读顺序（与新人路径一致）

1. [模块说明：桌面 · API · Agents](./module-topology.md) — 谁先谁后、边界在哪。  
2. [Python Runner 技术选型（定稿）](./agents-runner-tech-stack.md) — 为何 FastAPI / httpx / LangGraph / LangChain / LlamaIndex / SSE / uv。  
3. [ARCHITECTURE](./ARCHITECTURE.md) — 重点：**Runner 只走 HTTP(S) API**、**不直连 Redis**、认领（claim）、回写结果、心跳。  
4. 根目录 [README Agent 分段角色与四进程映射](../README.md#agent-subroles-runner-decouple) — **逻辑角色多、进程少**，靠任务载荷字段切换。

读完以上，用 5 分钟在笔记里用自己的话写：**「如果一个 coding 任务要跑起来，数据从浏览器出发经过哪些 hops」**（不要求细节全对）。

### 0.3 ARCHITECTURE 建议跳读（省时间）

打开 [`ARCHITECTURE`](./ARCHITECTURE.md)，**优先只看**与安全边界、Runner 语义强相关的段落（标题以文件内目录为准）：

- **§1**：网络角色表 — 谁在什么网络里；Runner 与控制面的连接方式。  
- **§2**：Runner **认领（claim）**、**执行与回写**、以及与 BullMQ / Node Worker **占位模拟**的差异（避免心理模型混成「Worker 在云上就代表客户侧跑完」）。  
- **§3～§4**：JWT **分用户 / 分 Runner**，以及 **heartbeat** — 为何要在线门禁。

其它章节可 **先收藏**，等开始写具体 API 或部署时再读。

---

## 上午 ①：Python 在本项目中的「最小必会」（约 90 分钟）

### 目标

- 知道 **依赖从哪里来**、`uv`/`pip` 与 **`pyproject.toml`** 的关系。  
- 知道 **`agents/runner` 的包布局**对应哪类代码该放哪里。  
- 理想情况：**本机能把 Runner 进程拉起来**（读通 `agents/runner/README.md` 的 Quick start）。

### 1.1 依赖与运行时（精读 + 操练）

打开并阅读：

- [`agents/runner/README.md`](../agents/runner/README.md) — 环境与命令整节  
- [`agents/runner/pyproject.toml`](../agents/runner/pyproject.toml) — `dependencies`、`optional-dependencies`（`dev`、`vector-qdrant`、`vector-pg`）

操练（二选一即可）：

```bash
cd agents/runner
cp .env.example .env    # 按注释改；首次联调前先读 README 里的 RUNNER_* 说明
uv sync --extra dev
uv run agents-runner --help   # 或按 README 直接启动服务
```

**你要能回答**：`agents-runner` 这个命令在 `pyproject.toml` 里对应哪个 **`[project.scripts]`** 入口？

### 1.2 分层约定（精读）

阅读仓库规则：[agents-python.mdc](../.cursor/rules/agents-python.mdc)（若与 README 不一致，以规则文件为准）。

**默写检查**（可看笔记）：下面四类各举 **一个路径**？

| 层 | 职责（大意） |
|----|----------------|
| `interfaces/` | HTTP 路由、SSE 边界、拼装请求/响应 |
| `application/` | 用例编排（**LangGraph 图适合放这里**） |
| `domain/` | 与框架无关的领域类型与规则 |
| `infrastructure/` | HTTP 客户端、日志、外部 I/O |

### 上午 ① 小节自测

- `RUNNER_SETUP_WEB_ORIGIN` 与 **`RUNNER_SETUP_ALLOW_ORIGINS`** 分别解决什么问题？（详解见 [Agent 学习模块 · 两环境变量](./agents-learning.md)）  
- 日常调 Node API 的设备凭据一般落在哪？（提示：`device.env`、`RUNNER_DEVICE_*`）

---

## 上午 ②：产品里的「Agent」不是单一脚本（约 90 分钟）

### 目标

对齐 **十二个逻辑角色** 与 **四类 Runner Worker 进程** 的映射，避免「学了 LangGraph demo 却对不上我们系统」。

### 2.1 必读：根 README 两张表

在根目录 [`README.md`](../README.md) 中找到 **Agent：细分角色、少进程映射与解耦** 一节：

1. **逻辑角色清单 ①～⑫**：每种角色在产品流水线里干嘛。  
2. **Runner 四进程**：`runner-planning` / `runner-coding` / `runner-verify` / `runner-ops` 各驮哪些逻辑角色。  
3. **解耦边界表**：契约、编排、数据、观测、安全、演进各条一句人话复述。

### 2.2 配图理解（建议在纸上画）

画 **粗箭头**：

- **控制面**：Router ① → 入队 → DB 任务状态演化  
- **Runner**：认领任务 → 读 `workspaceRoot` → 写盘 / 跑命令 → **HTTP 回写**结果

可参考 [架构图](./architecture-diagrams.md)、[Skill 分层](./runtime-skills.md) 中与「编排 vs 执行」相关的图。

### 上午 ② 小节自测

- **门禁·分批并行**是谁的职责：Runner 内部还是 Node？  
- 「Ops 打包」为何强调与 coding **进程隔离**？

---

## 下午 ①：Runner 源码走读（约 120 分钟）

### 目标

把 **文件路径 ↔ 运行时行为**对上号；知道 **下一轮写 LangGraph 时该动哪一层**。

### 3.1 建议打开顺序（带问题读）

| 顺序 | 文件 | 带着什么问题读 |
|------|------|----------------|
| 1 | `agents/runner/src/runner/__main__.py` | CLI 如何启动 uvicorn；子命令入口在哪 |
| 2 | `agents/runner/src/runner/interfaces/api.py` | FastAPI app 在哪创建；lifespan、`NodeApiClient`、CORS 从哪挂载 |
| 3 | `agents/runner/src/runner/config/settings.py` | `RUNNER_*` 如何从 `.env` 与 `device.env` 合并加载 |
| 4 | `agents/runner/src/runner/infrastructure/node_client.py` | **`fetch_agent_slots`**、其它 `GET`/`POST` 与 Node 的路径约定 |
| 5 | `agents/runner/src/runner/interfaces/routes/` 下若干路由 | `/health`、`/v1/stream/example`、`/v1/setup/ingest` 各服务谁 |
| 6 | `agents/runner/src/runner/application/` | **当前占位与未来 LangGraph**：计划把「图构建与 invoke」集中在此 |

可选：顺带扫 `agents/runner/src/runner/infrastructure/logging_config.py`，与 [logging](./logging.md) 里的 `traceId` 语境挂钩。

### 3.2 与「槽位配置」精读联动（必读片段）

返回 [Agent 学习模块](./agents-learning.md) 中 **「控制面槽位配置（Runner 必会）」** 整张表：**任务边界刷新**、`GET /v1/runner/agent-slots`、`If-None-Match` / `304` / `configRevision`。

**手写一句结论**：为什么在用户可能「后补 coder 密钥」的场景下，**启动时拉一次 slots 不够用**？

### 下午 ① 小节自测

指出：**若新增「多轮对话驱动的 planning 步骤」**，你优先改 `interfaces` 还是 `application`，为什么？

---

## 下午 ②：LangChain / LangGraph / LlamaIndex 分工（约 90～120 分钟）

### 目标

不写大作业的前提下，建立一个 **选型理由与边界**的记忆锚点，与本仓库已定稿表述一致。

### 4.1 精读表格（来自本仓库定论）

[`agents-learning.md`](./agents-learning.md) 中 **「学习路径（与定稿选型对齐）」**：

| 技术 | 本仓库要我练的核心 | **不要**干的事 |
|------|---------------------|----------------|
| **LangGraph** | 节点、边、条件分支、checkpoint、interrupt | 不要与 LlamaIndex Agent **再并联一套状态机** |
| **LangChain** | Messages、Tools、`bind_tools`、与 LG 节点对接 | 别把业务门禁规则塞进过长 chain **却不同步 Node** |
| **LlamaIndex** | 载入、切块、向量索引、Retriever | **只做检索**；对上暴露为 LG 可调 **Tool** |

### 4.2 外部文档怎么用（按需查，不贪多）

以对齐 **`pyproject.toml` 版本**为准（LangChain 0.3+、LangGraph 0.2+）：

1. LangGraph：**Graph 定义 / State / 条件边 / interrupt** 官方入门。  
2. LangChain Core：**Messages、Tool/schema、Runnable** 中与模型绑工具一章。  
3. LlamaIndex：**Vector store + Retriever**，与你们选的 `vector-qdrant` 或 `vector-pg` 路径一致即可。

不需要一天内跑通向量库：先搞清 **Retriever 将作为 LangGraph 的一个 tool 节点接入**。

### 4.3 延伸阅读（按需）

- [Agent 难点与坑点](./agents-challenges.md) — 编排双轨、SSE、契约版本等。  
- [坑点与对策](./pitfalls.md) — 编排、流式、CI 对齐等。

---

## 傍晚（可选）：动手联调彩排（约 60～120 分钟）

若要 **真机走一走**（时间与网络允许时）：

1. 按 [agents/runner README](../agents/runner/README.md) 启动 Web + API（若你已能本地起服务）；登录同一账号。  
2. **`uv run agents-runner`**：走浏览器自动初始化流程；卡住时核对 **`RUNNER_SETUP_WEB_ORIGIN` 是否与浏览器地址完全一致**、`RUNNER_SETUP_ALLOW_ORIGINS` 是否包含当前页 Origin（见 [agents-learning.md](./agents-learning.md)）。  
3. 备选无 UI：`agents-runner register --help` + JWT（README 已说明）。

**不要求**同一天实现真正的 claim/task 全流程；本节目标仅是 **环境与凭据链路「见过一次」**。

---

## 一天结束时的总自测（口试四题）

1. Runner **为何不直连 Redis**？认领与结果回写在 **架构上**靠什么完成？  
2. **agent-slots** 为何要 **任务边界刷新**；`configRevision` + `304` 在避免什么问题？  
3. 你们默认把 **LangGraph 编排**挂在 `agents/runner` 哪一层包里？  
4. **「谁能下一步」** 主要在 Node 还是在 Runner？

**答案线索**（不要求背原文，能说清因果关系即可）：[`ARCHITECTURE`](./ARCHITECTURE.md)；[`agents-learning`](./agents-learning.md)（槽位与 Runner 必读段）；[`agents/runner/README`](../agents/runner/README.md)；根目录 [`README`](../README.md) 里 **Agent 分段角色 · 少进程 · 解耦** 小节。

---

## 半场压缩版（约 4 小时）

优先级：**架构边界 > Runner 分层与 `node_client` > 三栈分工**；Python 环境与 LangGraph 官方教程可按当周另排。

| 顺序 | 时长 | 内容 |
|------|------|------|
| 1 | 45m | §0（三层表）+ `module-topology` + `ARCHITECTURE` 中 Runner/API/Redis 关系 |
| 2 | 60m | `agents-runner-tech-stack.md`（速读）+ 根 `README` 角色与四进程两表 |
| 3 | 90m | Runner 源码走读（见上文「下午 ①」；至少 `__main__.py`、`interfaces/api.py`、`node_client.py`）+ [agents-learning](agents-learning.md) 槽位整表 |
| 4 | 45m | 三栈分工（见上文「下午 ②」）+ `agents-challenges.md` 标题扫读 |
| 5 | 20m | 口试四题 |

---

## 学习勾选清单（可复制到笔记）

- [ ] 能不看文档说出：`apps/api`、`apps/web`、`agents/runner` 各管什么  
- [ ] 能解释 Runner **不连 Redis**、结果如何回写到控制面  
- [ ] 读过 `agents/runner/pyproject.toml` 里主依赖与 extras  
- [ ] 成功或尝试过 `uv sync --extra dev` 与 `uv run agents-runner`（或等价启动方式）  
- [ ] 打开过 `NodeApiClient` 并知道 **agent-slots** 从哪拉、为何任务边界要刷新  
- [ ] 能说出 LangGraph / LangChain / LlamaIndex 在本仓库的 **一条**职责与 **一条**禁忌  
- [ ] 完成口试四题（见上）或对每题写有半页笔记  

---

← [返回 Agent 学习模块](./agents-learning.md) · [← 文档索引](./README.md)
