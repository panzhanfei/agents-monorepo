# Agent 学习模块（Runner / Python）

本仓库 **第二期 Agents** 目标之一：在真实产品边界（Node 编排与落库、本机 Runner 写盘）内，**系统练习 LangChain、LangGraph、LlamaIndex** 的组合使用，而非仅用单一「黑盒」封装跑通 demo。

## 学习路径（与定稿选型对齐）

| 技术 | 在仓库里练什么 | 建议边界 |
|------|----------------|----------|
| **LangGraph** | 多步 Agent 流程：**节点、边、条件分支**；**checkpoint**；必要时 **interrupt / 人审** | **唯一主编排**：避免与 LlamaIndex Agent 再套一层平行状态机 |
| **LangChain** | **Messages**、**Tool** 定义、`bind_tools`、与 LangGraph **prebuilt / 自定义节点**对接 | 少写重复胶水；不把业务规则藏在过长 chain 里而不进 Node |
| **LlamaIndex** | **文档载入、切块、向量索引、Retriever**；与向量库（Qdrant 或 pgvector）对接 | **只做检索子系统**；对外的「一步检索」封装成 **LangGraph 可调用的 Tool** |

## 与产品架构的关系（强约束）

- **持久化与权限**：以 **Node + DB** 为准；Runner 经 **httpx** 拉取/回写配置与消息。  
- **本机入口**：**FastAPI** 提供本机 HTTP；**SSE** 承载向桌面的流式输出（见 [技术选型](./agents-runner-tech-stack.md)）。  
- **分层与 Cursor 规则**：实现时遵循 [agents-python.mdc](../.cursor/rules/agents-python.mdc) 中的 `interfaces` / `application` / `domain` / `infrastructure` 划分，便于复盘与减依赖。

## 控制面槽位配置（Runner 必会）

用户在 Web 上按槽位（如 `router`、`coder`）保存的 **模型 / Base URL / API Key** 落在 **`UserAgentSlotConfig`**；浏览器侧只能看到脱敏字段（如是否已配 key），**真实密钥与调用参数必须由 Runner 经 Node 拉取**，与 `requireRunner`（`X-Device-Key` / `X-Device-Secret`）一致。

| 点 | 原因 | 做法 |
|----|------|------|
| **不要只做进程启动时拉一次** | 用户可能先只配一个槽位，后续再补或改；进程内长期持有旧快照会一直用错模型或缺 key | **任务边界刷新**：认领新任务前或任务开始时再拉；同一条任务内可用本次快照，避免执行到一半参数乱跳 |
| **批量 vs 逐槽请求** | 槽位数量少（固定枚举），往返成本远大于 payload | **默认一次 GET 拉齐**（可选 `keys` 只拉子集）；实现见 **`GET /v1/runner/agent-slots`**，`agents/runner` 中 **`NodeApiClient.fetch_agent_slots`** |
| **缓存与带宽** | 每次全量拉 JSON 浪费；无校验又易忘刷新 | 响应带 **`configRevision`**，请求可带 **`If-None-Match`**，未变则 **304**，沿用本地上一份 **`slots`** |
| **修订号范围** | 只关心 `router` 时，不应因别人改了 `coder` 而被强行无效化，也不应出现「只拉 router 却长期 304」 | **`configRevision` 仅由本次请求的 `keys` 集合**对应的落库状态生成；拉全量键时，任一槽位变更都会推进修订号 |

## 推荐阅读顺序（新人）

1. [模块说明：桌面 · API · Agents](./module-topology.md) — 职责边界。  
2. [Python Runner 技术选型](./agents-runner-tech-stack.md) — 依赖与定稿。  
3. [Agent 难点与坑点](./agents-challenges.md) — 实施前扫一遍。  
4. [ARCHITECTURE](./ARCHITECTURE.md) — Runner HTTPS、心跳、队列与契约版本。

← [返回文档索引](./README.md)
