# CI-Green Review Routing

This payload governs author-side review requests after a PR is opened or after the author pushes review-response fixes. It pairs with the reviewer-side CI fail-fast rule in `pr-review/audits/ci-security-audit.md`.

## 1. Source Of Authority

- `pull-request-workflow.md §6.2` owns author-side review routing; `AGENTS.md §0` the PR-open A2A.
- The Fleet's open-work wakes (`neomjs/neo-agent-brain#759`) carry the handoffs their selector routes, once per head; no seat DMs those (keep list: `pull-request-workflow.md` §6.2).

The goal is to preserve lifecycle visibility without waking a reviewer into work they must immediately hold.

## 2. CI-Green Gate

Before sending any actionable primary-reviewer request, run:

```bash
gh pr checks <PR_NUMBER>
```

Use an equivalent read-only GitHub status surface only if `gh pr checks` is unavailable, and state that substitution explicitly in the PR. The check is current-head scoped: re-run it after any push, yours or a peer's. Stacked PRs
(`baseRefName` not `dev` / default) with lint-only green are observer/no-action:
name base PR / merge order / retarget-CI, then request primary cross-family
review only after dev-rebase/full CI. Full-CI stacked heads still name base
state.

Require installed `review-admission/mergeability=success`; base moves can
change it. Activation uses live `mergeable`; elsewhere
`manage_pr_reviewers(add)` gates.

## 3. Outcome Branches

### Green

All required checks for the current head passed.

1. Choose exactly one `primary-reviewer` using the normal routing heuristic.
2. Call `manage_pr_reviewers({action: 'add', pr_number, reviewers: ['<reviewer>']})`; the Fleet's `review` wake reaches them. Review focus belongs in the PR body.

### Pending, Queued, Or In Progress

Do not call `manage_pr_reviewers` or send an actionable `/pr-review` request. The lifecycle A2A is observer/no-action:

```text
Review role: observer
Requested action: none
CI status: pending on current head <sha-or-short-sha>
Next author action: re-check CI before assigning a primary reviewer
```

Pending CI is not a halt-state: unblock a peer PR or take the next `post-review-pickup` lane. The recheck trigger is the Fleet's `route-review` (green) or `repair-ci` (red) wake, never a harness PR monitor (Auto-fix never fires on green) or a self-scheduled poll. On the wake, re-run `gh pr checks <PR_NUMBER>` before assigning a reviewer.

### Failing, Cancelled, Timed Out, Or Deep Red

Do not request formal review. The author fixes CI first, pushes the fix, and repeats the CI-green gate on the new head.

Help diagnosing CI is CI triage, not formal review:

```text
Review role: ci-triage
Requested action: inspect failing check only; do not run full /pr-review
CI status: failing on current head <sha-or-short-sha>
```

### No Checks Returned

If no checks, proceed only without a controller, and A2A the reviewer too: no `review` wake fires without CI. Otherwise a missing context holds the seat until the next base event or `workflow_dispatch`; park that recheck and drive another lane.

## 4. Re-Review Requests

After addressing feedback, apply the same gate. While CI is pending, end the Addressed comment with `CI status: pending on <head>; re-review follows at green.` instead of `Re-review requested.` At green, re-request on GitHub (`manage_pr_reviewers` add); no re-review DM.

**A base update is not a re-review event** (operator ruling 2026-11-17), even when the Fleet sends `route-review` and merge-readiness calls the approval anchor stale. After a rebase or dev merge of an approved PR, run `git range-diff <old-base>..<old-head> <new-base>..<new-head>`; it skips merge commits, so after a dev merge also run `git log --merges --remerge-diff <new-base>..<new-head>` (a clean merge shows no diff). If both show only context, generated files, base-forced lines or removed conflict markers, post them as a delta note on the PR and request no one: a re-request blocks merge-readiness and spends the approver's budget. Otherwise re-request.

**Outside contributors:** any author push after approval re-enters review, since an untrusted "rebase" can carry content; a maintainer's own base merge there (`pull-request-workflow.md` §10) stays mechanical.

## 5. Anti-Patterns

| Anti-pattern | Why it harms |
|---|---|
| Calling `manage_pr_reviewers` while CI is pending | GitHub reviewer assignment is itself an actionable review request. |
| Suppressing the PR-open A2A until green | The swarm cannot see the opened PR. |
| Treating green CI as approval | Green CI only permits requesting human/peer review. |
| Waiting on pending CI (busy-wait, idle stop, harness PR monitor) | The Fleet's wake is the recheck; the wait belongs to another lane. |
| A DM repeating a Fleet wake | A second wake for the reader, a message for the writer. |
