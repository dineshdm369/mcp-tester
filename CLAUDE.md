# CLAUDE.md

Full context for coding agents working on this project.

---

## What this tool does

**mcp-tester** runs structured test suites against MCP servers, grades responses, and stores results for review and comparison. It is not a chatbot or a general-purpose LLM evaluator.

The problem it solves: MCP responses can look correct but fail in subtle ways. This tool catches those failures by running prompts with explicit expected checks, grading each response against those checks, and labelling the failure type.

**Failure types:**
- **Time-window drift** — asked for last 7 days, answered with month-to-date
- **Dimension drift** — asked for services, answered with providers
- **Taxonomy pollution** — cloud output mixed with non-cloud entries (K8s, VMware)
- **Non-answer** — ranked rows returned without names
- **Backend leakage** — internal field names, null values, or debug output visible in response
- **Unsupported inference** — speculation presented as fact
- **Fallback misuse** — exact query failed; a different question was answered silently

**Current scope:** Cloud cost queries (cost-overview, service-analysis, location-analysis, resource-analysis, variance-analysis).

---

## Repository layout

```
mcp-tester/
├── mcp_tester/          # Python backend package
│   ├── api.py           # FastAPI routes (thin wrapper — no business logic here)
│   ├── runner.py        # Core test loop
│   ├── llm.py           # LLM provider clients (Anthropic, OpenAI, OpenRouter)
│   ├── mcp_client.py    # MCP server connection (stdio + streamable_http)
│   ├── grader.py        # Grades responses via LLM
│   ├── logger.py        # Writes run output files (meta.json, results.json, results.md)
│   ├── config.py        # AppConfig dataclass and .mcp.json loader
│   ├── models.py        # TestResult, RunMeta, GradeResult dataclasses
│   ├── prompts.py       # Loads YAML test suites
│   └── program.py       # Loads named sections from program.md
├── frontend/            # Vite + React + TypeScript + Tailwind
│   └── src/
│       ├── api/         # Typed fetch wrappers (client.ts, types.ts)
│       ├── components/  # Layout, VerdictBadge
│       └── pages/       # RunTests, History, RunDetail, Compare, Settings
├── prompts/             # YAML test suites
├── results/             # Run output (gitignored)
│   └── YYYY-MM-DD/
│       └── run-HHMMSS/
│           ├── meta.json
│           ├── results.json
│           └── results.md
├── program.md           # System prompts for runner and grader
├── .mcp.json            # MCP server config (gitignored — contains credentials)
├── .env                 # API keys (gitignored)
├── pyproject.toml       # Python package config
└── Makefile             # make install / dev / stop / build
```

---

## Data models

### TestResult (Python dataclass → JSON)
```python
test_id: str              # e.g. "CLOUD-001"
date: str                 # "YYYY-MM-DD HH:MM:SS"
provider: str             # "anthropic" | "openai" | "openrouter"
model: str                # exact model identifier
suite: str                # suite name
family: str               # "cost-overview" | "service-analysis" | etc.
prompt: str               # the prompt sent to the model
expected_check: list[str] # what a correct answer must satisfy
actual_response: str      # what the model returned
verdict: str              # "Pass" | "Partial Pass" | "Fail" | "Not graded"
remarks: list[str]        # grader explanation
issue_classes: list[str]  # failure labels (see taxonomy below)
usage: dict               # token counts
tool_calls: list[dict]    # each MCP tool call: name, arguments, output
```

### RunMeta (meta.json)
```python
run_id: str               # "run-HHMMSS"
date: str                 # "YYYY-MM-DD"
provider, model, suite    # run parameters
suite_path: str           # path to the YAML file used
suite_hash: str           # "sha256:<16hex>" — identifies the exact suite version
mcp_server: str           # server name from .mcp.json
temperature: float        # fixed at 0.0 in the UI
max_turns: int            # fixed at 12 in the UI
no_grade: bool
test_id_filter: str|null  # null = full suite
server_tag: str|null      # optional label for the server version under test
started_at: str           # ISO timestamp
finished_at: str|null
status: str               # "running" | "complete" | "failed"
total: int
completed: int            # increments after each test (for live polling)
pass_count: int
partial_pass_count: int
fail_count: int
not_graded_count: int
error: str|null
```

---

## API endpoints (FastAPI, port 8001)

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Liveness check |
| GET | /api/suites | List YAML suites with hash |
| GET | /api/config | Available providers and MCP server names |
| GET | /api/runs | All run metadata, newest first |
| GET | /api/runs/{date}/{run_id} | Metadata + full results for one run |
| GET | /api/runs/{date}/{run_id}/export | Download results.md for a run |
| GET | /api/jobs/{date}/{run_id} | Live metadata for polling during a run |
| DELETE | /api/jobs/{date}/{run_id} | Cancel a running job |
| POST | /api/runs | Start a run (returns 202 + job coordinates) |
| GET | /api/settings | Current .mcp.json with credentials masked |
| PUT | /api/settings | Write updated .mcp.json |
| POST | /api/suggest-variants | Generate adversarial variant YAML from failed tests |

