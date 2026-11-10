# Unit Test Specialist Workflow

**Audience:** use the declared instruction audience. With none declared, use `maintainer`;
missing tools never select `contributor`. Contributors follow the public-source steps below;
retrieval and diary saves apply only to maintainers.

## 1. Review-Only Boundary

During a PR review, `pr-review` owns execution-evidence allocation. Merely inspecting a diff that contains, adds, or moves unit tests—or checking their placement/idioms—does **not** activate this author/executor workflow.

- Green required CI at the exact head owns routine unit/integration execution; do not rerun it for duplicate evidence.
- `NEO_TEST_SKIP_CI` coverage is excluded from that claim. The author supplies an exact-head non-CI receipt; the reviewer validates or challenges it and runs locally only for a named falsifier when their environment has the capability.
- Grounding, implementation, and execution below apply only when writing, modifying, fixing, or explicitly running unit tests.

**Review-only fixture:** A PR adds `test/playwright/unit/ai/example.spec.mjs`, exact-head unit CI is green, and no guarded behavior is claimed. Inspect its canonical path and Neo test idioms; do not load authoring examples or rerun the spec.

## 2. Author/Executor Grounding

Read what the work needs, once per session:

| The work | Read first |
|---|---|
| Running specs | nothing beyond this file |
| Arms in, or a fix to, an existing spec | that spec, whole: it is the example |
| A new spec file | the closest sibling spec (the subject's directory, else its base class) and `test/playwright/setup.mjs` (App/VDom wiring, `unitTestMode`) |
| A pattern no sibling shows, or a change to the harness | also `src/Neo.mjs` (`setupClass()`, `create()`, namespaces, `ntype`), `src/core/Base.mjs` (configs, lifecycle, config hooks), the Engine's [Unit Testing guide](https://github.com/neomjs/neo/blob/dev/learn/guides/testing/UnitTesting.md), and `vdom/RealWorldUpdates.spec.mjs`, `collection/Base.spec.mjs`, `core/Effect.spec.mjs` under `test/playwright/unit/` |

Unsure of the row: take the next heavier one.

## 3. Operational Protocols

### Knowledge Base First
- **Query, Don't Guess:** maintainers use `query_documents`; contributors read the public source, closest tests and Git history before writing tests.
- **Enhancement Strategy:** If the code you are testing lacks JSDoc or clear intent, **you MUST document it first**. You cannot write a valid unit test for code you do not fully understand.

### Memory Core Protocol (Maintainer Only)
- **Consolidate-Then-Save:** Accumulate your thoughts and tool outputs. Call `add_memory` **once** at the end of every turn, just before your final response.

## 4. Technical Constraints & Patterns

### Architecture: "Single-Thread Simulation"
- **No Workers:** Unit tests run in a single Node.js thread.
- **Mocking:** Do NOT mock `postMessage`. The `setup()` helper wires `App` and `VDom` layers directly.
- **Environment:** Global `Neo` namespace persists across tests in the same file.

### Import-Time Side Effects (connect-on-init singletons)
Some singleton services connect to — or spawn — external infrastructure the moment their module is imported: `Neo.setupClass` constructs the singleton and runs `initAsync()`, so a service whose `initAsync` auto-connects (e.g. `ai/services/neural-link/ConnectionService` with `autoConnect`) reaches out to the Bridge *during the import itself*. In a unit spec that means a live socket connection — or, in CI where nothing is listening, a **spawned Bridge process**. A unit test must cause neither.
- **Do NOT import a connect-on-init singleton just to unit-test its logic** — the import runs the side-effect before your test body does.
- **Extract the pure logic into a standalone module** (a plain function or static helper with no socket/Bridge coupling) and import THAT directly. The pure module has no host side-effects, so the suite stays hermetic in CI; the singleton itself is left to integration/e2e coverage. For example, a service's target-resolution or validation rule can move into a standalone helper that the singleton delegates to, unit-tested directly rather than through the connect-on-init class.

### Critical Rules (Zero Tolerance)
1.  **Import Neo + Core Augmentation:** You **MUST** import `src/Neo.mjs` and `src/core/_export.mjs` in every test file that depends on Neo globals or the shared `test/playwright/setup.mjs` helper.
    - *Why:* `src/Neo.mjs` initializes the global Neo namespace and defines helpers like `Neo.ns`; `src/core/_export.mjs` augments that namespace with utilities like `Neo.isString` or `Neo.isEqual`. Missing `src/Neo.mjs` surfaces as setup-driven errors like `TypeError: Neo.ns is not a function`; missing `src/core/_export.mjs` surfaces later as absent core utilities.
2.  **Unique Neo ClassNames:** The `className` config property defines the namespace and **MUST** be unique across the entire test suite.
    - The JavaScript class symbol (e.g., `class MyButton`) does not affect the namespace and can be anything.
    - **Requirement:** Use a verbose, specific namespace for the `className` config.
    - ❌ `className: 'Test.MockComponent'` (Too generic, will collide)
    - ✅ `className: 'Test.Unit.Buttons.RippleEffectComponent'` (Specific and safe)
3.  **Manual VDOM Init:** VDOM generation is manual in tests.
    - Call `await instance.initVnode()` to trigger the initial render.
    - Set `instance.mounted = true` to enable subsequent reactive updates.

## 5. Workflow

1.  **Analyze:** Read the code to be tested.
2.  **Plan:** Identify the specific logic branches to verify (e.g., config changes, state updates).
3.  **Implement:** Write the `.spec.mjs` file in `test/playwright/unit/`.
4.  **Verify:** Run the test using the specific configuration.

## 6. Execution Commands

**Run All Unit Tests:**
```bash
npm run test-unit
```

**Run Specific File (Focus Mode):**
Use the double-dash `--` to pass the file path to the npm script.
```bash
npm run test-unit -- test/playwright/unit/path/to/your.spec.mjs
```

**Debug Mode:**
```bash
npm run test-unit -- test/playwright/unit/path/to/your.spec.mjs --debug
```

## 7. Directory Conventions

- **Canonical Unit Tests**: `test/playwright/unit/`
- **Right-Hemisphere Tests (Backend/Node.js)**: Mirror the subject's path under `test/playwright/unit/`: `buildScripts/**` → `test/playwright/unit/buildScripts/**`, `ai/**` → `test/playwright/unit/ai/**` (`c623b2f63c` swept 804 `unit/ai/**` specs, 27 Engine-owned). Do NOT use the frontend mirror (`test/playwright/unit/<package>/`), per [Architecture Overview](https://github.com/neomjs/neo/blob/dev/learn/benefits/ArchitectureOverview.md).
- **MCP Server Unit Tests**: You **MUST** place MCP tests in `test/playwright/unit/ai/mcp/server/`. Do NOT use the deprecated/grandfathered `test/playwright/mcp/` tree for new tests.
