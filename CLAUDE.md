# CLAUDE.md — Full Context for Coding Agents

This file gives any coding agent complete context about this project: what it is, how it is built, what principles to follow, and what is planned next.

---

## What this tool is

**mcp-tester** is a structured MCP server testing and UAT tool, not a chatbot or generic LLM evaluator.

The problem it solves: MCP answers can look plausible but be subtly wrong. Real failure modes include:
- **Time-window drift** — user asks for last 7 days, model answers with month-to-date
- **Dimension drift** — user asks for services, model answers with providers
- **Taxonomy pollution** — cloud output mixes K8s or VMware with AWS/Azure/GCP
- **Non-answers** — anonymous ranked rows without names
- **Backend leakage** — GraphQL fields, null groupName, debugging chatter in the response
- **Unsupported inference** — speculation stated as fact
- **Fallback misuse** — exact query fails, model silently answers a different question

The tool runs structured prompt suites through a model+MCP combination, grades responses against expected checks, and saves structured results for review and comparison.

**Current scope:** Cloud cost queries only (cost-overview, service-analysis, location-analysis, resource-analysis, variance-analysis).

---

## Architecture overview

```
mcp-tester/
├── mcp_tester/          # Python backend package
│   ├── api.py           # FastAPI layer (thin wrapper, never rewrite runner logic)
│   ├── runner.py        # Core async test loop
│   ├── llm.py           # LLM providers (Anthropic, OpenAI, OpenRouter)
│   ├── mcp_client.py    # MCP server connection (stdio + streamable_http)
│   ├── grader.py        # LLM-based response grader
│   ├── logger.py        # Run isolation, meta.json, results.json, results.md
│   ├── config.py        # AppConfig dataclass, .mcp.json loader
│   ├── models.py        # TestResult, RunMeta, GradeResult dataclasses
│   ├── prompts.py       # YAML suite loader
│   └── program.py       # Loads program.md sections
├── frontend/            # Vite + React + TypeScript + Tailwind UI
│   └── src/
│       ├── api/         # Typed fetch wrappers (client.ts, types.ts)
│       ├── components/  # Layout, VerdictBadge
│       └── pages/       # RunTests, History, RunDetail, Compare, Settings
├── prompts/             # YAML test suites
├── results/             # Run outputs (gitignored)
│   └── YYYY-MM-DD/
│       └── run-HHMMSS/
│           ├── meta.json     # Run metadata + live progress counts
│           ├── results.json  # Array of TestResult objects
│           └── results.md    # Human-readable log
├── program.md           # LLM instructions: runner_system + grader_system prompts
├── .mcp.json            # MCP server config (gitignored, contains credentials)
├── .env                 # API keys (gitignored)
├── pyproject.toml       # Python deps; api extras: fastapi + uvicorn
└── Makefile             # make install, make dev, make stop, make build
```

---

## Key data models

### TestResult (Python dataclass → JSON)
```python
test_id: str              # e.g. "CLOUD-001"
date: str                 # "YYYY-MM-DD HH:MM:SS"
provider: str             # "anthropic" | "openai" | "openrouter"
model: str                # exact model name
suite: str                # suite name
family: str               # "cost-overview" | "service-analysis" | etc.
prompt: str               # the user prompt sent to the model
expected_check: list[str] # what a correct answer must satisfy
actual_response: str      # what the model actually said
verdict: str              # "Pass" | "Partial Pass" | "Fail" | "Not graded"
remarks: list[str]        # grader's explanation bullets
issue_classes: list[str]  # taxonomy: "time-window drift", "dimension drift", etc.
usage: dict               # token counts
tool_calls: list[dict]    # name, arguments, output for each MCP tool call
```

### RunMeta (meta.json)
```python
run_id: str               # "run-HHMMSS"
date: str                 # "YYYY-MM-DD"
provider, model, suite    # run parameters
suite_path: str           # path to YAML file
suite_hash: str           # "sha256:<16hex>" for reproducibility
mcp_server: str           # server name from .mcp.json
temperature: float        # always 0.0 in UI
max_turns: int            # always 12 in UI
no_grade: bool
test_id_filter: str|null  # null means full suite
server_tag: str|null      # optional label for the server version under test (e.g. "v1.2.0")
started_at: str           # ISO timestamp
finished_at: str|null
status: str               # "running" | "complete" | "failed"
total: int                # total tests in run
completed: int            # tests finished so far (for live polling)
pass_count: int
partial_pass_count: int
fail_count: int
not_graded_count: int
error: str|null           # set if status == "failed"
```

---

## API endpoints (FastAPI, port 8001)

| Method | Path | Purpose |
|---|---|---|
| GET | /api/suites | List YAML suites with hash |
| GET | /api/config | Providers + MCP server names |
| GET | /api/runs | All run metas, newest first |
| GET | /api/runs/{date}/{run_id} | Meta + full results for one run |
| GET | /api/jobs/{date}/{run_id} | Live meta for polling during a run |
| POST | /api/runs | Start a run (returns 202 + job coords) |
| GET | /api/settings | Current .mcp.json with masked credentials |
| PUT | /api/settings | Write updated .mcp.json |
| POST | /api/suggest-variants | Generate adversarial variant YAML from failed tests |

