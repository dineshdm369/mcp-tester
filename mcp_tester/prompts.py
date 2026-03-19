from __future__ import annotations

from pathlib import Path

import yaml

from .models import Suite, TestCase


def load_suite(path: str | Path) -> Suite:
    payload = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    tests = [
        TestCase(
            id=item["id"],
            family=item["family"],
            prompt=item["prompt"],
            expected_check=item.get("expected_check", []),
            notes=item.get("notes"),
        )
        for item in payload.get("tests", [])
    ]
    return Suite(name=payload["suite"], scope=payload.get("scope", "cloud"), tests=tests)
