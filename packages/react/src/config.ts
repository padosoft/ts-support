import { type ConfigOverride, Configuration } from "@padosoft/utilities";
import { useSyncExternalStore } from "react";

/**
 * React hook that subscribes to a `Configuration<TConfig>` store and
 * re-renders whenever its value changes.
 *
 * Backed by `useSyncExternalStore`, so reads are always consistent with the
 * latest committed state even under concurrent rendering.
 *
 * @param configuration - The configuration instance to subscribe to.
 * @param key - Optional key to select a single field. Omit to get the full config.
 * @returns The full config object, or the value of the selected field.
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

/**
 * Extends `Configuration` with a `useConfig` hook method so components can
 * call `configuration.useConfig("key")` directly instead of the standalone
 * `useConfig(configuration, "key")`.
 *
 * Lives in `@padosoft/react` so the `utilities` package stays React-free.
 *
 * @example
 * export const configuration = new ReactiveConfiguration(defaultConfig, [
 *   overrideApiUrl,
 *   overrideDevtoolsEnabled,
 * ]);
 *
 * // in a component:
 * const isDev = configuration.useConfig("enableDevtools");
 * const all   = configuration.useConfig();
 */
export class ReactiveConfiguration<
	TConfig extends object,
> extends Configuration<TConfig> {
	constructor(
		defaultConfig: TConfig,
		overrides: ConfigOverride<TConfig>[] = [],
	) {
		super(defaultConfig, overrides);
	}

	/**
	 * React hook that subscribes this configuration instance to the component
	 * and re-renders on change. Returns the full config or a single field.
	 *
	 * @param key - Optional field key. Omit to get the full config object.
	 *
	 * @example
	 * const isDev = configuration.useConfig("enableDevtools");
	 */
	useConfig(): TConfig;
	useConfig<K extends keyof TConfig>(key: K): TConfig[K];
	useConfig<K extends keyof TConfig>(key?: K): TConfig | TConfig[K] {
		return useConfig(this, key as K);
	}
}
