import { useComponentOverride } from "./use-component-override";

function resolveDisplayName(component: React.ComponentType): string | undefined {
	return (
		component.displayName ??
		// Access inner component for React.memo wrappers — memo stores the original on .type
		(component as { type?: React.ComponentType }).type?.displayName ??
		component.name
	);
}

/**
 * HOC that makes a component automatically check the component registry for an override
 * at render time, falling back to the wrapped component when no override is registered.
 *
 * Apply at definition time so all usage sites benefit without any per-call boilerplate.
 * The registry key is resolved from the component's `displayName` (or `name`), so
 * `displayName` must be set on the component passed as `WrappedComponent`.
 *
 * Works with `memo()`-wrapped components: `displayName` is read via `.type` on the
 * memo wrapper, so `composeHOCs(Base)(withComponentOverride, memo)` works correctly
 * as long as `Base.displayName` is set.
 *
 * @param WrappedComponent - The default component to render when no override is registered.
 * @param key - Optional explicit registry key. Defaults to the component's `displayName`.
 *
 * @example
 * ```tsx
 * const ButtonImpl = memo(() => <Pressable>...</Pressable>);
 * ButtonImpl.displayName = "Button";
 *
 * export const Button = withComponentOverride(ButtonImpl);
 * // All <Button /> usages now automatically use the registry override if registered.
 *
 * // White-label override:
 * componentRegistry.register(LVRButton, "Button");
 * ```
 */
export function withComponentOverride<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	key?: string,
): React.ComponentType<P> {
	const resolvedName =
		key ?? resolveDisplayName(WrappedComponent) ?? "Component";

	const WithOverride = (props: P) => {
		const Component = useComponentOverride(WrappedComponent, key ?? resolvedName);
		return <Component {...props} />;
	};

	WithOverride.displayName = resolvedName;
	return WithOverride;
}
