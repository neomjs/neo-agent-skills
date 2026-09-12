---
id: memory_core_protocol
order: 700
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §memory_core_protocol
A single **turn** encompasses receiving a `PROMPT` to delivering the final `RESPONSE`.
**The "Consolidate-Then-Save" Protocol:** You MUST consolidate the entire interaction into a single memory at the very end.
**Pre-Flight Check Triggers:** Before calling any file-modifying tool (`replace`, `write_file`, `run_shell_command`), state:
> *"Pre-Flight Check: Before executing [TOOL_NAME], I will save the consolidated turn after completion."*
