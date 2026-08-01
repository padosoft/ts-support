# Plan: `withComponentOverride` HOC

before doing anything move componentRegistry/useComponentOverride from react-native-support/rn-ui to ts-support/react

## Context

`componentRegistry` + `useComponentOverride` are already wired and reactive (via `useSyncExternalStore`). The pain point is that **consuming components** must import the default and call the hook themselves every time they want to participate in the override system. The goal is a HOC applied at **definition time** in `@gescat/ui`, so all usage sites (`<Button>`, `<Text>`, etc.) automatically delegate to the registry with zero boilerplate.

---

## Key design decisions

### Where does the HOC live?
`packages/ui/src/hooks/withComponentOverride.tsx` — same package as `useComponentOverride`. This avoids a `ui → core` circular dependency (core already depends on ui).

### Key resolution at render time
`displayName` must be set on the **exact component passed as fallback** to `withComponentOverride`. The HOC also probes `component.type?.displayName` to support `memo()`-wrapped inputs (React stores the inner function on `.type`), so `composeHOCs` works naturally:

```
composeHOCs(ButtonBase)(withComponentOverride, memo)
= withComponentOverride(memo(ButtonBase))
// memo(ButtonBase).type === ButtonBase → displayName found ✓
```

### Does it auto-`memo`?
No. The caller controls memoization of the base component. `withSyncExternalStore` inside `useComponentOverride` already ensures the wrapper only re-renders when the registry changes.

---

## Implementation

### 1. `packages/ui/src/hooks/withComponentOverride.tsx` (new file)

```tsx
import { useComponentOverride } from "./useComponentOverride";

function resolveDisplayName(component: React.ComponentType): string | undefined {
  return (
    component.displayName ??
    (component as { type?: React.ComponentType }).type?.displayName ??
    component.name
  );
}

export function withComponentOverride<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  key?: string,
): React.ComponentType<P> {
  const resolvedName = key ?? resolveDisplayName(WrappedComponent) ?? "Component";

  const WithOverride = (props: P) => {
    const Component = useComponentOverride(WrappedComponent, key ?? resolvedName);
    return <Component {...props} />;
  };

  WithOverride.displayName = resolvedName;
  return WithOverride;
}
```

### 2. Export from the hooks barrel
Add to `packages/ui/src/hooks/index.ts` (or wherever `useComponentOverride` is re-exported from):
```ts
export { withComponentOverride } from "./withComponentOverride";
```

---

## Usage patterns

### Standalone (most common, at definition site in `@gescat/ui`)
```tsx
const ButtonImpl = memo(() => <Pressable>...</Pressable>);
ButtonImpl.displayName = "Button"; // required — HOC reads this

export const Button = withComponentOverride(ButtonImpl);
// Button.displayName is auto-set to "Button" by the HOC
```

### With composeHOCs (HOC must be outermost so it reads the inner displayName)
```tsx
const ButtonBase = () => <Pressable>...</Pressable>;
ButtonBase.displayName = "Button";

export const Button = composeHOCs(ButtonBase)(
  withComponentOverride,  // outermost: reads ButtonBase.displayName via .type
  memo,                   // innermost: memoizes ButtonBase
);
```

### Explicit key (e.g. same component exposed under two override slots)
```tsx
// If the override key must differ from displayName, pass it explicitly:
export const HeaderButton = withComponentOverride(ButtonImpl, "HeaderButton");

// In composeHOCs, use a partial wrapper:
const withOverride = (k: string) => <P extends object>(c: React.ComponentType<P>) =>
  withComponentOverride(c, k);

const HeaderButton = composeHOCs(ButtonBase)(withOverride("HeaderButton"), memo);
```

### White-label override (consumer side — zero change from today)
```tsx
// In apps/luisaviaroma/src/overrides.ts
componentRegistry.register(LVRButton, "Button");
// All <Button> usages now render LVRButton everywhere in the app ✓
```

---

## Constraint: `displayName` must be set on the fallback component

The HOC probes `component.displayName → component.type?.displayName → component.name`. If none resolves to a meaningful string before the first render, the registry key falls back to `"Component"` — making overrides impossible. This is consistent with CLAUDE.md Rule #11 (memo + displayName always required), so it's not an extra burden.

---

## Files to touch

| File | Action |
|---|---|
| `packages/ui/src/hooks/withComponentOverride.tsx` | Create |
| `packages/ui/src/hooks/index.ts` (or nearest barrel) | Add export |

---

## Verification

1. Define a test component with `withComponentOverride(memo(Impl))` where `Impl.displayName = 'TestComp'`.
2. `componentRegistry.register(OverrideComp, 'TestComp')` before rendering → component renders `OverrideComp`.
3. `componentRegistry.unregister('TestComp')` → component falls back to `Impl` without remounting parent.
4. Verify `composeHOCs(Base)(withComponentOverride, memo)` resolves `Base.displayName` correctly.
5. Verify that `Button.displayName` on the exported wrapper equals the resolved name (devtools check).
