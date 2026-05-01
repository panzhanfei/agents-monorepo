# 飞书指令格式与示例（复盘）

约定：

- **验证码**：当 `agents.config.yaml` 里 `security.verificationCode.enabled=true` 时，下文标注 **「需验证码」** 的指令，消息正文必须包含与 **`security.verificationCode.staticCode`**（或环境变量 **`VERIFY_CODE`**）**完全一致**的一段字符串（任意位置均可，建议固定写在最后一行）。
- 下列 **「指令关键词」** 由编排层（orchestrator）解析；实现时可同时支持自然语言同义词，但**建议客户按表格格式发**，减少歧义。
- 文中 **`YOURCODE`** 请替换为你方配置的真实静态口令；**勿**把真实口令提交到公开文档或截图外传。
- **分步确认（可选）**：当配置 **`feishu.confirmBetweenPipelineSteps: true`** 时，每个主要子步骤结束后机器人向群内发 **摘要 + 是否进入下一步** 的说明；你方用固定话术回复（见 **§14**）。实现侧需用 **任务状态**（如 `pending_confirmation`）与最近一次已完成步骤关联，避免 Webhook 重试导致误推进。

---

## 0. 新手指引（帮助）

**用途**：客户或新进群成员 **第一次接触** 时，用一两句话唤起 **流水线说明**（五类 Agent + 建议顺序），**不落任务**。

| 项 | 说明 |
|----|------|
| 内部动作 | `help` |
| 是否需验证码 | **不需要** |

**推荐格式（发一条即可）：**

```text
帮助
```

```text
新手指引
```

```text
新手入门
```

```text
使用说明
```

```text
指令：帮助
```

```text
help
```

**实现约定（本仓）**：`parseIntentFromMessage` 识别上述话术 → orchestrator 返回 JSON 中的 **`feishuReplyText`**（由 `buildCustomerHelpFeishuReply` 生成），接入飞书时 **原样转发为群消息**。更长的背景说明见 **[CUSTOMER_GUIDE.md](./CUSTOMER_GUIDE.md)**。

---

## 1. 绑定本机工作区（新项目 / 无 Git）

| 项 | 说明 |
|----|------|
| 内部动作 | `change_workspace_binding` |
| 是否需验证码 | **需验证码**（见配置 `requiredForActions`） |

**推荐格式：**

```text
指令：绑定工作区
路径：/Users/zhangsan/Projects/my-new-app
YOURCODE
```

**单行示例：**

```text
绑定工作区 路径 /Users/zhangsan/Projects/my-new-app YOURCODE
```

---

## 2. 设置 / 更换远端 Git 地址（后续推仓库）

| 项 | 说明 |
|----|------|
| 内部动作 | `git_remote_override` |
| 是否需验证码 | **需验证码** |

```text
指令：设置远端仓库
地址：https://github.com/acme/new-repo.git
YOURCODE
```

```text
设置远端仓库 https://github.com/acme/new-repo.git YOURCODE
```

---

## 3. 编码任务（写代码 / 改需求）

| 项 | 说明 |
|----|------|
| 内部动作 | `code`（产品语义；不在 `requiredForActions` 内） |
| 是否需验证码 | **一般不需要**（按当前 YAML） |

```text
指令：编码
说明：在登录页增加「记住我」开关，状态写入 localStorage，并补充 Vitest。
```

```text
编码：给 orchestrator 的 /health 增加版本号字段 version，取自 package.json。
```

---

## 4. 产品需求分析（结构化需求 / PRD）

| 项 | 说明 |
|----|------|
| 内部动作 | `requirements_analysis` |
| 是否需验证码 | **一般不需要**（按当前 YAML） |

```text
指令：需求分析
说明：我们是 B 端工单系统，要在列表页支持按状态和负责人筛选、导出 CSV；请整理用户故事、验收标准、边界与风险。
```

```text
需求分析：把上文口径落成 Markdown PRD，群里确认后再进入编码。
```

---

## 5. 执行代码审核（工具链 + AI 规则）

| 项 | 说明 |
|----|------|
| 内部动作 | `review` |
| 是否需验证码 | **执行审核不需要**；**修改审核规则 / profile** 见第 10 条 |

```text
指令：审核
范围：当前分支全部改动
```

```text
审核：跑一轮 blocking + AI，结果发群里。
```

---

## 6. 全量测试并出报告

| 项 | 说明 |
|----|------|
| 内部动作 | `test`（调用根配置 `pipeline.fullTestCommand`） |
| 是否需验证码 | **一般不需要** |

```text
指令：全量测试
```

```text
测试：按仓库配置的 fullTestCommand 全量跑，把摘要发群。
```

---

## 7. 发包 / 部署（同步产物、远端重启等）

| 项 | 说明 |
|----|------|
| 内部动作 | `publish` |
| 是否需验证码 | **需验证码** |

```text
指令：发包
说明：测试已通过，按当前配置发布到生产。
YOURCODE
```

```text
发包 YOURCODE
```

---

## 8. 回滚到上一备份 / 指定备份

| 项 | 说明 |
|----|------|
| 内部动作 | `rollback` |
| 是否需验证码 | **需验证码**（另可按配置要求二次确认话术） |

```text
指令：回滚
目标：上一版本
YOURCODE
```

