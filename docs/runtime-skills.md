# 运行时 Skill 分层（跨语言）

**Skill**：编排时注入的任务上下文（例如实现角色、栈画像、运维模式、目标栈等），**不是** Cursor 里的 `SKILL.md`。

```mermaid
flowchart TB
  subgraph L1["1. 契约层（单一事实来源）"]
    C["OpenAPI / JSON Schema<br/>或 codegen 产物"]
  end
  subgraph L2["2. 编排层 Express（云端）"]
    O["校验 · 默认值 · 透传 Skill · 状态机 · 投递 Runner"]
  end
  subgraph L3["3. 执行层 · Runner 上 Python Agents"]
    R["消费契约 · 本机目录白名单 · 输出报告 DTO"]
  end
  L1 --> L2 --> L3
```

**原则**：新增字段时先改契约；Express 负责校验与下发；Python 只认契约中的类型，避免硬编码散落字符串。

（与 Cursor 规则 **`runtime-skills-layering.mdc`**、若存在的 `packages/pipeline-core` 对齐。）

← [返回文档索引](./README.md)
