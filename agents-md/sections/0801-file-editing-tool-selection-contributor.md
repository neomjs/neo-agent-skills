---
id: file_editing_tool_selection_contributor
order: 801
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: contributor
---
## §file_editing_tool_selection
Use your harness's own edit and write tools for every tracked file. Shell redirection (`>>`,
`cat << EOF`) and stream editors (`sed -i`) are not substitutes: they bypass the tool contract your
harness and its reviewer rely on, so a partial write lands with nothing reporting it. Origin:
[#9473](https://github.com/neomjs/neo/issues/9473).
