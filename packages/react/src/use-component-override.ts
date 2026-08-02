import { useCallback, useMemo, useSyncExternalStore } from "react";
import { componentRegistry } from "./component-registry";

/**
 * Retrieves a component by key if registered, otherwise will check an override using `fallbackComponent.displayName` and as last resort returns the fallback component.
 *
 * @param fallbackComponent - The default component to use if no override is registered.
 * @param key - Optional key to search for an override.
 * @returns The registered component or the fallback.
 *
 * @example
 * ```ts
 * const Button = useComponentOverride(DefaultButton, 'HeaderButton');
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: required for a type-safe implementation
export function useComponentOverride<C extends React.ComponentType<any>>(
	fallbackComponent: C,
	key?: string,
): C {
	const resolvedKey = useMemo(() => {
		return componentRegistry.findKey(fallbackComponent, key);
	}, [fallbackComponent, key]);

	const getSnapshot = useCallback(
		() => componentRegistry.get(fallbackComponent, resolvedKey),
		[fallbackComponent, resolvedKey],
	);

	const subscribe = (callback: () => void) =>
		componentRegistry.subscribe((updatedKey) => {
			if (updatedKey !== resolvedKey) return;
			callback();
		});

	return useSyncExternalStore(subscribe, getSnapshot);
}
