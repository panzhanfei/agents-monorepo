"""一次性格子：用用户 JWT 在 Node 上注册 Runner，并将 device 凭据写入本机文件。"""

from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.parse import urljoin

import httpx

from runner.config.settings import RUNNER_DEVICE_CREDENTIALS_FILE


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="agents-runner register",
        description="使用已登录用户的访问令牌在本机注册 Runner；凭据写入 ~/.agents-runner/device.env，无需手填 KEY/SECRET。",
    )
    p.add_argument(
        "--api-base",
        default=os.environ.get("RUNNER_NODE_API_BASE", "http://127.0.0.1:3000"),
        help="apps/api 根地址（默认：环境变量 RUNNER_NODE_API_BASE 或 http://127.0.0.1:3000）",
    )
    p.add_argument(
        "--token",
        default=os.environ.get("RUNNER_REGISTER_ACCESS_TOKEN", ""),
        help="用户 JWT（也可用环境变量 RUNNER_REGISTER_ACCESS_TOKEN，避免出现在 shell 历史）",
    )
    p.add_argument(
        "--display-name",
        default="",
        help="可选，在「我的 Runner」列表中显示的名称",
    )
    return p.parse_args(argv)


def run_register(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    token = (args.token or "").strip()
    if not token:
        print(
            "缺少用户访问令牌：请登录 Web/API 后复制 JWT，"
            "执行 export RUNNER_REGISTER_ACCESS_TOKEN='…' 后再运行，或使用 --token（勿提交该变量）。",
            file=sys.stderr,
        )
        return 2

    base = args.api_base.rstrip("/")
    url = urljoin(f"{base}/", "runners/register")
    body: dict[str, str] = {}
    if args.display_name and args.display_name.strip():
        body["displayName"] = args.display_name.strip()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=headers, json=body if body else {})
    except httpx.RequestError as e:
        print(f"无法连接 Node：{e}", file=sys.stderr)
        return 1

    if resp.status_code >= 400:
        detail = resp.text[:500]
        try:
            err = resp.json()
            detail = json.dumps(err, ensure_ascii=False)[:800]
        except json.JSONDecodeError:
            pass
        print(f"注册失败 HTTP {resp.status_code}：{detail}", file=sys.stderr)
        return 1

    data = resp.json()
    runner = data.get("runner") or {}
    device_key = runner.get("deviceKey")
    device_secret = data.get("deviceSecret")
    if not device_key or not device_secret:
        print("响应缺少 deviceKey 或 deviceSecret", file=sys.stderr)
        return 1

    RUNNER_DEVICE_CREDENTIALS_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    lines = [
        "# 由 agents-runner register 写入，请勿提交或共享。",
        f"RUNNER_DEVICE_KEY={device_key}",
        f"RUNNER_DEVICE_SECRET={device_secret}",
        f"RUNNER_NODE_API_BASE={base}",
        "",
    ]
    RUNNER_DEVICE_CREDENTIALS_FILE.write_text("\n".join(lines), encoding="utf-8")
    if os.name != "nt":
        try:
            os.chmod(RUNNER_DEVICE_CREDENTIALS_FILE, 0o600)
        except OSError:
            pass

    print(
        "已注册 Runner，凭据已保存到：",
        RUNNER_DEVICE_CREDENTIALS_FILE,
        "\n直接运行 agents-runner 即可（会自动读取该文件）。",
    )
    return 0
