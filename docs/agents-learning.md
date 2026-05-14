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

## 推荐阅读顺序（新人）

1. [模块说明：桌面 · API · Agents](./module-topology.md) — 职责边界。  
2. [Python Runner 技术选型](./agents-runner-tech-stack.md) — 依赖与定稿。  
3. [Agent 难点与坑点](./agents-challenges.md) — 实施前扫一遍。  
4. [ARCHITECTURE](./ARCHITECTURE.md) — Runner HTTPS、心跳、队列与契约版本。

← [返回文档索引](./README.md)