Runs execute via `asyncio.create_task`. There is no queue and no worker process. This is intentional — it is a single-user local tool. Do not add a task queue.

---

## Frontend routes

| Route | Page |
|---|---|
| /run | RunTests — configure and start a run |
| /history | History — all runs, select two to compare |
| /runs/:date/:runId | RunDetail — expandable results with verdict stripe |
| /compare?a=date/runId&b=date/runId | Compare — diff two runs by test_id |
| /settings | Settings — MCP server config editor |

Vite proxies `/api/*` to `http://127.0.0.1:8001`.

---

## Rules — follow these exactly

**Backend:**
- `api.py` is a thin HTTP wrapper. No business logic belongs there.
- Do not rewrite `runner.py`, `llm.py`, or `mcp_client.py` unless fixing a confirmed bug.
- All run output goes to `results/YYYY-MM-DD/run-HHMMSS/`. Never write flat files.
- `meta.json` is written before the run starts and updated after every test. This enables live progress polling. Do not change this pattern.
- `suite_hash` in `meta.json` identifies the exact suite version used. Never remove it.
- The CLI (`tester.py`) must continue to work after any backend change.

**Frontend:**
- `results.json` is the source of truth. Never parse `results.md`.
- No charts or decorative visuals — tables and detail views only.
- Tailwind only. No CSS-in-JS. No additional UI libraries.
- Font stack: Syne (headings), IBM Plex Sans (body), IBM Plex Mono (data/IDs).
- Color system: zinc-950 base, zinc-900 cards, cyan-400 accent, emerald/amber/rose for verdicts.
- `VerdictBadge` and `verdictStripeColor` are the canonical verdict display components.
- Use React Query for all server state. No manual `fetch + useState` for API data.

**General:**
- Do not add Docker, databases, message queues, or authentication. This is a local single-user tool.
- Do not add error boundaries, loading skeletons, or toast notifications unless asked.
- TypeScript must compile with zero errors before any frontend change is considered complete.
- Keep `pyproject.toml` dependencies minimal. FastAPI extras go in `[project.optional-dependencies].api`.

---

## Failure class taxonomy

These are the exact strings the grader returns in `issue_classes`. Defined in `program.md`'s `grader_system` section. Add new classes there if needed.

- `time-window drift`
- `dimension drift`
- `taxonomy pollution`
- `non-answer`
- `backend leakage`
- `unsupported inference`
- `fallback misuse`

---

## MCP server configuration

Two transport modes in `.mcp.json`:

**stdio** — spawns a local process:
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "stdio",
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.example.com/mcp", "--header", "x-api-key: ...", "--header", "tenant: ..."],
      "env": {}
    }
  }
}
```

**streamable_http** — connects directly to an HTTP endpoint:
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "streamable_http",
      "url": "http://localhost:9000/mcp",
      "headers": { "x-api-key": "..." }
    }
  }
}
```

---

## Prompt suite format

```yaml
suite: cloud-core
scope: cloud
tests:
  - id: CLOUD-001
    family: cost-overview
    prompt: What did GCP cost last month?
    expected_check:
      - should answer for GCP only
      - should use last month as the time window
      - should not include backend or debugging output
    notes: optional human note
```

---

## Extending test suites

**Add prompts to an existing suite:** Edit the YAML in `prompts/`. IDs must be unique within the suite. No restart needed.

**Add a new suite:** Create a new `.yaml` in `prompts/`. It appears in the Suite dropdown immediately.

**Test a different domain:** The grader evaluates `expected_check` entries in plain language — it is not tied to cloud cost. For a new domain:
- Update `program.md` (`grader_system` section) to define failure classes for that domain.
- Update `_VARIANT_SYSTEM` in `api.py` to generate domain-appropriate variants.

**Adversarial variant generation:**
The **Suggest Variants** button in Run Detail sends failed tests to the LLM, which returns new YAML prompts that probe the same failure types from different angles. Review all suggestions before adding them — the LLM occasionally generates prompts that don't apply to a text-based tool (e.g. "show me a graph") or checks that are too vague to grade reliably.

**Workflow when expanding:**
1. Run the existing suite to get a baseline.
2. Write new YAML prompts and checks.
3. Run a focused subset first with `--test-id` to verify the grader interprets them correctly.
4. Use Suggest Variants on any failures to generate edge cases.
5. Review carefully, add the useful ones, re-run.

---

## Starting the app

```bash
cp .env.example .env            # add your API key
cp .mcp.json.example .mcp.json  # add your MCP server config
make install                    # pip install + npm install
make dev                        # API: :8001  UI: :5173
```
