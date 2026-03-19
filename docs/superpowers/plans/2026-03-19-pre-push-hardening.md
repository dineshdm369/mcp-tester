# Pre-Push Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the mcp-tester repo to a state where it can be safely pushed to GitHub with correct documentation, locked dependencies, restricted CORS, a health endpoint, linting config, CI, and security/contribution docs.

**Architecture:** All changes are additive or minimal edits — no logic rewrites. Backend gets CORS fix + health endpoint + linting config. Frontend gets a verified and committed lock file. Repo gets CI workflow, SECURITY.md, and CONTRIBUTING.md. README and CLAUDE.md are rewritten for clarity.

**Tech Stack:** Python 3.11, FastAPI, Ruff, Mypy, TypeScript, Vite, GitHub Actions, npm

**GitHub remote:** `https://github.com/dineshdm369/mcp-tester` — confirmed by the user. All URLs use this remote.

**Task ordering constraint:** Task 3 (commit lock file) MUST be completed before Task 6 (CI workflow) is committed. The CI workflow runs `npm ci`, which requires `package-lock.json` to be present and committed.

---

## File Map

| Action | File |
|--------|------|
| Modify | `mcp_tester/api.py` — CORS + /health |
| Modify | `pyproject.toml` — ruff + mypy config |
| Verify + commit | `frontend/package-lock.json` |
| Create | `SECURITY.md` |
| Create | `CONTRIBUTING.md` |
| Create | `.github/workflows/ci.yml` |
| Rewrite | `README.md` |
| Rewrite | `CLAUDE.md` |

---

### Task 1: Fix CORS and add /health endpoint

**Files:**
- Modify: `mcp_tester/api.py`

- [ ] **Step 1: Replace wildcard CORS with localhost-only origins**

In `mcp_tester/api.py`, replace the exact block:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

with:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
```

- [ ] **Step 2: Add /health endpoint**

After the `_active_tasks` dict declaration (line 38), add the health route. Keep module-level state grouped together — place the route after `_active_tasks`, not between the middleware and the dict.

Add after the `_active_tasks` line:

```python

