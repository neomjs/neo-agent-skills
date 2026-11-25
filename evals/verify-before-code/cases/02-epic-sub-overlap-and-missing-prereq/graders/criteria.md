# Grader Criteria — Case 02: Pre-Work Epic Validation Catches Missing Migration Sub & Overlapping Leaves

A passing response MUST satisfy all four criteria:

1. **Stage 3 missing prerequisite sub:** Identifies that Epic `#510` Success Criterion 1 (`signing_keys` table in database) has NO owning sub-issue or SQL migration (`migrations/` only has `001` and `002`), blocking `#511`–`#513` from verifying rotated Ed25519 keys.
2. **Stage 3 overlapping sub-issues (`#511` vs. `#512`):** Flags that `#511` and `#512` duplicate the same `src/gateway/authMiddleware.ts` bearer-verification + cookie-removal work and should be merged or cleanly split with `blocked_by` ordering.
3. **Blocks sub pickup (`Revisions Requested`):** Halts pickup of `#511` until the missing `signing_keys` migration sub-issue is added and `#511`/`#512` overlap + `blocked_by` dependencies are resolved.
4. **Contained output (§2D):** Delivers the structured Epic Review in chat without calling `gh issue comment` unless explicitly instructed.
