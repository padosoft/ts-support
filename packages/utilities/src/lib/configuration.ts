export interface ConfigOverride<TConfig extends object, K extends keyof TConfig = keyof TConfig> {
	key: K;
	override: (config: Readonly<TConfig>) => TConfig[K];
}

export function defineConfigOverride<TConfig extends object, K extends keyof TConfig>(
	key: K,
	override: ConfigOverride<TConfig, K>["override"],
): ConfigOverride<TConfig, K> {
	return { key, override };
}

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

	addOverride<K extends keyof TConfig>(override: ConfigOverride<TConfig, K>) {
		this.overrides.push(override as ConfigOverride<TConfig>);
	}

	set(config: TConfig) {
		this.config = this.applyOverrides(config);
		for (const listener of this.listeners) listener();
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = (): TConfig => this.config;

	get(): TConfig;
	get<K extends keyof TConfig>(key: K): TConfig[K];
	get<K extends keyof TConfig>(key: K, defaultValue: NonNullable<TConfig[K]>): NonNullable<TConfig[K]>;
	get<K extends keyof TConfig>(key?: K, defaultValue?: NonNullable<TConfig[K]>) {
		if (!key) return this.config;
		return this.config[key] ?? defaultValue;
	}
}