```text
回滚 YOURCODE
```

---

## 9. 服务器巡检（端口 / 环境 / 服务摘要）

| 项 | 说明 |
|----|------|
| 内部动作 | `probe`（产品语义；当前未列入 `requiredForActions`） |
| 是否需验证码 | **按当前 YAML 不需要**（若你希望收紧，可把 `probe` 加入 `requiredForActions`） |

```text
指令：巡检服务器
```

```text
巡检：采集 ss、磁盘、内存摘要，对照端口 80,443,3000,4000，发群。
```

---

## 10. 更改审核规则或 Profile（敏感配置）

| 项 | 说明 |
|----|------|
| 内部动作 | `change_review_rules` |
| 是否需验证码 | **需验证码** |

```text
指令：切换审核策略
profile：strict
YOURCODE
```

```text
修改审核规则：启用 strict profile YOURCODE
```

---

## 11. 更改部署目标（路径 / 主机 / SSH 等）

| 项 | 说明 |
|----|------|
| 内部动作 | `change_deploy_target` |
| 是否需验证码 | **需验证码** |

```text
指令：更改部署路径
远端路径：/srv/my-app-v2
YOURCODE
```

---

## 12. 查询任务状态（可选）

| 项 | 说明 |
|----|------|
| 内部动作 | `status` |
| 是否需验证码 | **不需要** |

```text
指令：状态
```

```text
当前任务进度？
```

---

## 13. 取消任务（可选）

| 项 | 说明 |
|----|------|
| 内部动作 | `cancel` |
| 是否需验证码 | **建议实现侧要求验证码**（当前 YAML 未单列，可自行扩展） |

```text
指令：取消任务
```

---

## 14. 分步模式：每步结束群内汇报并等待确认

| 项 | 说明 |
|----|------|
| 前置条件 | `agents.config.yaml` 中 **`feishu.confirmBetweenPipelineSteps: true`**（默认可为 `false`，由实现读取） |
| 行为（产品） | 每个 **编排子步骤**（如需求分析完成、编码完成、审核完成、全量测完成等）结束后，orchestrator **向当前群推送**该步结果摘要，并提示如何进入下一步或暂停。 |
| 内部动作（回复） | `workflow_continue` — 确认进入下一步；`workflow_pause` — 本流水线暂不继续（不等同于 **§13** 取消整任务，实现可合并或区分） |

**机器人推送示例（实现可改写语气，语义保持一致）：**

```text
【步骤】全量测试 已完成
【摘要】共 120 用例，失败 0；耗时 3m12s。
回复「继续」或「下一步」将开始：打包与发包前检查。
回复「暂停」将停在此步，稍后仍可用「继续」推进。
```

**用户回复示例（与 **§12** 可共用同一 `taskId` / 会话线索，由编排关联）：**

```text
继续
```

```text
下一步
```

```text
暂停
```

**说明**：若未打开 `confirmBetweenPipelineSteps`，行为与「自动连跑下一步」由编排策略决定；一键流水线（**§15**）在打开分步确认时，应在 **测试完成 → 打包完成 → 发包前** 等边界各停一次并征求确认（**发包**步仍须带验证码，见 §15）。

---

## 15. 一键：全量测试 + 打包 + 发包

| 项 | 说明 |
|----|------|
| 内部动作 | `full_release`（组合动作：顺序为 **全量测试 → 打包（构建）→ 发包/部署**） |
| 是否需验证码 | **需验证码**（含破坏性远端变更；与单步 `publish` 同级） |
| 配置依据 | 测试：`pipeline.fullTestCommand`；打包：通常同 `pipeline.publishCommand`（根目录构建）或实现侧专用 build 命令；发包：现有 ops / `publish` 路径与 `server.*`。 |

**推荐格式：**

```text
指令：一键发布
说明：按配置执行全量测试、打包并发布到当前部署目标。
YOURCODE
```

**简略示例：**

```text
一键发布 YOURCODE
```

```text
一键测试打包发包 YOURCODE
```

**编排注意（架构）**：整段流水线 **耗时长**，HTTP 入口应 **接纳任务 + 异步执行**，进度与分步确认通过 **群内消息 + 状态查询（§12）** 回报；不得假设单次 Webhook 请求会阻塞到全部结束。若启用 **§14**，在测试结束、构建结束等节点 **分别停** 并再次确认后再执行需验证码的 **最终发包**（实现可避免在同一条消息里重复索要验证码，具体以产品为准）。

---

## 小结：哪些必须带验证码（与 `agents.config.yaml` 对齐）

当前 `security.verificationCode.requiredForActions` 为（以仓库内 YAML 为准）：

- `publish` — 发包  
- `full_release` — **一键** 全量测试 + 打包 + 发包（见 **§15**）  
- `rollback` — 回滚  
- `change_review_rules` — 改审核规则 / profile  
- `change_deploy_target` — 改部署目标  
- `change_workspace_binding` — 绑定 / 更换工作区路径  
- `git_remote_override` — 设置 / 更换远端 Git  

其余（需求分析、编码、跑审核、单独全测、巡检、查状态、分步确认回复 `workflow_continue` / `workflow_pause` 等）**默认**不要求验证码；你若要收紧，只需往 YAML 的 `requiredForActions` 里追加对应动作名即可。