@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness check."""
    return {"status": "ok"}
```

- [ ] **Step 3: Verify the API still imports**

```bash
cd /Users/dpavo/Desktop/Agents/mcp-tester
python -c "from mcp_tester.api import app; print('import ok')"
```

Expected: `import ok`

- [ ] **Step 4: Commit**

```bash
git add mcp_tester/api.py
git commit -m "fix: restrict CORS to localhost and add /health endpoint"
```

---

### Task 2: Add linting configuration to pyproject.toml

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add ruff and mypy config sections**

Append to the end of `pyproject.toml` (after the `[build-system]` block):

```toml
[project.urls]
Repository = "https://github.com/dineshdm369/mcp-tester"
Issues = "https://github.com/dineshdm369/mcp-tester/issues"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I"]

[tool.mypy]
python_version = "3.11"
ignore_missing_imports = true
```

- [ ] **Step 2: Verify ruff can read the config and lint the package**

```bash
cd /Users/dpavo/Desktop/Agents/mcp-tester
pip show ruff > /dev/null 2>&1 || pip install ruff
ruff check mcp_tester/
```

Expected: zero errors (or only import-order warnings that are auto-fixable — not config parse errors).

- [ ] **Step 3: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add ruff and mypy config, project URLs"
```

---

### Task 3: Verify and commit frontend lock file

**Files:**
- Verify + commit: `frontend/package-lock.json`

Note: `package-lock.json` may already exist in the directory. This task ensures it is current and committed. This task MUST be committed before Task 6 (CI workflow), since `npm ci` in CI requires the lock file.

- [ ] **Step 1: Run npm install to ensure lock file is up to date**

```bash
cd /Users/dpavo/Desktop/Agents/mcp-tester/frontend
npm install
```

Expected: no errors. `package-lock.json` created or updated.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/dpavo/Desktop/Agents/mcp-tester/frontend
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Check if the lock file needs to be committed**

```bash
cd /Users/dpavo/Desktop/Agents/mcp-tester
git status frontend/package-lock.json
```

If the file appears as untracked or modified, continue to Step 4. If it shows "nothing to commit", the file is already tracked and current — skip Step 4.

- [ ] **Step 4: Commit the lock file**

```bash
git add frontend/package-lock.json
git commit -m "chore: commit frontend package-lock.json for reproducible installs"
```

---

### Task 4: Create SECURITY.md

**Files:**
- Create: `SECURITY.md`

- [ ] **Step 1: Write SECURITY.md**

```markdown
# Security Policy

## Reporting a vulnerability

If you find a security issue in this project, please do not open a public GitHub issue.

Email the maintainer directly or open a [GitHub Security Advisory](https://github.com/dineshdm369/mcp-tester/security/advisories/new).

Include:
- A description of the issue and its potential impact
- Steps to reproduce or a minimal proof of concept
- Any suggested fix, if you have one

You can expect an acknowledgement within 48 hours and a fix or mitigation plan within 7 days for confirmed issues.

## Scope

This tool is designed to run locally on a developer's machine. It is not hardened for internet-facing or multi-user deployment. The following are known limitations by design:

- The API binds to `127.0.0.1:8001` and is not intended to be exposed publicly.
- `.mcp.json` and `.env` contain credentials and are gitignored. Do not commit them.
- `results/` may contain sensitive data from MCP server responses and is gitignored.
- CORS is restricted to `localhost:5173`. Do not change this if deploying in any shared context.

## Supported versions

Only the latest version on the `main` branch is supported.
```

- [ ] **Step 2: Commit**

```bash
git add SECURITY.md
git commit -m "docs: add SECURITY.md with disclosure instructions and scope notes"
```

---

### Task 5: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write CONTRIBUTING.md**

```markdown
# Contributing

## Getting started

```bash
git clone https://github.com/dineshdm369/mcp-tester.git
cd mcp-tester
cp .env.example .env            # add your API key
cp .mcp.json.example .mcp.json  # add your MCP server config
make install                    # installs Python deps and frontend npm packages
make dev                        # starts API on :8001 and UI on :5173
```

## Making changes

**Backend (`mcp_tester/`):**
- `api.py` is a thin HTTP wrapper. Keep business logic out of it.
- `runner.py`, `llm.py`, and `mcp_client.py` should not be rewritten unless fixing a confirmed bug.
- All run output goes to `results/YYYY-MM-DD/run-HHMMSS/`. Do not write flat files.
- The CLI (`tester.py`) must keep working after any backend change.

**Frontend (`frontend/`):**
- TypeScript must compile with zero errors: `cd frontend && npx tsc --noEmit`
- Use Tailwind only — no CSS-in-JS or additional UI libraries.
- Use React Query for all server state. No manual `fetch + useState` for API data.
- `results.json` is the source of truth. Never parse `results.md`.

**Prompt suites (`prompts/`):**
- Test IDs must be unique within a suite.
- `expected_check` entries should be specific enough for an LLM to evaluate unambiguously.

## Before submitting a pull request

1. Run `ruff check mcp_tester/` — fix any reported issues.
2. Run `cd frontend && npx tsc --noEmit` — must produce zero errors.
3. Run `npm audit` in `frontend/` — no high or critical vulnerabilities.
4. Do not commit `.env`, `.mcp.json`, or anything in `results/`.
5. Keep commits focused. One logical change per commit.

## Adding a new prompt suite

1. Create a `.yaml` file in `prompts/` following the existing format.
2. Test it with a focused run via CLI: `python tester.py --suite <name> --test-id <id> ...`
3. Verify the grader interprets the `expected_check` entries correctly before committing.

## Design decisions

See [CLAUDE.md](./CLAUDE.md) for the full rationale behind architectural decisions (no task queue, no database, no auth, etc.).
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md with setup, change rules, and PR checklist"
```

---

### Task 6: Add GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Prerequisite:** Task 3 must be committed first. `npm ci` in this workflow requires `package-lock.json` to be present in the repo.

- [ ] **Step 1: Create workflow directory**

```bash
mkdir -p /Users/dpavo/Desktop/Agents/mcp-tester/.github/workflows
```

- [ ] **Step 2: Write ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  python:
    name: Python lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install ruff
        run: pip install ruff

      - name: Ruff lint
        run: ruff check mcp_tester/

  frontend:
    name: Frontend type check and audit
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type check
        run: npx tsc --noEmit

      - name: npm audit
        run: npm audit --audit-level=high
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for Python lint and frontend type check"
```

---

### Task 7: Rewrite README.md

**Files:**
- Rewrite: `README.md`

All factual content from the original is preserved, including the live progress bar detail and the multi-header stdio example.

- [ ] **Step 1: Write new README.md**

```markdown
# mcp-tester

A tool for running structured test suites against MCP servers, grading responses, and comparing results across runs.

Built for cloud cost query testing. Works with any MCP server.

---

## The problem it solves

MCP responses can look correct but be subtly wrong — wrong time window, wrong dimension, wrong scope. This tool runs a set of prompt-and-check pairs through a model and MCP server, grades each response against explicit criteria, and records the results for review.

**Failure types it detects:**

| Class | Example |
|---|---|
| Time-window drift | Asked for last 7 days, got month-to-date |
| Dimension drift | Asked for services, got providers |
| Taxonomy pollution | Cloud results mixed with non-cloud entries |
| Non-answer | Ranked rows without names |
| Backend leakage | GraphQL field names or null values in the response |
| Unsupported inference | Speculation stated as fact |
| Fallback misuse | Query failed silently; different question answered instead |

---

## Requirements

- Python 3.11+
- Node.js 18+
- API key for Anthropic, OpenAI, or OpenRouter
- An MCP server to test

---

## Setup

**1. Install**

```bash
git clone https://github.com/dineshdm369/mcp-tester.git
cd mcp-tester
make install
```

**2. Set your API key**

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENROUTER_API_KEY=your-key-here
```

OpenRouter is the most flexible option — one key covers Anthropic and OpenAI models.

**3. Configure your MCP server**

```bash
cp .mcp.json.example .mcp.json
```

Two connection modes are supported:

**stdio** (runs a local command, also works with `mcp-remote` for remote servers):
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "stdio",
      "command": "npx",
      "args": [
        "mcp-remote", "https://your-server.com/mcp",
        "--header", "x-api-key: your-key",
        "--header", "tenant: your-tenant-id"
      ]
    }
  }
}
```

**streamable_http** (direct HTTP connection):
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "streamable_http",
      "url": "http://localhost:9000/mcp",
      "headers": { "x-api-key": "your-key" }
    }
  }
}
```

You can also edit this from the **Settings** tab in the UI.

---

## Running

```bash
make dev
```

- UI: http://localhost:5173
- API: http://127.0.0.1:8001

```bash
make stop   # stop both servers
```

---

## Using the UI

**Run Tests**
Pick a provider, model, suite, and MCP server. Add a **Server Tag** (e.g. `v1.2.0`) to label which version of your server you are testing — it shows up in History and Compare so you can track changes across runs. Click Start Run. A live progress bar shows how many tests have completed. When done, click through to the results.

Recommended models (reliable tool use):
- `anthropic/claude-sonnet-4-5` via OpenRouter
- `anthropic/claude-haiku-4-5` (faster, lower cost)
- `openai/gpt-4o`

Avoid models without strong tool-use support — they tend to loop on calls and time out.

**History**
All past runs in a table. Each row shows date, model, suite, server tag, and a pass/fail bar. Select two runs with the checkboxes to compare them.

**Run Detail**
Each result shows the prompt, expected checks, actual response, verdict, grader notes, and issue classes. Filter by verdict. Expand a row to see the full response and tool call trace.

The header shows a frequency summary of issue classes (e.g. `dimension drift ×3  time-window drift ×1`) so you can see the dominant problem without reading every row.

When a run has failures, a **Suggest Variants** button appears. It calls the LLM to generate new test cases in YAML that probe the same failure types from different angles — different phrasing, time window, or provider. Review the output before adding it to your suite; treat it as a starting point, not a final test set.

**Compare**
Side-by-side view of two runs aligned by test ID. Regressions are highlighted in red, improvements in green. Expand a row to read both responses.

**Settings**
Edit the MCP server configuration. Writes back to `.mcp.json`. Credential-looking field values are masked in the display.

---

## Prompt suites

Suites live in `prompts/`. The included cloud suites:

| Suite | Coverage |
|---|---|
| `cloud-core` | All five families (10 tests) |
| `service-analysis` | Service-level cost queries |
| `location-analysis` | Region and location queries |
| `resource-analysis` | Resource type queries |
| `variance-analysis` | Month-over-month cost change queries |

**Adding tests to an existing suite:** Edit the YAML in `prompts/` and add entries. IDs must be unique. No restart needed.

**Adding a new suite:** Create a new `.yaml` file in `prompts/`. It appears in the Suite dropdown immediately.

**Testing a different domain:** The grader is not tied to cloud cost. Write a new suite with domain-specific prompts and checks. Also update:
- `program.md` — the `grader_system` section defines the failure class list.
- `_VARIANT_SYSTEM` in `mcp_tester/api.py` — controls how variants are generated.

---

## CLI usage

```bash
python tester.py \
  --suite cloud-core \
  --provider openrouter \
  --model anthropic/claude-sonnet-4-5 \
  --mcp-config .mcp.json \
  --mcp-server my-server
```

Run a single test:
```bash
python tester.py --suite cloud-core --test-id CLOUD-001 \
  --provider anthropic --model claude-sonnet-4-5-20250514 \
  --mcp-config .mcp.json --mcp-server my-server
```

---

## Result files

Each run writes three files:

```
results/
  2026-03-18/
    run-201029/
      meta.json      # run parameters, progress counts, suite hash
      results.json   # all test results (source of truth for the UI)
      results.md     # human-readable log
```

`results/` is gitignored. Keep it — it is the record of your server's behaviour across runs.

---

## Project layout

```
mcp_tester/     Python backend
prompts/        YAML test suites
frontend/       React + TypeScript UI
program.md      LLM system prompts for runner and grader
results/        Run outputs (gitignored)
.mcp.json       MCP server config (gitignored)
.env            API keys (gitignored)
```

For architecture details, data models, and API reference, see [CLAUDE.md](./CLAUDE.md).

---

## Security

See [SECURITY.md](./SECURITY.md) for the vulnerability disclosure process and known scope limitations.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for clarity — preserve all content, remove vague phrasing"
```

---

### Task 8: Rewrite CLAUDE.md

**Files:**
- Rewrite: `CLAUDE.md`

Same information as the original, cleaner language, no buzzwords. This rewrite also adds two previously-undocumented endpoints to the API table (`DELETE /api/jobs/{date}/{run_id}` and `GET /api/runs/{date}/{run_id}/export`) — both exist in `api.py` and were missing from the original CLAUDE.md.

- [ ] **Step 1: Write new CLAUDE.md**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite CLAUDE.md — cleaner language, add missing API endpoints to table"
```

---

## Final verification

- [ ] Run `ruff check mcp_tester/` — zero errors
- [ ] Run `cd frontend && npx tsc --noEmit` — zero errors
- [ ] Run `python -c "from mcp_tester.api import app"` — no import errors
- [ ] Confirm `.env` and `.mcp.json` are not staged: `git status` should not list them
- [ ] Confirm `results/` is not staged
