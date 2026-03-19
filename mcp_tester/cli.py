from __future__ import annotations

import argparse
from pathlib import Path

from .config import AppConfig, load_env
from .runner import run


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run MCP UAT prompt suites.")
    parser.add_argument("--suite", required=True, help="Suite name or YAML path, e.g. cloud-core or prompts/cloud-core.yaml")
    parser.add_argument("--provider", required=True, choices=["anthropic", "openai", "openrouter"])
    parser.add_argument("--model", required=True, help="Model name to use")
    parser.add_argument("--mcp-config", default=".mcp.json", help="Path to MCP config JSON")
    parser.add_argument("--mcp-server", required=True, help="Server name inside .mcp.json")
    parser.add_argument("--output-dir", default="results", help="Directory for dated markdown and json logs")
    parser.add_argument("--program", default="program.md", help="Path to program.md")
    parser.add_argument("--test-id", help="Run a single test case by id")
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-turns", type=int, default=12)
    parser.add_argument("--no-grade", action="store_true")
    return parser


def resolve_suite_path(value: str) -> Path:
    candidate = Path(value)
    if candidate.exists():
        return candidate
    prompt_path = Path("prompts") / f"{value}.yaml"
    if prompt_path.exists():
        return prompt_path
    raise FileNotFoundError(f"Could not resolve suite path for: {value}")


def main() -> None:
    load_env()
    args = build_parser().parse_args()
    config = AppConfig(
        provider=args.provider,
        model=args.model,
        suite_path=resolve_suite_path(args.suite),
        program_path=Path(args.program),
        mcp_config_path=Path(args.mcp_config),
        mcp_server_name=args.mcp_server,
        output_dir=Path(args.output_dir),
        temperature=args.temperature,
        max_turns=args.max_turns,
        no_grade=args.no_grade,
        test_id=args.test_id,
    )
    results = run(config)
    total = len(results)
    verdicts = {}
    for result in results:
        verdicts[result.verdict] = verdicts.get(result.verdict, 0) + 1
    print(f"Completed {total} test(s).")
    for key, value in verdicts.items():
        print(f"- {key}: {value}")
