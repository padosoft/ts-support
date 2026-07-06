export interface ConfigOverride<
	TConfig extends object,
	K extends keyof TConfig = keyof TConfig,
> {
	key: K;
	override: (config: Readonly<TConfig>) => TConfig[K];
}

export function defineConfigOverride<
	TConfig extends object,
	K extends keyof TConfig,
>(
	key: K,
	override: ConfigOverride<TConfig, K>["override"],
): ConfigOverride<TConfig, K> {
	return { key, override };
}

/**
 * Framework-agnostic reactive configuration store.
 *
 * Holds a typed config object, applies a chain of overrides on construction
 * (and again on every `set`), and notifies subscribers on change.
 * `subscribe` and `getSnapshot` are arrow functions so they can be passed as
 * bare callbacks — e.g. directly to React's `useSyncExternalStore` — without
 * losing their `this` binding.
 *
 * @example
 * const configuration = new Configuration(defaultConfig, [
 *   overrideApiUrl,
 *   overrideDevtoolsEnabled,
 * ]);
 *
 * configuration.get("apiUrl");           // read once
 * configuration.set({ ...newConfig });   // update + notify subscribers
 */
export class Configuration<TConfig extends object> {
	protected overrides: ConfigOverride<TConfig>[] = [];
	protected config: TConfig;
	private listeners = new Set<() => void>();

	constructor(defaultConfig: TConfig) {
		this.config = defaultConfig;
	}

	protected applyOverrides(config: TConfig): TConfig {
		let result = { ...config };
		for (const entry of this.overrides) {
			result = { ...result, [entry.key]: entry.override(result) };
		}
		return result;
	}

	addOverride<K extends keyof TConfig>(override: ConfigOverride<TConfig, K>): void {
		this.overrides.push(override as ConfigOverride<TConfig>);
	}

	set(config: TConfig): void {
		this.config = this.applyOverrides(config);
		for (const listener of this.listeners) listener();
	}

	/**
	 * Registers a change listener and returns an unsubscribe function.
	 *
	 * Implemented as an arrow function so it can be passed as a bare callback
	 * (e.g. to `useSyncExternalStore`) without losing its `this` binding.
	 */
	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	/**
	 * Returns the current config snapshot.
	 *
	 * Implemented as an arrow function so it can be passed as a bare callback
	 * (e.g. to `useSyncExternalStore`) without losing its `this` binding.
	 */
	getSnapshot = (): TConfig => {
		return this.config;
	};

	get(): TConfig;
	get<K extends keyof TConfig>(key: K): TConfig[K];
	get<K extends keyof TConfig>(
		key: K,
		defaultValue: NonNullable<TConfig[K]>,
	): NonNullable<TConfig[K]>;
	/** Returns the full config, a single field, or a field with a fallback default. */
	get<K extends keyof TConfig>(
		key?: K,
		defaultValue?: NonNullable<TConfig[K]>,
	) {
		if (!key) return this.config;
		return this.config[key] ?? defaultValue;
	}
}
