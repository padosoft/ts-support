import { AsyncLocalStorage } from "node:async_hooks";
import type { Context, ContextStore } from "./types";

/**
 * Create an `AsyncLocalStorage`-backed context store for per-request isolation
 * in concurrent Node / Bun / Cloudflare Workers environments.
 *
 * ## When to use
 *
 * This is the right store for any **concurrent async server** where multiple
 * requests are in-flight at the same time (Express, Fastify, Hono, Elysia …).
 * The default shared store would let concurrent requests overwrite each other's
 * context; this store keeps each request's context completely isolated via
 * `AsyncLocalStorage`.
 *
 * Cloudflare Workers support `AsyncLocalStorage` when the `nodejs_compat`
 * compatibility flag is enabled.
 *
 * Do **not** import this file in React Native or edge runtimes that lack
 * `node:async_hooks` — use the default shared store (the `contextPlugin`
 * default when no `store` option is supplied) instead.
 *
 * ## How it works
 *
 * - `runWithContext(ctx, fn)` opens a new `AsyncLocalStorage` scope.  All async
 *   continuations spawned inside `fn` — including those resumed after `await`
 *   and callbacks — inherit that scope and see that request's context.
 * - `get()` reads from the current scope.  Called outside any `runWithContext`
 *   scope (e.g. at startup), it returns a copy of `initial`.
 * - `patch(partial)` merges fields into the **current scope only** — other
 *   concurrent scopes are unaffected.  This makes it safe to call from auth
 *   middleware or any async handler.
 * - `set(ctx)` replaces the current scope's context.  Has no effect outside a
 *   scope (there is no store to mutate).
 * - `clear()` resets the current scope's context to `{}`.
 *
 * @param initial - Baseline fields copied into every new scope created by
 *   `runWithContext`.  Also returned by `get()` when called outside any scope.
 * @returns A `ContextStore` backed by `AsyncLocalStorage`.
 *
 * @example Server setup (Hono):
 * ```ts
 * import { contextPlugin } from "@padosoft/logger/plugins/context";
 * import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context/als-store";
 *
 * // Register once at startup, before mounting any routes:
 * logger.use(contextPlugin({
 *   initial: { service: "api" },
 *   store: createAsyncLocalStorageContextStore({ service: "api" }),
 * }));
 *
 * // Middleware: wrap every request in its own ALS scope
 * app.use("*", async (c, next) => {
 *   await logger.runWithContext!({ request_id: crypto.randomUUID() }, () => next());
 * });
 *
 * // Auth middleware (runs inside the scope): enrich without replacing
 * app.use("/v1/*", authMiddleware(), async (c, next) => {
 *   logger.patchContext?.({ user_id: getAuthenticatedUserId(c) });
 *   await next();
 * });
 *
 * // Any log call anywhere in the request chain carries all context automatically:
 * app.get("/v1/items", async (c) => {
 *   logger.info("listing items");
 *   // → { service: "api", request_id: "…", user_id: 42, message: "listing items" }
 *   return c.json(await listItems());
 * });
 * ```
 *
 * @example Concurrent isolation (two simultaneous requests):
 * ```ts
 * async function handleRequest(id: string, delay: number) {
 *   await logger.runWithContext!({ request_id: id }, async () => {
 *     await sleep(delay); // another request may run here
 *     logger.patchContext?.({ processed: true });
 *     logger.info("done"); // always sees THIS request's context
 *   });
 * }
 *
 * // These run concurrently; neither sees the other's request_id:
 * await Promise.all([handleRequest("req-A", 10), handleRequest("req-B", 5)]);
 * ```
 */
export function createAsyncLocalStorageContextStore(
	initial: Context = {},
): ContextStore {
	const als = new AsyncLocalStorage<{ ctx: Context }>();

	return {
		get() {
			// Falls back to a copy of initial when called outside any runWithContext
			// scope (e.g. at startup or in background tasks that never called run()).
			return als.getStore()?.ctx ?? { ...initial };
		},
		set(ctx) {
			const store = als.getStore();
			if (store) store.ctx = ctx;
			// Silent no-op outside a scope (no global state to mutate).
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
			// Spread initial first so that run-time ctx overrides it, but initial
			// fields are always present as a baseline in every scope.
			return als.run({ ctx: { ...initial, ...ctx } }, fn);
		},
	};
}
