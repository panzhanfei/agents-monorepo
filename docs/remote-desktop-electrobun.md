# 远程部署与本机桌面（Electrobun + React）（必读）

## 既定方案：云服务器 + 本地 Electrobun

**控制面在云端**：Express、数据库、队列、账号与项目元数据部署在 **云服务器**；用户通过 **安装在本机的 Electrobun 桌面应用**（界面为 **React**）登录并操作。

**执行面在用户电脑**：客户工程目录的 **增删改查、Git、本地跑测试/lint** 全部在 **本机 Runner（Python + uv）** 完成；Electrobun 主进程可负责 **拉起 Runner、RPC、系统托盘、自动更新** 等与操作系统相关的职责。服务器 **不** `clone` 用户私有仓在 VPS 上做日常 Coding，也 **不** 挂载用户的 `workspaceRoot`。

## 硬性约束（与服务器职责边界）

与上一致：**任意客户仓库落盘修改只发生在用户机器**；云端仅存 **任务状态、配置、可选附件元数据** 等。

## 为何选用 Electrobun + React

| 点 | 说明 |
|----|------|
| **超越纯浏览器** | 纯 Web 无法可靠、完整地操作本机目录；桌面壳可稳定绑定 **Runner** 与 **`workspaceRoot`**。 |
| **与云端解耦** | React 仅把云端当作 **API / SSE 端点**（如 `VITE_*`、`import.meta.env` 或构建时注入 `PUBLIC_API_BASE`）；**静态资源也可只随安装包分发**，不必把 UI 托管在业务 VPS 上。 |
| **体量与更新** | Electrobun 面向小型原生壳 + WebView；适合「轻安装包 + 连公网 API」模式（具体版本与能力以 [Electrobun 文档](https://blackboard.sh/electrobun/docs/) 为准）。 |

## 其它拓扑（非本仓库默认）

| 方案 | 说明 |
|------|------|
| **自托管一体机** | Web/API/Runner 同机；适合内网，**不是**「云 SaaS + 千家万户本机仓」的主线。 |
| **仅浏览器** | File System Access 等 **不能**替代 Runner；不作产品主路径。 |

**不适用**：在 **平台服务器** 上维护用户仓 **可写副本** 并让 Agent 在机房内日常改代码。云端 **用户显式上传** 的附件与报告可与 Runner 侧权威工程目录并存，但 **不替代** 本机工程。

## 与本项目其它章节的关系

- **多项目**：`projectId` 绑定 **Runner 设备 id + 本机 `workspaceRoot`**（登记用于校验，真实 IO 仅在 Runner）。  
- **安全**：Runner **注册、吊销、每项目根目录授权**；日志带 **`projectId`、runnerDeviceId**。  
- **高并发**：任务载荷带 **目标 Runner**；多设备时 **按设备队列** 分区，避免误派发。

## 建议在 `ARCHITECTURE.md` 中固定

- 数据面：**哪些 API 仅写 DB**、**哪些步骤必须到达 Runner**。  
- 交付 **Electrobun 安装包构建、自动更新（若启用）、Runner 随包或首次向导安装**；以及 **Runner 心跳、吊销** 说明。  
- 若存在仅此内网工具场景要在服务端碰盘，须 **单独安全审计**，不作为默认产品路径。

← [返回文档索引](./README.md)
