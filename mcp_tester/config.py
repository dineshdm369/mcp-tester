from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


@dataclass
class AppConfig:
    provider: str
    model: str
    suite_path: Path
    program_path: Path
    mcp_config_path: Path
    mcp_server_name: str
    output_dir: Path
    temperature: float = 0.0
    max_turns: int = 12
    no_grade: bool = False
    test_id: str | None = None
    run_id: str | None = None
    server_tag: str | None = None


@dataclass
class MCPServerConfig:
    name: str
    transport: str
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None


def load_env() -> None:
    load_dotenv()


def get_api_key(provider: str) -> str:
    env_map = {
        "openai": "OPENAI_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
    }
    key_name = env_map[provider]
    value = os.getenv(key_name)
    if not value:
        raise RuntimeError(f"Missing {key_name} in environment.")
    return value


def load_mcp_server_config(path: str | Path, server_name: str) -> MCPServerConfig:
    payload: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
    server = payload["mcpServers"][server_name]
    transport = server.get("transport") or ("streamable_http" if server.get("url") else "stdio")
    return MCPServerConfig(
        name=server_name,
        transport=transport,
        command=server.get("command"),
        args=server.get("args", []),
        env=server.get("env", {}),
        url=server.get("url"),
        headers=server.get("headers", {}),
    )
