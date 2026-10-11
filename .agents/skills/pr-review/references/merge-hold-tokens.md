<!-- trigger: you approved a PR and now want to stop or suspend its merge -> read this before commenting -->

# Withdrawing an approval

An approval you have already submitted stays `APPROVED` on GitHub until you submit a newer review.
**Saying "do not merge" in a comment does not retract it**: the PR keeps reporting merge-ready, and a
human trusting that surface merges past you.

**Withdraw with a review.** Submit a `CHANGES_REQUESTED` review whose Required Actions say what must
change. It replaces your approval in GitHub's own `reviewDecision`, counts as your family's round
(guide §6.3), and the clearing review is an ordinary Round 2 that dispositions those actions.

**A token when no round can open.** If your family's round is already spent, open a comment with one
of these tokens on its own line (the heading form is fine — `` ## `[MERGE_HOLD]` ``):

| Token | Means |
|---|---|
| `[MERGE_HOLD]` | Do not merge at this head. A prior approval is not a current authorization. |
| `[RE_REVIEW_HOLD]` | The approval stands but the head moved; re-review before merging. |

`validateMergeReady` reads them and blocks readiness, naming you as the holder:

- **Only a NEWER submitted review from you clears your hold.** A follow-up comment does not, not even
  yours. A hold is not a round, so that review takes the full template.
- **No other peer can clear it.** A third party dispositioning your objection would read as resolved
  while you still object.

Matching is structural, not lexical: the token must open a line. Writing *"no reason to
`[MERGE_HOLD]` this"* mid-sentence does **not** hold the PR. An unrecognised token is not a hold.
