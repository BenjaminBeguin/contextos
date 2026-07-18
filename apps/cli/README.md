# memmo

Operational memory for AI coding agents. This CLI connects a repository to
[Memmo](https://memmo.dev) and exposes an MCP server so Claude Code can
retrieve your team's approved memory before it acts.

## Install

```bash
npm install -g memmo
```

(The package is published as `memmo`; the installed command is `memmo`.)

## Usage

```bash
memmo login            # authenticate; stores a token in ~/.memmo
memmo init             # link this repo; writes CLAUDE.md, .mcp.json, hooks
memmo claude install   # (re)generate the Claude Code assets
memmo mcp              # run the MCP stdio server (Claude Code launches this)
```

`init` registers an MCP server in `.mcp.json`:

```json
{
  "mcpServers": {
    "memmo": { "type": "stdio", "command": "memmo", "args": ["mcp"] }
  }
}
```

## MCP tools

- `search_memory(query)` — approved memories for the repo
- `get_repo_context()` — stack, recommended commands, risk warnings
- `record_session_summary(...)` — submit what you did; Memmo proposes new memories

Point at a self-hosted backend with `MEMMO_API_URL`.

MIT licensed.
