from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .config import AppConfig, load_env, get_api_key
from .logger import suite_hash
from .runner import run_suite

# Paths are resolved relative to the working directory where uvicorn is launched
# (expected to be the repo root).
RESULTS_DIR = Path("results")
PROMPTS_DIR = Path("prompts")
MCP_CONFIG_PATH = Path(".mcp.json")
PROGRAM_PATH = Path("program.md")

load_env()

app = FastAPI(title="mcp-tester API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# Keyed by "{date}/{run_id}" — holds running asyncio Tasks so we can detect
# in-flight jobs without touching the filesystem.
_active_tasks: dict[str, asyncio.Task[Any]] = {}


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/suites
# ---------------------------------------------------------------------------

@app.get("/api/suites")
async def list_suites() -> dict[str, Any]:
    """List available prompt suite YAML files with their content hash."""
    suites = []
    for yaml_path in sorted(PROMPTS_DIR.glob("*.yaml")):
        suites.append(
            {
                "name": yaml_path.stem,
                "path": str(yaml_path),
                "hash": suite_hash(yaml_path),
            }
        )
    return {"suites": suites}


# ---------------------------------------------------------------------------
# GET /api/config
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def get_config() -> dict[str, Any]:
    """Return available providers and MCP server names from .mcp.json."""
    mcp_servers: list[str] = []
    if MCP_CONFIG_PATH.exists():
        payload = json.loads(MCP_CONFIG_PATH.read_text(encoding="utf-8"))
        mcp_servers = list(payload.get("mcpServers", {}).keys())
    return {
        "providers": ["anthropic", "openai", "openrouter"],
        "mcp_servers": mcp_servers,
    }


# ---------------------------------------------------------------------------
# GET /api/runs
# ---------------------------------------------------------------------------

@app.get("/api/runs")
async def list_runs() -> dict[str, Any]:
    """Return all run metadata, newest first."""
    runs: list[dict[str, Any]] = []
    if RESULTS_DIR.exists():
        for meta_path in sorted(RESULTS_DIR.glob("*/*/meta.json"), reverse=True):
            try:
                runs.append(json.loads(meta_path.read_text(encoding="utf-8")))
            except Exception:
                pass  # skip corrupt files
    return {"runs": runs}


# ---------------------------------------------------------------------------
# GET /api/runs/{date}/{run_id}
# ---------------------------------------------------------------------------

@app.get("/api/runs/{date}/{run_id}")
async def get_run(date: str, run_id: str) -> dict[str, Any]:
    """Return meta + full results array for one run."""
    run_dir = RESULTS_DIR / date / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run not found")
    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    results_path = run_dir / "results.json"
    results: list[Any] = (
        json.loads(results_path.read_text(encoding="utf-8"))
        if results_path.exists()
        else []
    )
    return {"meta": meta, "results": results}


# ---------------------------------------------------------------------------
# GET /api/runs/{date}/{run_id}/export
# ---------------------------------------------------------------------------

@app.get("/api/runs/{date}/{run_id}/export")
async def export_run_markdown(date: str, run_id: str) -> FileResponse:
    """Download the results.md for a run."""
    md_path = RESULTS_DIR / date / run_id / "results.md"
    if not md_path.exists():
        raise HTTPException(status_code=404, detail="Markdown export not found for this run")
    filename = f"{date}-{run_id}.md"
    return FileResponse(md_path, media_type="text/markdown", filename=filename)


# ---------------------------------------------------------------------------
# GET /api/jobs/{date}/{run_id}
# DELETE /api/jobs/{date}/{run_id}
# ---------------------------------------------------------------------------

@app.delete("/api/jobs/{date}/{run_id}", status_code=200)
async def cancel_job(date: str, run_id: str) -> dict[str, Any]:
    """Cancel a running job by cancelling its asyncio task."""
    job_key = f"{date}/{run_id}"
    task = _active_tasks.get(job_key)
    if not task or task.done():
        raise HTTPException(status_code=404, detail="Job not found or already finished")
    task.cancel()
    return {"ok": True}


@app.get("/api/jobs/{date}/{run_id}")
async def get_job_status(date: str, run_id: str) -> dict[str, Any]:
    """Return the current meta.json for a job (progress polling)."""
    run_dir = RESULTS_DIR / date / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# POST /api/runs
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    provider: str
    model: str
    suite: str
    mcp_server: str
    test_id: str | None = None
    temperature: float = 0.0
    max_turns: int = 12
    no_grade: bool = False
    server_tag: str | None = None


# ---------------------------------------------------------------------------
# GET /api/settings
# ---------------------------------------------------------------------------

_CREDENTIAL_TOKENS = ("KEY", "SECRET", "TOKEN", "PASSWORD", "AUTH", "CREDENTIAL", "PASS")


def _is_credential_key(key: str) -> bool:
    upper = key.upper()
    return any(tok in upper for tok in _CREDENTIAL_TOKENS)


@app.get("/api/settings")
async def get_settings() -> dict[str, Any]:
    """Return current .mcp.json contents with credential env values masked."""
    if not MCP_CONFIG_PATH.exists():
        return {"servers": {}}
    payload = json.loads(MCP_CONFIG_PATH.read_text(encoding="utf-8"))
    servers: dict[str, Any] = {}
    for name, cfg in payload.get("mcpServers", {}).items():
        masked_env = {
            k: ("****" if _is_credential_key(k) else v)
            for k, v in (cfg.get("env") or {}).items()
        }
        servers[name] = {**cfg, "env": masked_env}
    return {"servers": servers}


# ---------------------------------------------------------------------------
# PUT /api/settings
# ---------------------------------------------------------------------------

class MCPServerUpdate(BaseModel):
    server_name: str
    transport: str = "stdio"
    command: str | None = None
    args: list[str] = []
    env: dict[str, str] = {}
    url: str | None = None
    headers: dict[str, str] = {}


@app.put("/api/settings")
async def update_settings(update: MCPServerUpdate) -> dict[str, Any]:
    """Write updated MCP server config back to .mcp.json.

    Env values sent as "****" are kept from the existing file.
    """
    payload: dict[str, Any] = {}
    if MCP_CONFIG_PATH.exists():
        payload = json.loads(MCP_CONFIG_PATH.read_text(encoding="utf-8"))

    servers = payload.setdefault("mcpServers", {})
    existing_env: dict[str, str] = (servers.get(update.server_name) or {}).get("env", {})

    new_env = {
        k: (existing_env.get(k, v) if v == "****" else v)
        for k, v in update.env.items()
    }

    server_cfg: dict[str, Any] = {"transport": update.transport}
    if update.transport == "stdio":
        if update.command:
            server_cfg["command"] = update.command
        server_cfg["args"] = update.args
        server_cfg["env"] = new_env
    else:
        if update.url:
            server_cfg["url"] = update.url
        server_cfg["headers"] = update.headers or {}
        server_cfg["env"] = new_env

    servers[update.server_name] = server_cfg
    MCP_CONFIG_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/runs
# ---------------------------------------------------------------------------

@app.post("/api/runs", status_code=202)
async def start_run(req: RunRequest) -> dict[str, Any]:
    """Trigger a new test run in the background. Returns run coordinates immediately."""
    suite_path = PROMPTS_DIR / f"{req.suite}.yaml"
    if not suite_path.exists():
        raise HTTPException(status_code=404, detail=f"Suite not found: {req.suite}")

    if not MCP_CONFIG_PATH.exists():
        raise HTTPException(status_code=400, detail=".mcp.json not found in working directory")

    run_id = f"run-{datetime.now().strftime('%H%M%S')}"
    date_slug = datetime.now().strftime("%Y-%m-%d")
    job_key = f"{date_slug}/{run_id}"

    config = AppConfig(
        provider=req.provider,
        model=req.model,
        suite_path=suite_path,
        program_path=PROGRAM_PATH,
        mcp_config_path=MCP_CONFIG_PATH,
        mcp_server_name=req.mcp_server,
        output_dir=RESULTS_DIR,
        temperature=req.temperature,
        max_turns=req.max_turns,
        no_grade=req.no_grade,
        test_id=req.test_id,
        run_id=run_id,
        server_tag=req.server_tag,
    )

    task = asyncio.create_task(run_suite(config))
    _active_tasks[job_key] = task

    def _cleanup(t: asyncio.Task[Any]) -> None:  # noqa: E306
        _active_tasks.pop(job_key, None)

    task.add_done_callback(_cleanup)

    return {
        "run_id": run_id,
        "date": date_slug,
        "status_url": f"/api/jobs/{date_slug}/{run_id}",
        "result_url": f"/api/runs/{date_slug}/{run_id}",
    }


# ---------------------------------------------------------------------------
# POST /api/suggest-variants
# ---------------------------------------------------------------------------

class SuggestVariantsRequest(BaseModel):
    provider: str
    model: str
    failed_tests: list[dict[str, Any]]  # list of TestResult dicts (failed only)


_VARIANT_SYSTEM = """You are an MCP testing expert specialising in cloud cost query failures.
You will receive a list of failed test cases with their prompts, expected checks, actual responses, grader remarks, and issue classes.
Your job is to generate new test cases in YAML format that stress-test the same failure modes from different angles.

Rules:
- Generate 3-5 new test cases per distinct failure pattern you observe
- Each new test should probe the same weakness but with a different phrasing, time window, or dimension
- Keep prompts realistic — they should sound like real user questions
- expected_check entries should be specific and testable
- Assign a new id using the pattern CLOUD-ADV-001, CLOUD-ADV-002, etc.
- Use the family of the original failing test
- Output only valid YAML. No explanation, no markdown fences, just raw YAML starting with 'tests:'"""


@app.post("/api/suggest-variants")
async def suggest_variants(req: SuggestVariantsRequest) -> dict[str, Any]:
    """Call the LLM to generate adversarial test variant YAML from failed tests."""
    if not req.failed_tests:
        raise HTTPException(status_code=400, detail="No failed tests provided")

    # Build a concise summary of failures for the prompt
    failure_summary = ""
    for t in req.failed_tests:
        failure_summary += f"\n---\nTest ID: {t.get('test_id')}\n"
        failure_summary += f"Family: {t.get('family')}\n"
        failure_summary += f"Prompt: {t.get('prompt')}\n"
        failure_summary += f"Expected: {t.get('expected_check')}\n"
        failure_summary += f"Verdict: {t.get('verdict')}\n"
        failure_summary += f"Issue classes: {t.get('issue_classes')}\n"
        failure_summary += f"Remarks: {t.get('remarks')}\n"

    user_prompt = (
        f"Here are the failed test cases:\n{failure_summary}\n\n"
        "Generate adversarial variant test cases in YAML format that stress-test "
        "the same failure modes from different angles."
    )

    try:
        api_key = get_api_key(req.provider)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        if req.provider in ("openai", "openrouter"):
            from openai import AsyncOpenAI
            kwargs: dict[str, Any] = {"api_key": api_key}
            if req.provider == "openrouter":
                kwargs["base_url"] = "https://openrouter.ai/api/v1"
            client = AsyncOpenAI(**kwargs)
            response = await client.chat.completions.create(
                model=req.model,
                messages=[
                    {"role": "system", "content": _VARIANT_SYSTEM},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
            )
            yaml_output = response.choices[0].message.content or ""
        else:
            from anthropic import AsyncAnthropic
            client_a = AsyncAnthropic(api_key=api_key)
            response_a = await client_a.messages.create(
                model=req.model,
                max_tokens=2000,
                temperature=1,  # Anthropic requires temp=1 for extended thinking; 0.7 not supported on all models
                system=_VARIANT_SYSTEM,
                messages=[{"role": "user", "content": user_prompt}],
            )
            yaml_output = "\n".join(
                getattr(b, "text", "") for b in response_a.content if b.type == "text"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM call failed: {e}")

    return {"yaml": yaml_output.strip()}
