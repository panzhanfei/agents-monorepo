# agents-monorepo（软件研发智能群体）

**云端控制面（Node / Express）+ 本机 Electrobun + React + Runner（Python / uv）**：客户工程 **仅在用户侧 Runner 落盘**，服务器不直接读写客户仓库。

---

## 一眼导航：完整文档地图

**以下链接覆盖原「单巨型 README」的全部内容**；进入仓库后 **先看本表** 即可跳转到对应主题。正文已全部拆到 [`docs/`](./docs/README.md)。

| 文档 | 内容提要 |
|------|----------|
| [总览与版本节奏](./docs/overview.md) | 三层架构表、阶段一/二/三、pnpm+uv、**消息队列与 Runner 心跳**（必选） |
| [v1 设计清单与实施进度](./docs/v1-design-and-progress.md) | 库表 / Redis / 队列 / Socket / JWT / 业务与 Agent·前端接口；**进度表（随记）** |
| [业务域：用户与多项目](./docs/business-domain.md) | `workspaceRoot`、多项目隔离、Runner 安全与并发 |
| [远程部署与 Electrobun 桌面](./docs/remote-desktop-electrobun.md) | 云 + 本机职责边界、桌面选型 |
| [架构图与端到端流程](./docs/architecture-diagrams.md) | Mermaid 逻辑图、时序图、步骤流水线 |
| [运行时 Skill 分层](./docs/runtime-skills.md) | 契约 / 编排 / Python 执行 |
| [模块说明：桌面 · API · Agents](./docs/module-topology.md) | `apps/desktop`、`apps/api`、`agents/*`、共享契约 |
| [坑点与对策](./docs/pitfalls.md) | CI、流式、Agent 拓扑、产品与编排 |
| [高并发](./docs/high-concurrency.md) | 队列分区、无状态 API、背压与幂等 |
| [清晰日志](./docs/logging.md) | `traceId`、字段表、脱敏 |
| [数据概念图](./docs/data-model-concept.md) | User / Project / Task / Thread |
| [本地开发与自测](./docs/local-development.md) | 桌面 / API / Runner 联调要点 |
| [后续渠道：小程序与飞书](./docs/future-channels.md) | 阶段三；飞书 H5、机器人可选 |
| [ARCHITECTURE（控制面定稿）](./docs/ARCHITECTURE.md) | HTTP、队列、心跳、部署拓扑（与实现同步扩展） |

**索引入口**：[docs/README.md](./docs/README.md)（与上表同步维护即可）

---

## 子项目

| 路径 | 说明 |
|------|------|
| [apps/api](./apps/api/README.md) | 云端 Express：迁移、Redis、BullMQ、本地运行命令 |
| apps/desktop | （待建）Electrobun + React；设计见 [module-topology](./docs/module-topology.md) |
| agents/* | （待建）Runner 内 Agent；见 [module-topology](./docs/module-topology.md) |

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
