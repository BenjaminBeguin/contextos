# cortex

Operational memory for AI coding agents. This CLI connects a repository to
[Cortex](https://cortex.dev) and exposes an MCP server so Claude Code can
retrieve your team's approved memory before it acts.

## Install

```bash
npm install -g @mxbenjaminbeguin/cortex
```

(The package is published as `@mxbenjaminbeguin/cortex`; the installed command is `cortex`.)

## Usage

```bash
cortex login            # authenticate; stores a token in ~/.cortex
cortex init             # link this repo; writes CLAUDE.md, .mcp.json, hooks
cortex claude install   # (re)generate the Claude Code assets
cortex mcp              # run the MCP stdio server (Claude Code launches this)
```

`init` registers an MCP server in `.mcp.json`:

```json
{
  "mcpServers": {
    "cortex": { "type": "stdio", "command": "cortex", "args": ["mcp"] }
  }
}
```

## MCP tools

- `search_memory(query)` — approved memories for the repo
- `get_repo_context()` — stack, recommended commands, risk warnings
- `record_session_summary(...)` — submit what you did; Cortex proposes new memories

Point at a self-hosted backend with `CORTEX_API_URL`.

MIT licensed.
