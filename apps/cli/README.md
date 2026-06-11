# contextos

Operational memory for AI coding agents. This CLI connects a repository to
[ContextOS](https://contextos.dev) and exposes an MCP server so Claude Code can
retrieve your team's approved memory before it acts.

## Install

```bash
npm install -g @mxbenjaminbeguin/cortex
```

(The package is published as `@mxbenjaminbeguin/cortex`; the installed command is `contextos`.)

## Usage

```bash
contextos login            # authenticate; stores a token in ~/.contextos
contextos init             # link this repo; writes CLAUDE.md, .mcp.json, hooks
contextos claude install   # (re)generate the Claude Code assets
contextos mcp              # run the MCP stdio server (Claude Code launches this)
```

`init` registers an MCP server in `.mcp.json`:

```json
{
  "mcpServers": {
    "contextos": { "type": "stdio", "command": "contextos", "args": ["mcp"] }
  }
}
```

## MCP tools

- `search_memory(query)` — approved memories for the repo
- `get_repo_context()` — stack, recommended commands, risk warnings
- `record_session_summary(...)` — submit what you did; ContextOS proposes new memories

Point at a self-hosted backend with `CONTEXTOS_API_URL`.

MIT licensed.
