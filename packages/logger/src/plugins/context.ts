import type { Logger } from "@/core/logger";
import { createPlugin } from "@/lib";
import type { Plugin } from "@/types";

export type Context = Record<string, unknown>;

declare module ".." {
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

/** Default runtime-agnostic store: single shared mutable object (safe for RN / edge runtimes without AsyncLocalStorage). */
function createSharedContextStore(initial: Context = {}): ContextStore {
	let ctx: Context = { ...initial };
	return {
		get() {
			return ctx;
		},
		set(newCtx) {
			ctx = newCtx;
		},
		patch(partial) {
			ctx = { ...ctx, ...partial };
		},
		clear() {
			ctx = {};
		},
		run<T>(newCtx: Context, fn: () => T): T {
			const prev = ctx;
			ctx = { ...ctx, ...newCtx };
			try {
				return fn();
			} finally {
				ctx = prev;
			}
		},
	};
}

export interface ContextPluginOptions {
	/** Initial context fields seeded into every log entry. */
	initial?: Context;
	/**
	 * Custom store implementation.  When omitted a shared in-memory store is used
	 * (React-Native / edge friendly but not request-isolated).
	 * Pass `createAsyncLocalStorageContextStore()` from `@padosoft/logger/plugins/context-als`
	 * for per-request isolation in concurrent Node/Bun/Workers environments.
	 */
	store?: ContextStore;
}

export const contextPlugin = (
	options: ContextPluginOptions = {},
): Plugin<Logger> => {
	const store = options.store ?? createSharedContextStore(options.initial);

	return createPlugin({
		name: "context",
		transformEntry(_logger, entry) {
			const context = { ...store.get(), ...entry.ctx };
			return { ...entry, ctx: context };
		},
		enrichLogger(logger) {
			logger.setContext = (newCtx) => store.set(newCtx as Context);
			logger.patchContext = (partial) => store.patch(partial as Context);
			logger.clearContext = () => store.clear();
			logger.getContext = <C extends Context>() => store.get() as C;
			logger.runWithContext = <T>(ctx: Context, fn: () => T) =>
				store.run(ctx, fn);
			return logger;
		},
	});
};
