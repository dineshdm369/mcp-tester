from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from .config import AppConfig, load_mcp_server_config
from .grader import grade_case
from .llm import build_llm
from .logger import append_json, append_markdown, get_output_paths, suite_hash, write_meta
from .mcp_client import MCPClient
from .models import TestResult
from .program import load_program_sections
from .prompts import load_suite

_VERDICT_KEY: dict[str, str] = {
    "Pass": "pass_count",
    "Partial Pass": "partial_pass_count",
    "Fail": "fail_count",
}


async def run_suite(config: AppConfig) -> list[TestResult]:
    run_id = config.run_id or f"run-{datetime.now().strftime('%H%M%S')}"
    date_slug = datetime.now().strftime("%Y-%m-%d")

    sections = load_program_sections(config.program_path)
    runner_system_prompt = sections.get("runner_system", "")
    grader_system_prompt = sections.get("grader_system", "")
    suite = load_suite(config.suite_path)
    llm = build_llm(config.provider, config.model, temperature=config.temperature)
    server_config = load_mcp_server_config(config.mcp_config_path, config.mcp_server_name)
    md_path, json_path = get_output_paths(config.output_dir, run_id)
    selected = [test for test in suite.tests if not config.test_id or test.id == config.test_id]

    meta: dict[str, Any] = {
        "run_id": run_id,
        "date": date_slug,
        "provider": config.provider,
        "model": config.model,
        "suite": suite.name,
        "suite_path": str(config.suite_path),
        "suite_hash": suite_hash(config.suite_path),
        "mcp_server": config.mcp_server_name,
        "temperature": config.temperature,
        "max_turns": config.max_turns,
        "no_grade": config.no_grade,
        "test_id_filter": config.test_id,
        "server_tag": config.server_tag,
        "started_at": datetime.now().isoformat(),
        "finished_at": None,
        "status": "running",
        "total": len(selected),
        "completed": 0,
        "pass_count": 0,
        "partial_pass_count": 0,
        "fail_count": 0,
        "not_graded_count": 0,
    }
    write_meta(config.output_dir, date_slug, run_id, meta)

    results: list[TestResult] = []
    try:
        async with MCPClient(server_config) as mcp_client:
            for case in selected:
                agent = await llm.run_prompt(
                    system_prompt=runner_system_prompt,
                    user_prompt=case.prompt,
                    mcp_client=mcp_client,
                    max_turns=config.max_turns,
                )
                grade = await grade_case(
                    llm=llm,
                    grader_system_prompt=grader_system_prompt,
                    case=case,
                    actual_response=agent.text,
                    no_grade=config.no_grade,
                )
                result = TestResult.from_parts(
                    case=case,
                    suite=suite.name,
                    provider=config.provider,
                    model=agent.raw_model or config.model,
                    agent=agent,
                    grade=grade,
                )
                append_markdown(md_path, result)
                append_json(json_path, result)
                results.append(result)

                meta["completed"] += 1
                meta[_VERDICT_KEY.get(result.verdict, "not_graded_count")] += 1
                write_meta(config.output_dir, date_slug, run_id, meta)

    except asyncio.CancelledError:
        meta["status"] = "cancelled"
        meta["finished_at"] = datetime.now().isoformat()
        write_meta(config.output_dir, date_slug, run_id, meta)
        raise

    except Exception as exc:
        meta["status"] = "failed"
        meta["error"] = str(exc)
        meta["finished_at"] = datetime.now().isoformat()
        write_meta(config.output_dir, date_slug, run_id, meta)
        raise

    meta["status"] = "complete"
    meta["finished_at"] = datetime.now().isoformat()
    write_meta(config.output_dir, date_slug, run_id, meta)
    return results


def run(config: AppConfig) -> list[TestResult]:
    return asyncio.run(run_suite(config))
