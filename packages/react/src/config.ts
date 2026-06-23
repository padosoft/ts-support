import type { Configuration } from "@padosoft/utilities";
import { useSyncExternalStore } from "react";

/**
 * React hook that subscribes to a `Configuration<TConfig>` store via
 * `useSyncExternalStore`. Returns the full config when called with no key,
 * or a single field when called with a key.
 *
 * @example
 * // full config
 * const config = useConfig(myConfiguration);
 *
 * @example
 * // single field
 * const apiUrl = useConfig(myConfiguration, "apiUrl");
 */
export function useConfig<TConfig extends object>(
	configuration: Configuration<TConfig>,
): TConfig;
export function useConfig<TConfig extends object, K extends keyof TConfig>(
	configuration: Configuration<TConfig>,
	key: K,
): TConfig[K];
export function useConfig<TConfig extends object, K extends keyof TConfig>(
	configuration: Configuration<TConfig>,
	key?: K,
): TConfig | TConfig[K] {
	const config = useSyncExternalStore(
		configuration.subscribe,
		configuration.getSnapshot,
	);

	if (key === undefined) {
		return config;
	}

	return config[key];
}
