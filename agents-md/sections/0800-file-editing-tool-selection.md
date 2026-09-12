---
id: file_editing_tool_selection
order: 800
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer, contributor
---
## §file_editing_tool_selection
**The "Append Gap":** no dedicated `append_file` tool exists; `replace` is the substitute. Bash redirection (`>>`, `cat << EOF`) and stream editors (`sed -i`) bypass the tool contract and are banned. Origin: [#9473](https://github.com/neomjs/neo/issues/9473).

1. **Targeted Edits/Appending:** Always use the `replace` tool.
2. **Overwriting/Creating:** Always use the `write_file` tool.
3. **The Bash Ban:** You are strictly FORBIDDEN from using bash redirection or stream editors (`sed -i`) via `run_shell_command` to modify files.
