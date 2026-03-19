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
