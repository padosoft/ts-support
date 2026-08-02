import { startTransition } from "react";

/**
 * A function that is called when a component is registered or unregistered.
 *
 * @param key - The key associated with the component.
 * @param component - The component that was registered or undefined if unregistered.
 */
export type RegistryListener = (
	key: string,
	component?: React.ComponentType,
) => void;

class ComponentRegistry {
	private registry = new Map<string, React.ComponentType>();
	private listeners = new Set<RegistryListener>();

	/**
	 * Resolves the key for a component using the provided key or its displayName.
	 *
	 * @param component - The component to register.
	 * @param key - Optional key to use for registration.
	 * @returns The resolved key.
	 * @throws Will throw if no key or displayName is provided.
	 */
	private resolveKey(component: React.ComponentType, key?: string): string {
		if (key) return key;
		if (component.displayName) return component.displayName;

		throw new Error(
			"Component key is required (either 'key' or 'displayName')",
		);
	}

	/**
	 * Attempts to find the correct key for a registered component.
	 *
	 * @param component - The component to search for.
	 * @param key - Optional key to use for the search.
	 * @returns The found key, or undefined.
	 */
	findKey(component: React.ComponentType, key?: string): string | undefined {
		if (key && this.registry.has(key)) {
			return key;
		}

		if (component.displayName && this.registry.has(component.displayName)) {
			return component.displayName;
		}

		return key ?? component.displayName;
	}

	/**
	 * Registers a component override with an optional key.
	 *
	 * @param component - The component to register.
	 * @param key - Optional key to associate with the component.
	 *
	 * @example
	 * ```ts
	 * // Register using component displayName
	 * componentRegistry.register(MyCustomButton);
	 *
	 * // Register using explicit key
	 * componentRegistry.register(MyCustomButton, 'Button');
	 * ```
	 */
	register(component: React.ComponentType, key?: string): void {
		const resolvedKey = this.resolveKey(component, key);

		this.registry.set(resolvedKey, component);
		this.notify(resolvedKey, component);
	}

	/**
	 * Unregisters a component by its key.
	 *
	 * @param key - The key of the component to remove.
	 *
	 * @example
	 * ```ts
	 * // Register using component displayName
	 * componentRegistry.unregister(MyCustomButton.displayName);
	 *
	 * // Register using explicit key
	 * componentRegistry.unregister('Button');
	 * ```
	 */
	unregister(key: string): void {
		if (!this.registry.has(key)) return;

		this.registry.delete(key);
		this.notify(key, undefined);
	}

	/**
	 * Retrieves a component by key if registered, otherwise returns the fallback component.
	 *
	 * @param fallback - The default component to use if no override is registered.
	 * @param key - Optional key to search for an override.
	 * @returns The registered component or the fallback.
	 *
	 * @example
	 * ```ts
	 * const Button = componentRegistry.get(DefaultButton, 'Button');
	 * ```
	 */
	// biome-ignore lint/suspicious/noExplicitAny: required for a type-safe implementation
	get<C extends React.ComponentType<any>>(fallback: C, key?: string): C {
		const foundKey = this.findKey(fallback, key);
		const resolved = foundKey ? this.registry.get(foundKey) : undefined;
		return (resolved as C) ?? fallback;
	}

	/**
	 * Subscribes a listener to component registration changes.
	 *
	 * @param listener - The listener function to call on updates.
	 * @returns A function to unsubscribe the listener.
	 *
	 * @example
	 * ```ts
	 * const unsubscribe = componentRegistry.subscribe((key, component) => {
	 *   console.log(`Component ${key} has been ${component ? 'registered' : 'unregistered'}`);
	 * });
	 *
	 * // Later when no longer needed
	 * unsubscribe();
	 * ```
	 */
	subscribe(listener: RegistryListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Lists all currently registered components.
	 *
	 * @returns A record of component keys and their corresponding components.
	 */
	list(): Record<string, React.ComponentType> {
		return Object.fromEntries(this.registry.entries());
	}

	/**
	 * Notifies all subscribed listeners about a change.
	 *
	 * @param key - The component key that changed.
	 * @param component - The new component or undefined if unregistered.
	 */
	private notify(key: string, component?: React.ComponentType) {
		startTransition(() => {
			for (const listener of this.listeners) {
				listener(key, component);
			}
		});
	}
}

export const componentRegistry: ComponentRegistry = new ComponentRegistry();
