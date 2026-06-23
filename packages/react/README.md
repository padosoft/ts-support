# @padosoft/react

React hooks and HOC utilities for padosoft projects. Requires React 18+.

## Installation

```bash
npm install @padosoft/react
# peer dependencies
npm install react
```

## `useConfig`

Subscribes to a [`Configuration<TConfig>`](../utilities) store from `@padosoft/utilities` via `useSyncExternalStore`. The component re-renders whenever `config.set()` is called.

```ts
import { useConfig } from "@padosoft/react";
import { appConfig } from "./config"; // a Configuration<AppConfig> instance

// Full config object
const config = useConfig(appConfig);

// Single field (typed)
const apiUrl = useConfig(appConfig, "apiUrl");
```

## HOC utilities

### `withWrap`

Augments a provider-like component with a `.wrap(Component)` method to avoid manual JSX nesting:

```ts
import { withWrap } from "@padosoft/react";

const ThemeProvider = withWrap(OriginalThemeProvider);
const ThemedApp = ThemeProvider.wrap(App);
// renders: <OriginalThemeProvider><App /></OriginalThemeProvider>
```

### `withCreate`

Attaches `.create(props)` and `.asComponent(props)` factory helpers to a component:

```ts
import { withCreate } from "@padosoft/react";

const Layout = withCreate((props: { title: string }) => <h1>{props.title}</h1>);

Layout.create({ title: "Hello" });            // => JSX element
Layout.asComponent({ title: "Hello" });        // => () => JSX element (usable as a component)
```

### `wrapProviders`

Wraps a component with multiple providers, outermost first:

```ts
import { wrapProviders } from "@padosoft/react";

const WrappedApp = wrapProviders([QueryProvider, ThemeProvider, AuthProvider])(App);
// renders: <QueryProvider><ThemeProvider><AuthProvider><App /></AuthProvider></ThemeProvider></QueryProvider>
```

### `composeHOCs`

Composes multiple HOCs onto a component, applied right-to-left (last HOC = innermost wrapper):

```ts
import { composeHOCs } from "@padosoft/react";

const Enhanced = composeHOCs(MyComponent)(withCreate, React.memo, ThemeProvider.wrap);
// equivalent to: withCreate(React.memo(ThemeProvider.wrap(MyComponent)))
```

### `HOC` type

A convenience type for higher-order components:

```ts
import type { HOC } from "@padosoft/react";

const withLogger: HOC = (Component) => {
  const Wrapped = (props) => { /* ... */ return <Component {...props} />; };
  return Wrapped;
};
```
