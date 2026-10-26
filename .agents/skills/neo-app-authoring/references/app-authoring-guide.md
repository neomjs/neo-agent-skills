# Writing an app on neo.mjs

neo.mjs is not React, Vue or Angular, and patterns from them fail here. The application runs in an
App worker, not on the main thread. Components are JSON-like configs that the engine turns into
instances, and the engine renders through its own virtual DOM. Everything below is in the installed
engine, so read it there instead of guessing an API.

## 1. Read before you write

The engine source ships inside the workspace at `node_modules/neo.mjs/`:
- `src/` is every class;
- `learn/` holds the guides;
- `examples/` and `apps/` hold working code.

Before the first line of app code, read:
1. **One sibling.** A file in your app, or in `node_modules/neo.mjs/apps/`, that already does what you are about to do. Copy its shape, not its content.
2. **The core classes:**
   - `src/Neo.mjs` (`Neo.setupClass`, `Neo.create`, the namespace);
   - `src/core/Base.mjs` (configs and their hooks);
   - `src/state/Provider.mjs` (shared state);
   - `src/data/Model.mjs` and `src/data/Store.mjs` (data).

For a class you have not used, open its file. Every config is documented in its `static config`
block. The guides are also served as plain text: `https://neomjs.com/llms.txt` is the index, and it
links each document's markdown under `https://neomjs.com/raw/`.

## 2. The class shape

Every class extends an engine class, declares a `static config`, and registers itself:

```javascript
import Container from '../../../node_modules/neo.mjs/src/container/Base.mjs';

class MainView extends Container {
    static config = {
        className: 'MyApp.view.MainView', // unique; the namespace starts with your app name
        layout   : {ntype: 'vbox', align: 'stretch'},
        items    : []
    }
}

export default Neo.setupClass(MainView);
```

- **Start from the matching engine primitive.** The class suffix names its family: a `…Container` extends `container.Base`, a `…Store` extends `data.Store`, a `…Controller` extends `controller.Component`.
- **Reactive configs end in an underscore** (`title_`). The engine then generates the getter and setter, plus three optional hooks:
  - `beforeGetTitle(value)`;
  - `beforeSetTitle(value, oldValue)`, where returning `undefined` cancels the update;
  - `afterSetTitle(value, oldValue)`, which runs for the first time during construction with `oldValue === undefined`.
  
  Clear a config with `null`, never `undefined`.
- **Configs without an underscore** are prototype values shared by every instance. Declare them in `static config`, not as class fields.
- **Set up in `construct(config)`** (call `super.construct(config)`) or in `onConstructed()`, never in a JS `constructor`. Create instances with `Neo.create()`, or declare them as `items` (`module: MyClass`), never with `new`.

## 3. Data, state and styles

- **Data views bind a store.** A grid, list or chart takes a `data.Store` whose `model` is a `data.Model` subclass declaring the `fields`. Never pass a hand-mapped array. `apps/colors/store/Colors.mjs` and `apps/colors/model/Color.mjs` in the engine are the minimal pair.
- **State providers sit at view roots.** Put shared state in a `state.Provider` on the view that owns it, and bind children to it (`bind: {text: data => data.title}`). Don't thread values down through configs.
- **Logic goes in a view controller** (`controller.Component`). Handlers are referenced by name in the view's configs.
- **Styles stay in SCSS.** Structure goes under `resources/scss/src/apps/<app>/`, mirroring the class path, and theme variables go under `resources/scss/theme-*/apps/<app>/`. Build them with `npm run build-themes`. Use inline `style` only for values that change at runtime.

## 4. Run it and verify it

- `npm run server-start` serves the workspace and opens the app.
- With `useAiClient` enabled in the app's `neo-config.json` (the workspace sets `'development'`), the app connects to the Neural Link. Then the `neural-link` skill's tools let you check what you built in the running app: the component tree, a store's records, a computed style. Do this before you report the change as done.
- A config that seems to have no effect is usually a missing underscore, a typo in its name, or a config set on the wrong class. `inspect_class` on the live class shows its actual configs.
