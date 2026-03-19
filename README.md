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
