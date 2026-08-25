## Working in this repository

These clauses are canonical and shared across enrolled repositories. They are **contributor-facing
by construction**: every one is executable by a clean fork with no private infrastructure, and none
encodes maintainer-institution policy. If a clause here ever requires a Neo seat to act on, it is in
the wrong file.

### Before you change code

- Read one or two **sibling files** next to the one you are changing before writing. Valid API is not
  the same as idiomatic API, and the surrounding code is the specification for how new code should
  read — its naming, its comment density, its idiom.
- Match the existing style rather than importing conventions from elsewhere. A patch that reads as
  though it came from a different codebase costs the next reader more than it saved you.

### Commands

- Use the commands in the facts table above. They are the canonical invocations for this repository.
- Where a **forbidden command** is listed, it is listed because it *looks* correct and silently does
  the wrong thing. Those entries are the expensive knowledge in this file.

### Commits and pull requests

- Keep a commit focused on one change. Unrelated fixes belong in their own commit.
- Describe **why** in the commit body, not what the diff already shows.
- Open pull requests against the default branch named in the facts table above. It is not the same
  across repositories, and assuming `main` is a common and silent mistake.

### Generated files

- Files marked `GENERATED` are rendered from a source of truth and are **not editing surfaces**.
  Edit the source and re-render. A hand-edit is reverted by the next render, and CI reports it as
  drift before that happens.
- `.agents/skills/` and this file's head are both generated in that sense: the skill tree is synced
  from a canonical store, and the facts head is rendered from `.agents/repo-facts.json`.

### Agent-authored contributions

- Agent contributions are welcome and are held to the same bar as human ones: tests where behavior
  changes, no unexplained scope, and a description a reviewer can act on without reconstructing your
  session.
- State that a change was agent-authored. Provenance is useful to reviewers and costs nothing.
