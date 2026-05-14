# 实施分段（已定稿）

本文约束 **当前仓库落地的先后顺序**，与 [总览 · 版本节奏](./overview.md) 中的「阶段一 / 二 / 三」可并行阅读：此处强调的是 **编码里程碑**，不以替换三层架构愿景为原则。

---

## 环境与交付顺序（宏观）

1. **前期**：开发与验证 **全部在本地**（本地 Express、本地 DB/Redis、本地前端）。
2. **中后期**：**桌面安装包**（Electrobun + React）、如有需要再上 **H5**。
3. **最后**：将 **云端控制面**（API、Worker、数据库、队列等）部署到 **云服务器**； Runner 仍在用户侧本机。

### 工期不足时的收窄（可选路径）

若排期不够：**只在本地环境跑通闭环**（本地 Express + DB/Redis + 浏览器直连或本地前端均可）。**暂不部署云**、**不打 Electrobun 安装包**、**不产出 / 不编译 H5**。等产品与 Agent 联调稳定后，再按上文顺序补齐打包与上云。

---

## 第一阶段（编码优先级）：Node + 前端收口

**目标**：控制面与 UI **功能闭环**，可先不做真实 Agent / Runner 执行。

| 事项 | 要求 |
|------|------|
| **Express（Node）** | 路由、鉴权、业务 CRUD、队列入队（若已启用队列可先写入占位 Worker）、统一错误体、健康检查等与前端对齐的实现。**先做可用的本地一条龙**。**结构化日志与 `traceId` 贯通为第一期必做**，排障依赖见 [清晰日志](./logging.md#phase1-logging-baseline)「第一期底线」。进程 **`SIGTERM`/`SIGINT` 优雅退出**见 [ARCHITECTURE §10](./ARCHITECTURE.md#graceful-shutdown)，与 backlog **优先级 14** 一并验收。 |
| **前端（React）** | 与既定栈一致：**Electrobun 壳内的 React**（开发期可用浏览器直连 API 联调）。登录、项目、任务视图、配置等与第一期 MUST 对齐。**需求/任务侧用户输入与占位 Agent 输出一律以文本（及 JSON 字段）进入 DB**，第一期 **不做** 通用二进制文件上传与对象存储；若二期要附件再单独立项。 |
| **Cursor / AI 编码约定** | 第二期起可按 **`agents/*` 编码角色**（如后端 / 前端 / BFF）配置 **不同 `.cursor/rules`（globs 分流）**；第一期控制面开发共用现有仓库规则即可。 |
| **依赖 Agent 的接口** | **仅占位**：约定路径与方法不变；处理器返回 **固定 JSON（或与最终实现一致的 Schema 形状）**，不写 Python Runner / 真实模型调用。 |
| **契约** | Stub 响应应沿用计划在第二阶段落地的 **字段名与枚举**，避免第二阶段大范围改路由与前端模型（可先以一页 OpenAPI / Schema 草稿为准）。第一期 **颗粒任务与优先级** 见 [v1 设计清单 · 第一期 backlog](./v1-design-and-progress.md#phase1-backlog)。 |

**第一阶段完成的判定建议**：在不启动 Runner、不接模型的情况下，产品路径可走通（含队列/UI 状态若为占位则需与设计一致）。

**日历（已定）**：第一期 **2 个工作日**（Node + `apps/web`，backlog **不砍项**，见 [v1 · 第一期 backlog](./v1-design-and-progress.md#phase1-backlog)）。

<a id="phase2-agents"></a>

## 第二阶段：Agents（Runner）实现与联调

**启动时机（已定）**：**第一期 Node + 前端（含 `apps/web`）闭环验收通过后**，再进入 Agents 层工作。在此之前 **不做** Agents 目录大规模铺开；第一期仅占位接口与 curl 级 Runner 契约验证即可。

**Agents 细分与排期**：进入第二阶段伊始（可与下文「对齐梳理」合并为同一天上半场），单独梳理：**Runner 进程数 vs 少进程多角色**、[README · Agent 细分](../README.md#agent-subroles-runner-decouple)、`agents/*` 包结构与 **里程碑排期**，结论写入 [v1 设计清单](./v1-design-and-progress.md)（新小节或追加表格均可）。

**第二期开局仍须定型（与已实现文档区分开）**：**`agents/runner` 的 Python 依赖与框架组合** 已于 [Python Runner 技术选型](./agents-runner-tech-stack.md) **定稿**（2026-05-14）；**Runner 进程数、`uv` 多包划分、步骤流转与状态机细节、与 ARCHITECTURE / OpenAPI 的一一映射** 仍须在第一期闭环后的 **专场** 敲定后再大规模编码。下文「10～14 天」仅为 **量级占位**，随流程定型结果可调。

**硬性门禁**：在进入本阶段 **大规模编写 Agents / Runner 之前**，预留 **半天～一整天**，做一次 **对齐梳理**，确认以下内容后再批量编码：

- Node 层：**任务 DTO、`stepKind` / 载荷、`apiVersion` / `skillSchemaVersion`** 与即将实现的 Runner 消费契约一致。
- 前端：列表 / 详情 / 状态枚举 / 轮询或 SSE 字段 **与 API 真返回值一致**（替换 Stub）。
- 队列与状态机：**失败、超时、终态** 与 Runner 回写语义一致。
- 将梳理结论 **记入** [v1 设计清单与实施进度](./v1-design-and-progress.md)（追加一行即可）。

**本阶段工作**：Python Runner、`agents/*`、真实入队消费、与前端/API 联调；按需迭代 ARCHITECTURE / OpenAPI。

**日历（粗估）**：第二期大致 **10～14 个工作日**（Agents + 与 Node / `apps/web` 联调）；**正式日历与里程碑**在技术架构与流程 **定型之后** 写入 [v1 设计清单](./v1-design-and-progress.md)。

---

## 与文档索引的关系

- 详细设计清单与日常进度仍记在 [v1-design清单与实施进度](./v1-design-and-progress.md)。
- Agent 逻辑角色与少进程映射见根目录 [README · Agent 章节](../README.md#agent-subroles-runner-decouple)。
- **Python Runner 技术定稿**：[Python Runner 技术选型](./agents-runner-tech-stack.md)；**练习边界**：[Agent 学习模块](./agents-learning.md)；**专项坑点**：[Agent 难点与坑点](./agents-challenges.md)。

← [返回文档索引](./README.md)
