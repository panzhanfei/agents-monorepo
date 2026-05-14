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

未安装 uv 时，可用 **`python -m venv .venv && pip install -e ".[dev]"`**，再在激活的 venv 中执行 **`python -m runner`**。

首次安装若拉取 LangChain / LlamaIndex 等大包，耗时会较长，属正常现象。

## 目录与职责（`src/runner/`）

| 路径 | 职责 |
|------|------|
| **`__main__.py`** | CLI 入口：`uv run agents-runner`，内部 **`uvicorn`** 加载 **`create_app` 工厂**。 |
| **`config/settings.py`** | **`pydantic-settings`**：从环境变量（前缀 **`RUNNER_`**）读取 host/port、`node_api_base`、日志级别等。 |
| **`interfaces/api.py`** | 组装 **FastAPI**、**lifespan**（挂载 **`NodeApiClient`**、进程退出时关闭）。 |
| **`interfaces/routes/`** | HTTP 路由：如 **`/health`**、**`/v1/stream/example`**（SSE 占位）。 |
| **`application/`** | 用例编排：后续放 **LangGraph** 图构建与 invoke；**不**在路由里散落业务 HTTP。 |
| **`domain/`** | 领域规则与类型（与 HTTP/ SDK 解耦）。 |
| **`infrastructure/node_client.py`** | **httpx** 访问 Node 的客户端占位，具体路径与鉴权头随 OpenAPI 对接扩展。 |
| **`infrastructure/logging_config.py`** | **结构化日志（structlog + JSON）** 初始化。 |

根目录 **`pyproject.toml`**：运行时依赖已对齐定稿选型（含 FastAPI、httpx、LangChain、LangGraph、llama-index-core、LiteLLM、structlog）；**`extra dev`**（ruff，及预留 **pytest** 依赖）；**`extra vector-qdrant`** / **`extra vector-pg`** 对应两种向量库路径。**锁文件 `uv.lock`** 与上述 extras 一致；若仅改动了 `pyproject.toml`，请在 `agents/runner` 内执行 **`uv lock`** 后提交更新后的 `uv.lock`。

## 相关文档

- [Agent 学习模块](../../docs/agents-learning.md)  
- [Agent 难点与坑点](../../docs/agents-challenges.md)  
- [agents-python 规则](../../.cursor/rules/agents-python.mdc)
