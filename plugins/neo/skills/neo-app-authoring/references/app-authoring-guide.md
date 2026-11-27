# Writing Engine, App, and Example Code on Neo.mjs

Neo.mjs is not React, Vue, or Angular. Classes run in the App worker, components are declarative config trees turned into stateful instances, and the engine renders through its own virtual DOM. Resolve engine paths at `./` inside `neomjs/neo` or `node_modules/neo.mjs/` inside a generated `npx neo-app` workspace.

## 1. Read Before You Write (`{src,apps,examples}/**`)

Read authoritative engine contracts **before** trusting any sibling file (siblings may predate current idioms):
1. **Guidelines & core primitives first:**
   - `.github/CODING_GUIDELINES.md` (class anatomy, JSDoc `@reactive`/`@protected`/multiline rules, member ordering, `let me = this`);
   - `src/core/Base.mjs` (reactive configs, `[isDescriptor]`, `set()` batching, `observeConfig`, `destroy`);
   - `src/Neo.mjs` (`Neo.setupClass`, `Neo.create`, `Neo.get` / `Neo.getComponent`);
   - `src/state/Provider.mjs` and `src/data/{Model,Store}.mjs` when managing view state or records.
2. **One or two verified siblings:** inspect a nearby file under `src/`, `apps/`, or `examples/` (`src/app/content/Container.mjs` is the declarative composite exemplar) and verify its patterns match `Base.mjs`, `Neo.mjs`, and `.github/CODING_GUIDELINES.md` before reusing its shape.
3. **VDOM Engine gate:** before modifying `src/vdom/**`, `src/util/vdom/**`, `src/worker/VDom.mjs`, `src/manager/VDomUpdate.mjs`, `src/mixin/VdomLifecycle.mjs`, or `src/main/DeltaUpdates.mjs`, read the [VDOM Engine Overview](neomjs/neo:learn/guides/vdomengine/Overview.md), [AppWorker](neomjs/neo:learn/guides/vdomengine/AppWorker.md), [VdomWorker](neomjs/neo:learn/guides/vdomengine/VdomWorker.md), [MainThread](neomjs/neo:learn/guides/vdomengine/MainThread.md), and [ADR 0043: VDOM Diff Placement](neomjs/neo:learn/agentos/decisions/0043-vdom-diff-placement.md). Plain docs index: `https://neomjs.com/llms.txt`.

## 2. Class Shape, Descriptors, and Extensibility

```javascript
import {isDescriptor, mergeFrom} from '../../core/ConfigSymbols.mjs';
import Container                 from '../../container/Base.mjs';
import TreeList                  from './TreeList.mjs';

/**
 * @summary Composite view with declarative child customization hooks.
 *
 * @class MyApp.view.MainContainer
 * @extends Neo.container.Base
 */
class MainContainer extends Container {
    static config = {
        /**
         * @member {String} className='MyApp.view.MainContainer'
         * @protected
         */
        className: 'MyApp.view.MainContainer',
        /**
         * @member {Object} items
         */
        items: {
            [isDescriptor]: true,
            clone         : 'deep',
            merge         : 'deep',
            value         : {
                tree: {
                    module     : TreeList,
                    [mergeFrom]: 'treeConfig',
                    reference  : 'tree'
                }
            }
        },
        /**
         * @member {Object|null} treeConfig_=null
         * @reactive
         */
        treeConfig_: {
            [isDescriptor]: true,
            merge         : 'deep',
            value         : null
        }
    }
}

export default Neo.setupClass(MainContainer);
```

- **Extend the matching primitive & deduplicate defaults:** class suffix names its base family (`…Container`, `…Dialog`, `…List`, `…Store`, `…Controller`). Read the superclass `static config` chain and omit unchanged ancestor defaults (`MACHINE-ENFORCEABLE-CANDIDATE`: retire when `check-coding-guidelines.mjs` enforces).
- **Declarative child hooks (`[isDescriptor]` + `[mergeFrom]`):** reusable composite components (`src/app/content/Container.mjs:29`) declare keyed `items` (`[isDescriptor]: true, clone: 'deep', merge: 'deep'`) and merge child overrides from `<child>Config_` descriptors via `[mergeFrom]`. Never override `mergeConfig()` or copy `createItems()` just to specialize children.
- **Reactive configs (`foo_`):** trailing `_` generates getters/setters and `beforeGetFoo` / `beforeSetFoo(value, oldValue)` (`undefined` cancels) / `afterSetFoo(value, oldValue)` (`oldValue === undefined` on initial construct). Clear with `null`, never `undefined`. Batch multi-config updates in one `instance.set({...})`.
- **Methods & JSDoc (`CODING_GUIDELINES.md §8, §12`):** keep logic on public or `@protected` class methods, never module-scope helpers or `#private` methods (which break subclassing, mixins, `Neo.overwrites`, and Neural Link `get_method_source`; reserve `#private` fields for internal handles like timer IDs). Expand multiline JSDoc whenever a `@member` has array/object defaults or `@reactive`/`@protected` tags (`MACHINE-ENFORCEABLE-CANDIDATE`: retire when `check-coding-guidelines.mjs` enforces). Cache `let me = this` when `this` is used `> 2` times in bundled code (`src/`, `apps/`, `examples/`). Set up in `construct(config)` / `onConstructed()`, never `constructor` or `new`.

## 3. Data, StateProvider, and Styles

- **Data views bind a `data.Store` of `data.Model` records** (`apps/colors/store/Colors.mjs` + `model/Color.mjs`), never a hand-mapped array.
- **`state.Provider` sits at view roots:** bind children declaratively (`bind: {hidden: data => data.isCompact}`) instead of threading values manually across children; place handlers in `controller.Component`.
- **Styles stay in CSS:** structural rules under `resources/css/src/…` and theme tokens under `resources/css/theme-*/…` (`npm run build-themes`); inline `style` is only for runtime-computed values.

## 4. Consumer & Runtime Verification

Before reporting a reusable class or app view as done, verify:
1. **Two-operation consumer check:** (a) a second app or subclass can customize a declared child through config merging alone without copying methods, and (b) mutating its reactive config on a mounted instance via `set()` preserves focus, selection, and state.
2. **Live runtime check:** run `npm run server-start` and use `neural-link` (`inspect_class`, component tree, store records, computed styles) to confirm live behavior.
