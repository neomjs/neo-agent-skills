# Core-Idiom Audit (instance, reactive-state and stateful-owner work)

Load-on-demand payload behind the guide's §7.5.1 pointer. Applies in ANY directory: the class
system spans hemispheres (`ai/` services and daemons are `Neo.setupClass` classes too).

## The checks

1. **Batched mutation:** multi-config changes to a live instance use ONE `component.set({...})`
   (EffectManager pause, coherent beforeSet/afterSet, single cascade), never chained property writes.
2. **Manager resolution:** components resolve via `Neo.get` / `Neo.getComponent` (`afterSetId`
   auto-registration). Re-implementing resolution or hardening against wrong-shape cases the class
   system precludes is a **Required Action**, not a style note.
3. **Reactive state:** view/shared state lives as reactive configs — on a `state.Provider` when
   multiple consumers bind it (the component tree lives in the shared app worker and windows are
   render targets, so provider value is declarative multi-consumer binding, never "survival").
4. **Service lifecycle (Brain-side weight):** long-running services honor `initAsync`/`ready()`
   (settle-or-reject on restart) and `registerAsync`/`trap` (destroy cancels pending async).
5. **Stateful owner shape:** read the touched module that owns instances, resources, effects or
   generations, with its creator and destructor. Trace each effect from the host's call site to
   the code that runs: a subclass or override of a `Neo.setupClass` class must be able to replace
   it, and one owner ends its lifetime (the creator destroys what it created; a borrowed handle is
   released, never destroyed). A handler bag over closure state, an effect body calling statics by
   class name, or a host naming the class at its call site defeats replacement even inside a
   registered class: registration is not dispatch. Name the bypassed path and the unowned
   lifetime; a returned callback alone is no defect.
6. **One class per `.mjs` file (`MACHINE-ENFORCEABLE-CANDIDATE`):** one top-level `ClassDeclaration`
   per module matching `className` ↔ path (`check-class-module-scope.mjs` enforces `neomjs/neo`
   `{src,apps,examples}` via `neomjs/neo#21737`; retire once shared-baseline covers consumer repos).
7. **Extensible class maps (`DISCIPLINE-ONLY`):** consumer/subclass-extensible label, icon, or option
   maps use `static config` (`{[isDescriptor]: true, merge: 'shallow', value: {...}}`) or `static`
   fields, never module-scope `const` tables (reserved for immutable internal constants).
8. **Bundled-tree `me = this` (`DISCIPLINE-ONLY`):** cache `let me = this` when `this` is used `> 2`
   times in bundled runtime code (`src/`, `apps/`, `examples/`, `docs/app/`); unbundled Node/Agent OS
   code (`ai/`, `buildScripts/`) prefers direct `this`.
9. **Lazy `import()` boundaries (`DISCIPLINE-ONLY`):** subclasses and consumers preserve base-class
   dynamic `import()` boundaries (e.g. `Button#afterSetMenu`'s lazy menu load) rather than pulling
   optional heavy modules into top-level static `import`s.

## The exemption

Pure data-plane logic (parsers, validators, transition tables, stateless helpers and callbacks)
passes as plain modules. A closure that owns instances, resources or effects does not, whatever
its JSDoc calls it. Nothing here asks to turn every module into a Base class.

A reviewer whose window cannot afford the `src/core/Base.mjs` read MAY satisfy this audit via
`ask_knowledge_base` on the specific idiom.
