# CI-Green Review Routing

This payload governs author-side review requests after a PR is opened or after the author pushes review-response fixes. It pairs with the reviewer-side CI fail-fast rule in `pr-review/audits/ci-security-audit.md`.

## 1. Source Of Authority

- `pull-request-workflow.md §6.2` owns author-side review routing.
- `pr-review/audits/ci-security-audit.md` owns reviewer-side CI hold / fail-fast behavior.
- `AGENTS.md §0` still requires lifecycle A2A notification when the PR opens.
- The Fleet's open-work wakes (`neomjs/neo-agent-brain#759`) carry the handoffs their selector routes, once per head; no seat DMs those (keep list: `pull-request-workflow.md` §6.2).

The goal is to preserve lifecycle visibility without waking a reviewer into work they must immediately hold.

## 2. CI-Green Gate

Before sending any actionable primary-reviewer request, run:

```bash
gh pr checks <PR_NUMBER>
```

Use an equivalent read-only GitHub status surface only if `gh pr checks` is unavailable, and state that substitution explicitly in the PR. Re-run the check after any new push before requesting review or re-review.

Treat the check as current-head scoped. Re-check after peer work. Stacked PRs
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

Do not call `manage_pr_reviewers`. Do not send an actionable `/pr-review` request.

For the mandatory lifecycle notification, send observer/no-action A2A:

```text
Review role: observer
Requested action: none
CI status: pending on current head <sha-or-short-sha>
Next author action: re-check CI before assigning a primary reviewer
```

Use the wait window productively:

1. Check unread A2A and open peer review requests.
2. If a peer PR can be reviewed or unblocked without abandoning your lane, do that work while CI runs.
3. If no peer-unblock lane is available, pick up the next positive-ROI backlog lane per `post-review-pickup`. The recheck trigger is the Fleet's `route-review` (green) or `repair-ci` (red) wake, never a harness PR monitor (Auto-fix never fires on green) or a self-scheduled poll.
4. On the wake, re-run `gh pr checks <PR_NUMBER>` before assigning a reviewer.

Do not spin indefinitely. Pending CI is asynchronous work owned by GitHub Actions; by itself it is not a halt-state. A stop is valid only when a normal `post-review-pickup` halt criterion has been verified and named.

### Failing, Cancelled, Timed Out, Or Deep Red

Do not request formal review. The author fixes CI first, pushes the fix, and repeats the CI-green gate on the new head.

If the author explicitly needs help diagnosing CI, route that as CI triage, not formal review:

```text
Review role: ci-triage
Requested action: inspect failing check only; do not run full /pr-review
CI status: failing on current head <sha-or-short-sha>
```

### No Checks Returned

If no checks, proceed only without a controller, and A2A the reviewer too: no `review` wake fires without CI. Otherwise a missing context holds the seat until the next base event or `workflow_dispatch`; park that recheck and drive another lane.

## 4. Re-Review Requests

After addressing reviewer feedback with new commits, apply the same gate before writing `Re-review requested.` If CI is pending, post the structured Addressed comment with a hold line instead:

```text
CI status: pending on current head <sha-or-short-sha>. Re-review request will follow once CI is green.
```

Once CI is green, re-request the reviewer on GitHub (`manage_pr_reviewers` add); no re-review DM.

## 5. Anti-Patterns

| Anti-pattern | Why it harms |
|---|---|
| Calling `manage_pr_reviewers` while CI is pending | GitHub reviewer assignment is itself an actionable review request. |
| Suppressing all PR-open A2A until CI is green | Violates lifecycle visibility and makes the swarm blind to an opened PR. |
| Treating green CI as approval | Green CI only permits requesting human/peer review. |
| Busy-waiting forever | Pending CI time should unblock peers, then trigger a recheck. |
| Stopping solely because CI is still pending | Turns an asynchronous GitHub Actions wait into agent idle time; pick up the next lane until the Fleet's wake. |
| Arming a harness PR monitor as the CI wait | It never fires on green. |
| A DM repeating a Fleet wake | A second wake for the reader, a message for the writer. |
