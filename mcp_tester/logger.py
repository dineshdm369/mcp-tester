from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from .models import TestResult


def _today_slug() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def suite_hash(suite_path: str | Path) -> str:
    """Return a short sha256 hex digest of the suite YAML for reproducibility."""
    content = Path(suite_path).read_bytes()
    return "sha256:" + hashlib.sha256(content).hexdigest()[:16]


def get_output_paths(output_dir: str | Path, run_id: str) -> tuple[Path, Path]:
    """Return (md_path, json_path) for this run, creating the run directory."""
    run_dir = Path(output_dir) / _today_slug() / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir / "results.md", run_dir / "results.json"


def write_meta(output_dir: str | Path, date_slug: str, run_id: str, meta: dict[str, Any]) -> None:
    """Write or overwrite meta.json for this run."""
    run_dir = Path(output_dir) / date_slug / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def append_markdown(path: Path, result: TestResult) -> None:
    lines = [
        "---",
        "",
        f"## {result.test_id} — {result.family}",
        "",
        f"**Suite:** {result.suite} &nbsp;|&nbsp; "
        f"**Provider:** {result.provider} / {result.model} &nbsp;|&nbsp; "
        f"**Date:** {result.date}",
        "",
        "### Prompt",
        "",
        result.prompt,
        "",
        "### Expected Checks",
        "",
        *[f"- {item}" for item in result.expected_check],
        "",
        "### Actual Response",
        "",
        result.actual_response,
        "",
        f"### Verdict: {result.verdict}",
    ]

    if result.remarks:
        lines += [
            "",
            "**Remarks**",
            "",
            *[f"- {item}" for item in result.remarks],
        ]

    if result.issue_classes:
        lines += [
            "",
            f"**Issue Classes:** {' · '.join(result.issue_classes)}",
        ]

    if result.usage:
        usage_parts = [f"{k}: {v}" for k, v in result.usage.items() if v is not None]
        if usage_parts:
            lines += [
                "",
                f"**Token Usage:** {' · '.join(usage_parts)}",
            ]

    if result.tool_calls:
        lines += [
            "",
            "**Tool Calls**",
            "",
            *[
                f"- `{call['name']}` &nbsp; `{json.dumps(call['arguments'], ensure_ascii=False)}`"
                for call in result.tool_calls
            ],
        ]

    lines.append("")
    with path.open("a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


def append_json(path: Path, result: TestResult) -> None:
    payload = []
    if path.exists():
        payload = json.loads(path.read_text(encoding="utf-8"))
    payload.append(asdict(result))
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
