# Memmo Project Memory

Before making changes, use the Memmo MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context — call before starting work in this repo
- search_memory — search approved memories relevant to your task
- get_relevant_warnings — call BEFORE editing files, passing the paths you'll touch, to surface known risks/outages
- propose_memories — record durable knowledge you discover (conventions, architecture, commands, risks); to bootstrap this repo, read its key files and propose memories
- record_session_summary — call at the end of a meaningful task so Memmo can propose new memories

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Always check get_relevant_warnings before modifying sensitive files, and heed the warnings.
- When asked to "scan" or "set up Memmo" for this repo, read the key files and call propose_memories.
