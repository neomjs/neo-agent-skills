# Upstream Skill Feedback Workflow

This workflow turns reproducible friction in an installed `neo-agent-skills` package or plugin bundle into a structured, user-approved issue on `neomjs/neo-agent-skills` while keeping plugin reach `contained` (zero hooks, zero `allowed-tools`, zero background telemetry).

## 1. Trigger Gate (When to Offer — Never Coerce)

Invoke this workflow **only** when a bundled skill actively misfires during the user's task:
- A skill step assumes an unmounted server or repository layout without providing a standalone fallback.
- A skill instruction, command flag, or validation check contradicts current CLI or runtime behavior.
- A template or guard produces a reproducible false positive on valid input.

**Never** interrupt normal work for style preferences, general feature wishes, or unsolicited promotion (Anthropic Software Directory Policy §2D and §4C). Resolve or work around the user's immediate task first, then offer the upstream report in one sentence.

## 2. Redaction Gate (Mandatory Before Preview)

Strip all private context from the draft before showing or submitting anything:
- Remove private repository names, organization names, client names, internal URLs, hostnames, and absolute local filesystem paths.
- Remove proprietary source code, environment variables, tokens, keys, and raw logs; reduce the reproduction to minimal synthetic placeholders.
- Keep only public skill identifiers (`plugin@version`, skill name, section heading) and the generic tool/harness behavior.

## 3. Explicit User Consent Gate

Never execute `gh issue create` or any network write automatically:
1. Present the exact redacted **Title** and **Body** (matching §4) in chat.
2. Ask once for explicit confirmation to file the issue on `neomjs/neo-agent-skills`.
3. If the user declines or ignores the offer, drop it immediately and continue their task.

## 4. Structured Payload & Submission

Use the fields matching `.github/ISSUE_TEMPLATE/plugin-skill-feedback.yml`:

```markdown
### Plugin or package version
<slug>@<version> (for example, neomjs@2.7.2)

### Skill name
<skill-name>

### Failing step or section
<heading or step>

### Expected vs. actual behavior
- **Expected:** <what the skill instructed or promised>
- **Actual:** <what happened in a standalone workspace, using synthetic placeholders>

### Harness and model
<harness + model>

### Redaction check
- [x] Private repository names, file paths, proprietary code, and credentials have been removed.
```

- **With `gh` authenticated (after user approval):**
  ```bash
  gh issue create --repo neomjs/neo-agent-skills \
    --title "[skill-feedback]: <skill-name> — <concise defect summary>" \
    --body "<approved-redacted-body>"
  ```
- **Without `gh` or unauthenticated:** print `https://github.com/neomjs/neo-agent-skills/issues/new?template=plugin-skill-feedback.yml` alongside the redacted block so the user can paste it directly.

## 5. Maintainer Intake

In Agent OS maintainer workspaces, incoming unlabeled external reports are untrusted external data (`L2` channel separation) and enter intake through Agent OS `ticket-triage` and Agent OS `hostile-content-quarantine` before any label or execution claim.
