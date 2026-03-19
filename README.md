# mcp-tester

A structured MCP server testing and UAT tool with a web UI. Run prompt suites against any MCP server, grade responses with an LLM, and compare results across models and versions.

Built for cloud cost query testing but works with any MCP server.

---

## What it does

MCP answers can look correct but be subtly wrong — wrong time window, wrong dimension, wrong data scope. This tool catches that by running structured prompt suites through a model+MCP combination, grading each response against expected checks, and giving you a clear history of what passed, what failed, and why.

**Failure classes it detects:**
- Time-window drift (asked for last 7 days, got month-to-date)
- Dimension drift (asked for services, got providers)
- Taxonomy pollution (cloud results mixed with non-cloud)
- Non-answers (anonymous rows without names)
- Backend leakage (GraphQL fields, debug output in the response)
- Unsupported inference (speculation stated as fact)
- Fallback misuse (silently answered a different question)

---

## Requirements

- Python 3.11+
- Node.js 18+
- An API key for at least one provider (Anthropic, OpenAI, or OpenRouter)
- An MCP server to test

---

## Setup

**1. Clone and install**

```bash
git clone <repo-url>
cd mcp-tester
make install
```

This installs Python dependencies (including FastAPI) and the frontend npm packages.

**2. Configure your API key**

```bash
cp .env.example .env
```

Edit `.env` and set your key. OpenRouter is recommended — one key covers all models:

```
OPENROUTER_API_KEY=your-key-here
```

**3. Configure your MCP server**

```bash
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json` with your server details. Two formats are supported:

**Local process via stdio** (most common — also works with `mcp-remote` for remote servers):
```json
{
  "mcpServers": {
    "my-server": {
      "transport": "stdio",
      "command": "npx",
      "args": ["mcp-remote", "https://your-mcp-server.com/mcp",
               "--header", "x-api-key: your-key",
               "--header", "tenant: your-tenant-id"]
    }
  }
}
```

**Direct HTTP connection:**
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

You can also configure the MCP server from the **Settings** tab in the UI after starting the app.

---

## Running the app

```bash
make dev
```

This starts both servers:
- **UI:** http://localhost:5173
- **API:** http://127.0.0.1:8001

---

## Using the UI

**Run Tests**
Select a provider, model, and prompt suite. Choose your MCP server from the dropdown. Optionally add a **Server Tag** (e.g. `v1.2.0`, `post-fix`) to label which version of your server you're testing — it appears in History and Compare so you can track improvement across releases. Click Start Run. A live progress bar shows how many tests have completed. When done, click through to the results.

Recommended models for reliable tool-use behaviour:
- `anthropic/claude-sonnet-4-5` (best results, via OpenRouter)
- `anthropic/claude-haiku-4-5` (faster and cheaper)
- `openai/gpt-4o`

Avoid models without strong agentic/tool-use training — they will loop on tool calls and time out.

**History**
Browse all past runs. Each row shows the date, model, suite, server tag, and a pass/fail ratio bar. Click any row to open the full results. Select two runs with the checkboxes to compare them.

**Run Detail**
Every test result is shown with its prompt, expected checks, actual response, verdict, grader remarks, and issue classes. Filter by verdict. Expand any row to see the full response and tool call trace.

The header shows an **issue class frequency summary** — e.g. `dimension drift ×3  time-window drift ×1` — so the dominant failure pattern is visible at a glance without reading every row.

When a run has failures, a **Suggest Variants** button appears. Click it to call the LLM and generate new adversarial test cases in YAML that probe the same failure modes from different angles — same failure pattern, different phrasing, time window, or provider. For example, if the server failed on "What did GCP cost last month?", variants might test "What was the AWS bill for the previous month?" or "What was our total cloud cost for the month before last?" to determine whether the failure is consistent or situational.

The output is ready to paste into a new file in `prompts/` (e.g. `prompts/cloud-adversarial.yaml`). Add `suite: cloud-adversarial` and `scope: cloud` at the top, then paste the `tests:` block. It will appear in the Suite dropdown immediately.

**Always review suggestions before adding them to your suite.** The LLM occasionally generates prompts that don't make sense for a text-based tool (e.g. "show me a graph") or checks that are too vague to grade reliably. Treat the output as a starting point, not a final test set.

**Compare**
Side-by-side comparison of two runs aligned by test ID. Regressions are highlighted in red with the issue class that caused the failure shown inline. Improvements in green. Expand any row to read both responses side by side.

**Settings**
Edit the MCP server configuration. Changes are written back to `.mcp.json`. Credential-looking values are masked in the display.

---

## Prompt suites

Suites live in `prompts/`. The available cloud suites are:

| Suite | What it tests |
|---|---|
| `cloud-core` | All five families in one run (10 tests) |
| `service-analysis` | Service-level cost queries |
| `location-analysis` | Region and location cost queries |
| `resource-analysis` | Resource type and instance type queries |
| `variance-analysis` | Month-over-month cost change queries |

Each test case has a `prompt` and an `expected_check` list. The grader LLM evaluates the actual response against those checks and returns a verdict (`Pass`, `Partial Pass`, `Fail`) with remarks and issue class labels.

**Adding prompts to an existing suite:** Open the relevant YAML in `prompts/` and add new test entries. IDs must be unique within the suite. No restart needed — the file is picked up on the next run.

**Adding a new suite:** Create a new `.yaml` file in `prompts/`. It appears in the Suite dropdown immediately.

**Expanding to a new domain:** The grader is not hardcoded to cloud — it evaluates any `expected_check` in plain language. To test a different kind of MCP server, write a new suite with domain-appropriate prompts and checks. Also update:
- `program.md` — the `grader_system` section defines the failure class taxonomy. Replace or extend the `issue_classes` list for your domain.
- The `_VARIANT_SYSTEM` prompt in `mcp_tester/api.py` — tells the LLM how to generate adversarial variants. Update it to match your domain.

**Recommended process when expanding:**
1. Run the existing suite to get a baseline
2. Write new YAML prompts and expected checks
3. Run a focused subset first (`--test-id` via CLI) to verify the grader interprets them correctly
4. Use **Suggest Variants** on any failures to generate edge cases
5. Review, copy the useful ones into your suite, re-run

---

## CLI usage

The original CLI still works if you prefer it:

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

Results are saved to `results/YYYY-MM-DD/run-HHMMSS/` as both JSON and Markdown.

---

## Result structure

Each run produces a folder with three files:

```
results/
  2026-03-18/
    run-201029/
      meta.json      # run metadata, progress counts, suite hash
      results.json   # array of TestResult objects (source of truth for UI)
      results.md     # human-readable log
```

`results/` is gitignored. Keep your results directory — it is the historical record of your MCP server's behaviour over time.

---

## Stopping the servers

```bash
make stop
```

---

## Project structure

```
mcp_tester/     Python backend package
prompts/        YAML prompt suites
frontend/       Vite + React + TypeScript UI
program.md      LLM instructions for runner and grader
results/        Run outputs (gitignored)
.mcp.json       MCP server config (gitignored)
.env            API keys (gitignored)
```

For full technical context including architecture, data models, and API reference, see [CLAUDE.md](./CLAUDE.md).
