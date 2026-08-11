import { AsyncLocalStorage } from "node:async_hooks";
import type { Context, ContextStore } from "./types";

/**
 * AsyncLocalStorage-backed context store for concurrent Node / Bun / Cloudflare
 * Workers environments (Workers require the `nodejs_compat` flag).
 *
 * Each `runWithContext(ctx, fn)` call propagates the context to all async
 * continuations inside `fn`, including across `await` boundaries, without
 * leaking into other concurrent requests.
 *
 * Do NOT import this in React Native or edge runtimes that lack
 * `node:async_hooks` — use `createSharedContextStore` from `./shared-store`
 * (the contextPlugin default) instead.
 *
 * @example
 * ```ts
 * import { contextPlugin } from "@padosoft/logger/plugins/context";
 * import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context-als";
 *
 * logger.use(contextPlugin({
 *   initial: { service: "api" },
 *   store: createAsyncLocalStorageContextStore({ service: "api" }),
 * }));
 *
 * // In a Hono middleware:
 * app.use("*", async (c, next) => {
 *   await logger.runWithContext!({ request_id: crypto.randomUUID() }, () => next());
 * });
 * ```
 */
export function createAsyncLocalStorageContextStore(
	initial: Context = {},
): ContextStore {
	const als = new AsyncLocalStorage<{ ctx: Context }>();

	return {
		get() {
			return als.getStore()?.ctx ?? { ...initial };
		},
		set(ctx) {
			const store = als.getStore();
			if (store) store.ctx = ctx;
		},
		patch(partial) {
			const store = als.getStore();
			if (store) store.ctx = { ...store.ctx, ...partial };
		},
		clear() {
			const store = als.getStore();
			if (store) store.ctx = {};
		},
		run<T>(ctx: Context, fn: () => T): T {
			return als.run({ ctx: { ...initial, ...ctx } }, fn);
		},
	};
}
