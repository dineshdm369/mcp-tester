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
