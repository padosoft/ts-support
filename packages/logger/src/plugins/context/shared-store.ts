import type { Context, ContextStore } from "./types";

/**
 * Default runtime-agnostic store: a single shared mutable object.
 *
 * Safe for React Native and edge runtimes that lack `node:async_hooks`.
 * `runWithContext` swaps the context synchronously and restores it on exit —
 * safe for synchronous use but NOT request-isolated under concurrent async
 * load.  For per-request isolation in concurrent Node/Bun environments use
 * `createAsyncLocalStorageContextStore` from `./als-store`.
 */
export function createSharedContextStore(initial: Context = {}): ContextStore {
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
