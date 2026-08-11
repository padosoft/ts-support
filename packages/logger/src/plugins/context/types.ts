import type { Logger } from "@/core/logger";

export type Context = Record<string, unknown>;

// Module augmentation path: "../.." resolves to src/ (the package root) from
// this file's location at src/plugins/context/types.ts.
declare module "../.." {
	interface LogEntry {
		ctx?: Context;
	}

	interface Logger {
		setContext?<C extends Context>(ctx: Partial<C>): void;
		/** Merge partial fields into the current context (request-safe alternative to setContext). */
		patchContext?<C extends Context>(partial: Partial<C>): void;
		clearContext?(): void;
		getContext?<C extends Context>(): C;
		/**
		 * Run `fn` inside an isolated context scope seeded from `ctx`.
		 * With the default shared store this swaps synchronously and restores on exit.
		 * With the ALS store each concurrent request has its own isolated context.
		 */
		runWithContext?<T>(ctx: Context, fn: () => T): T;
	}
}

/**
 * Pluggable context store.  Implement this interface to swap the storage
 * strategy (e.g. AsyncLocalStorage for concurrent web servers).
 */
export interface ContextStore {
	get(): Context;
	/** Replace the entire current context (back-compat with old setContext). */
	set(ctx: Context): void;
	/** Merge partial fields into the current context. */
	patch(partial: Context): void;
	clear(): void;
	/** Run fn inside a new context scope seeded from ctx. */
	run<T>(ctx: Context, fn: () => T): T;
}
