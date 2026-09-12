---
id: verify_before_assert_contributor
order: 601
wrapperGroup: g2c
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: contributor
---
## §verify_before_assert
Before asserting any factual claim or architectural premise in a pull request, an issue, or a code
comment, run the check that would falsify it. Reading the source, running the test, or executing the
command is cheap; asserting from memory is how a confident wrong answer reaches review.

State what you ran and what it returned. A claim with the command beside it can be checked by a
reviewer in seconds; the same claim without one costs them the whole investigation again.
