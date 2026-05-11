# 架构图与端到端流程

## 总体架构图（逻辑视图）

```mermaid
flowchart TB
  subgraph localdesk["用户本机 · Electrobun + React + Runner"]
    subgraph reactui["React · WebView"]
      UI["界面 · 项目 / 对话 / 日志"]
    end
    subgraph agentsLayer["Runner · Python Agents · uv"]
      REQ["requirements"]
      COD["coding"]
      REV["review"]
      TST["test"]
      OPS["ops"]
    end
    subgraph customer["客户工程目录"]
      WS["workspaceRoot"]
      CFG["agents.config.yaml"]
    end
    COD & REV & TST & OPS --> WS
    REV & TST --> CFG
  end

  subgraph cld["云端部署"]
    subgraph bff["Express API"]
      MW["中间件 · 限流"]
      AUTH["鉴权"]
      RT["路由"]
      ORCH["编排 · 队列"]
      STRM["SSE 聚合"]
      WM["后台任务"]
      MW --> AUTH --> RT
      RT --> ORCH
      ORCH --> STRM
      ORCH --> WM
    end
    DB[("PostgreSQL 等")]
    ORCH --> DB
  end

  UI -->|HTTPS REST/SSE| RT
  ORCH --> REQ & COD & REV & TST & OPS
  STRM --> REQ & COD & REV & TST & OPS
```

**图示**：`reactui` 与 `agentsLayer` 同属 **本机**；Express 仅在 **云端** 编排并入队，**任务执行与磁盘 IO** 只在 Runner 内完成；`workspaceRoot` **永不** 挂载到业务 VPS。

## 端到端功能流程图（主流水线）

```mermaid
sequenceDiagram
  participant U as 用户
  participant N as Electrobun 内 React
  participant X as Express 中间层
  participant P as Runner 内 Python Agent
  participant W as 本机工作区

  U->>N: 操作界面 / 发送消息
  N->>X: HTTPS API（Token / 会话，见桌面端存储策略）
  X->>X: 校验载荷 · 更新任务状态
  X->>P: 投递任务（队列或 Runner 通道，含 taskId / Skill）
  P->>W: 本机磁盘 · Git · 子进程（白名单内）
  P-->>X: 结构化结果或流式 chunk
  X-->>N: SSE/WebSocket 转发 · 或轮询任务
  N-->>U: 渲染对话 · 日志 · 报告
```

步骤型流水线（与具体 UI 无关的逻辑）可概括为：

```mermaid
flowchart LR
  A["React 桌面端动作"] --> B["Express 云端<br/>解析 · 校验 · step"]
  B --> C{"步骤"}
  C -->|requirements| D["Python<br/>requirements"]
  C -->|coding| E["Python<br/>coding"]
  C -->|review| F["Python<br/>review"]
  C -->|test| G["Python<br/>test"]
  C -->|ops| H["Python<br/>ops"]
  D & E & F & G & H --> B
  B --> I["持久化 + 推送到前端"]
```

← [返回文档索引](./README.md)
