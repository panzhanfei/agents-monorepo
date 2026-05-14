# agents-runner（本机 Runner）

Python **Runner**：**FastAPI** 入站（默认 `127.0.0.1`）、**httpx** 访问 **`apps/api`**；编排与检索按仓库定稿选用 **LangGraph + LangChain + LlamaIndex（仅检索）+ LiteLLM**。技术总表见 [Python Runner 技术选型](../../docs/agents-runner-tech-stack.md)。

## 环境与命令

- **Python**：3.11+  
- **依赖管理**：推荐 [**uv**](https://github.com/astral-sh/uv)（与 [总览](../../docs/overview.md) 一致）

```bash
cd agents/runner
cp .env.example .env   # 按需修改
uv sync --extra dev     # 开发：含 ruff（及预留的 pytest 依赖，当前无单元测试目录）
# 选用 Qdrant 或 Postgres/pgvector 时再加对应 extra（与 `pyproject.toml` 一致）
uv sync --extra dev --extra vector-qdrant
# 或：uv sync --extra dev --extra vector-pg
uv run agents-runner    # 或：uv run uvicorn runner.interfaces.api:create_app --factory --host 127.0.0.1 --port 8765
```

### 首次使用（推荐）

1. 启动 **`apps/web`** 并**登录**（与 API 同一账号）。  
2. 在 **`agents/runner`** 执行 **`uv run agents-runner`**。  
3. 首次会在本机打开浏览器页面并**自动**完成环境准备（无需在页面上再点按钮）；完成后**重启一次** `agents-runner`。  
4. 若未登录，请先登录；系统会回到该页面继续自动准备。

若 Web 使用 `localhost` 而本机打开的是 `127.0.0.1`（或相反），请统一配置 **`RUNNER_SETUP_WEB_ORIGIN`** 与实际访问前端的 origin。

### 备选：命令行注册

适合无图形界面或自动化；需自行提供用户 JWT，见 **`agents-runner register --help`**。

```bash
export RUNNER_REGISTER_ACCESS_TOKEN='…JWT…'
cd agents/runner
uv run agents-runner register
```

凭据写入 **`~/.agents-runner/device.env`** 后再执行 **`uv run agents-runner`**。

未安装 uv 时，可用 **`python -m venv .venv && pip install -e ".[dev]"`**，再在激活的 venv 中执行 **`python -m runner`**。

首次安装若拉取 LangChain / LlamaIndex 等大包，耗时会较长，属正常现象。

## 目录与职责（`src/runner/`）

| 路径 | 职责 |
|------|------|
| **`__main__.py`** | CLI：`agents-runner` 启动 **`uvicorn`**；子命令 **`agents-runner register`** 向 Node 注册并写入 `~/.agents-runner/device.env`。 |
| **`config/settings.py`** | **`pydantic-settings`**：环境变量（前缀 **`RUNNER_`**）、项目 **`.env`**、用户 **`~/.agents-runner/device.env`**。 |
| **`interfaces/api.py`** | **FastAPI**、`lifespan`、**一键绑定**（链接 / 可选打开浏览器）、**CORS**、**`NodeApiClient`**。 |
| **`interfaces/routes/`** | **`/health`**、**`/v1/stream/example`**、**`/v1/setup/ingest`**（Web 回写凭据）。 |
| **`application/`** | 用例编排：后续放 **LangGraph** 图构建与 invoke；**不**在路由里散落业务 HTTP。 |
| **`domain/`** | 领域规则与类型（与 HTTP/ SDK 解耦）。 |
| **`cli/register.py`** | **`agents-runner register`**（无浏览器时的备选）。 |
| **`infrastructure/node_client.py`** | **httpx** 访问 Node：`/v1/runner/*`、`agent-slots` 等。 |
| **`infrastructure/logging_config.py`** | **结构化日志（structlog + JSON）** 初始化。 |

根目录 **`pyproject.toml`**：运行时依赖已对齐定稿选型（含 FastAPI、httpx、LangChain、LangGraph、llama-index-core、LiteLLM、structlog）；**`extra dev`**（ruff，及预留 **pytest** 依赖）；**`extra vector-qdrant`** / **`extra vector-pg`** 对应两种向量库路径。**锁文件 `uv.lock`** 与上述 extras 一致；若仅改动了 `pyproject.toml`，请在 `agents/runner` 内执行 **`uv lock`** 后提交更新后的 `uv.lock`。

## 相关文档

- [Agent 学习模块](../../docs/agents-learning.md)  
- [Agent 难点与坑点](../../docs/agents-challenges.md)  
- [agents-python 规则](../../.cursor/rules/agents-python.mdc)