Runs are started with `asyncio.create_task` — no queue, no worker processes. This is intentional for a local single-user tool. Do not add a task queue.

---

## Frontend routes

| Route | Page |
|---|---|
| /run | RunTests — form to configure and launch a run |
| /history | History — table of all runs, select two to compare |
| /runs/:date/:runId | RunDetail — expandable results with verdict stripe |
| /compare?a=date/runId&b=date/runId | Compare — client-side diff by test_id |
| /settings | Settings — MCP server config editor |

Vite proxies `/api/*` to `http://127.0.0.1:8001`.

---

## Design principles — follow these strictly

**Backend:**
- Do not rewrite runner.py, llm.py, or mcp_client.py logic unless fixing a bug
- api.py is a thin wrapper — no business logic lives there
- All run output goes to `results/YYYY-MM-DD/run-HHMMSS/` — never flat files
- meta.json is written before the run starts and updated after every test (enables live polling)
- suite_hash in meta.json ensures reproducibility — never remove it
- The CLI (tester.py) must keep working after any backend change

**Frontend:**
- Source of truth is always results.json — never parse markdown
- No charts or decorative visualisations — tables and detail views only
- Tailwind only — no CSS-in-JS, no additional UI libraries
- Font stack: Syne (headings), IBM Plex Sans (body), IBM Plex Mono (data/IDs)
- Color system: zinc-950 base, zinc-900 cards, cyan-400 accent, emerald/amber/rose for verdicts
- VerdictBadge and verdictStripeColor are the canonical verdict display components
- React Query for all server state — no manual fetch + useState patterns for API data

**General:**
- Do not add Docker, databases, message queues, or auth — this is a local tool
- Do not add error boundaries, loading skeletons, or toast notifications unless asked
- TypeScript must compile with zero errors before any frontend change is considered done
- Keep pyproject.toml deps minimal — add to [project.optional-dependencies].api for FastAPI extras

---

## issue_classes taxonomy

These are the canonical failure class strings used in grading. The grader LLM returns these in the `issue_classes` array:

- `time-window drift`
- `dimension drift`
- `taxonomy pollution`
- `non-answer`
- `backend leakage`
- `unsupported inference`
- `fallback misuse`

These strings are defined in program.md's grader_system prompt. If you add a new class, update program.md.

---

## MCP server configuration

The tool connects to MCP servers via `.mcp.json` at the repo root (gitignored). Two transport modes:

**stdio** — spawns a local process:
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "stdio",
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.example.com/mcp", "--header", "x-api-key: ..."],
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

## Prompt suite format (YAML)

```yaml
suite: cloud-core
scope: cloud
tests:
  - id: CLOUD-001
    family: cost-overview
    prompt: What did GCP cost last month?
    expected_check:
      - should answer for GCP only
      - should use last month correctly
      - should avoid backend or debugging chatter
    notes: optional human note
```

Suites live in `prompts/`. The combined `cloud-core.yaml` includes all five families. Individual family files exist for focused runs.

---

## Extending test suites

**Adding prompts to an existing suite:**
Open the relevant YAML file in `prompts/` and add new test entries. IDs must be unique within the suite. The file is picked up on the next run — no restart needed.

**Adding a new suite:**
Create a new `.yaml` file in `prompts/` with a new `suite` name. It appears in the Suite dropdown immediately with no registration step.

**Expanding to a new domain (beyond cloud cost):**
The grader evaluates responses against `expected_check` items using free-form language — it is not hardcoded to cloud. A new suite for a different domain just needs its own YAML. Two things to update when changing domain:
- `program.md` — the `grader_system` section defines the `issue_classes` taxonomy. Replace or extend the failure class list to match the new domain.
- `api.py` `_VARIANT_SYSTEM` prompt — currently instructs the LLM to generate adversarial variants for cloud cost failures. Update this prompt to be domain-neutral or domain-specific.

**Adversarial variant generation:**
When a run has failures, the **Suggest Variants** button in Run Detail calls `POST /api/suggest-variants` with the failed test cases. The LLM generates new test prompts that probe the same failure modes from different angles — same failure pattern, different phrasing, time window, or provider. For example, if the server failed on "What did GCP cost last month?", variants might test "What was the AWS bill for the previous month?" to determine whether the failure is consistent or situational.

The returned YAML is ready to paste into a new file in `prompts/`. Add `suite:` and `scope:` at the top, then paste the `tests:` block.

**Always review suggestions before adding them to your suite.** The LLM occasionally generates prompts that don't make sense for a text-based tool (e.g. "show me a graph") or expected checks that are too vague to grade reliably. Treat the output as a starting point, not a final test set.

**Recommended process when expanding:**
1. Run the existing suite to get a baseline
2. Write new YAML prompts and expected checks
3. Run a focused subset first (use `--test-id` via CLI) to verify the grader interprets them correctly
4. Use **Suggest Variants** on any failures to generate edge cases
5. Review the suggested YAML carefully, copy the useful ones into your suite, re-run

---

## How to start the app

```bash
# First time setup
cp .env.example .env          # fill in your API key
cp .mcp.json.example .mcp.json  # fill in your MCP server config
make install                   # pip install + npm install

# Start both servers
make dev
# API: http://127.0.0.1:8001
# UI:  http://localhost:5173
```
