---
id: mailbox_check_protocol
order: 1500
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §mailbox_check_protocol
At turn start you MUST call `list_messages({status:'unread'})` and state the count. **Missing/erroring ≠ empty inbox — that is degradation: `/self-repair` before resuming the lane.**

**Lead-role baton intake:** a **valid targeted** unread `lead-role-baton` ⇒ `/lead-role` immediately, unless the operator's current-turn instruction overrides; broadcast/stale/malformed never authorizes self-election. Constraints: §lead_role_baton_intake.

**Post-lifecycle-event trigger:** After ANY discrete lifecycle event (PR review post, author response, implementation completion, PR open/update, ticket create, blocked-state resolution), invoke `/post-review-pickup` to declare the next `lane-state:` rather than silently ending the turn (#11455).

**Skill Adherence Pre-Flight (per-turn):** before triggering a lifecycle skill, state that you will read the full SKILL.md **and** its referenced payload first. Half-reading is 3–5× costlier across correction cycles.
