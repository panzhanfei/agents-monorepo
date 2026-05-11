#!/usr/bin/env python3
"""
Rewrites the Desktop mind map XMind (content.json) with subdivided roles + few-process mapping.
Usage: python3 scripts/update-xmind-software-research-agents.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import shutil
import uuid
import zipfile
from pathlib import Path


def new_id() -> str:
    return str(uuid.uuid4())


XMIND_DEFAULT = Path.home() / "Desktop" / "软件研发智能群体.xmind"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--xmind",
        type=Path,
        default=XMIND_DEFAULT,
        help="Path to .xmind file",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    xmind_path: Path = args.xmind.expanduser().resolve()
    if not xmind_path.is_file():
        raise SystemExit(f"XMind not found: {xmind_path}")

    with zipfile.ZipFile(xmind_path, "r") as zin:
        meta = zin.read("metadata.json")
        manifest = zin.read("manifest.json")
        sheets = json.loads(zin.read("content.json"))
        thumb_name = "Thumbnails/thumbnail.png"
        thumb = zin.read(thumb_name) if thumb_name in zin.namelist() else None

    sheet = sheets[0]
    root_id = sheet["rootTopic"]["id"]

    topics_spec: list[tuple[str, str]] = [
        ("细分① 入口 Router", "控制面或 Runner 首跳：意图分类、会话路由；不落仓库业务逻辑。"),
        ("细分② 需求 Analyst", "自然语言→结构化需求；多轮上下文；会话真源在 DB。"),
        ("细分③ PM Spec", "拆解可执行 issue、优先级与依赖。"),
        ("细分④ 架构 Architect", "输出系统/模块架构方案。"),
        ("细分⑤ 契约与拆分", "前端/后端/全栈/BFF 边界、接口契约；下发 coding 任务。"),
        ("细分⑥ Coding·后端", "后端实现；白名单路径与分支策略。"),
        ("细分⑦ Coding·前端", "前端实现。"),
        ("细分⑧ Coding·全栈", "全栈贯通实现。"),
        ("细分⑨ Coding·BFF", "BFF / 聚合层实现。"),
        ("细分⑩ Verify·单元测试", "按模块单测；与客户仓约定的确定性命令。"),
        ("门禁·分批联调≤2 模块", "编排策略在控制面：按依赖分批，每批最多两条 coding 线并行。"),
        ("细分⑪ Verify·联调/E2E", "端到端与全量用例覆盖。"),
        ("细分⑫ Ops·打包运维", "构建、发布、巡检、回滚；仅在前置门禁通过后。"),
    ]

    detached: list[dict] = []
    x0, y0 = 280.0, -540.0
    dx = 195.0
    for title, note_plain in topics_spec:
        tid = new_id()
        html = f"<div>{note_plain}</div>"
        detached.append(
            {
                "id": tid,
                "class": "minorTopic",
                "title": title,
                "notes": {
                    "plain": {"content": note_plain + "\n"},
                    "realHTML": {"content": html},
                },
                "position": {"x": x0 + dx * len(detached), "y": y0},
            }
        )

    proc_specs: list[tuple[str, str]] = [
        ("进程 runner-planning", "承载细分②③④⑤：顺序步骤；同一进程内多角色（提示词/SKILL）。"),
        ("进程 runner-coding", "承载细分⑥⑦⑧⑨：任务载荷 codingLane / stackProfile 区分角色。"),
        ("进程 runner-verify", "承载细分⑩⑪：verifyPhase；分批联调门禁在控制面。"),
        ("进程 runner-ops", "承载细分⑫：与写代码进程隔离。"),
    ]
    py = y0 + 220.0
    px = 360.0
    for title, note_plain in proc_specs:
        detached.append(
            {
                "id": new_id(),
                "class": "minorTopic",
                "title": title,
                "notes": {
                    "plain": {"content": note_plain + "\n"},
                    "realHTML": {"content": f"<div>{note_plain}</div>"},
                },
                "position": {"x": px, "y": py},
            }
        )
        px += 290.0

    role_ids = [t["id"] for t in detached[: len(topics_spec)]]
    relationships: list[dict] = []
    for i in range(len(role_ids) - 1):
        relationships.append({"id": new_id(), "end1Id": role_ids[i], "end2Id": role_ids[i + 1]})

    sheet["rootTopic"]["children"] = {"detached": detached}
    sheet["relationships"] = relationships
    sheet["title"] = "软件研发智能群体（细分角色 + 少进程）"

    layer = [root_id] + [t["id"] for t in detached]
    sheet["arrangeableLayerOrder"] = layer

    out_json = json.dumps([sheet], ensure_ascii=False)
    if args.dry_run:
        print(out_json[:4000])
        print("… dry-run, not writing")
        return

    bak = xmind_path.with_suffix(".xmind.bak")
    shutil.copy2(xmind_path, bak)
    tmp = xmind_path.with_suffix(".xmind.tmp")
    with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_STORED) as zout:
        zout.writestr("metadata.json", meta)
        zout.writestr("manifest.json", manifest)
        zout.writestr("content.json", out_json)
        if thumb is not None:
            zout.writestr(thumb_name, thumb)
    tmp.replace(xmind_path)
    print(f"Updated {xmind_path}; backup {bak}")


if __name__ == "__main__":
    main()
