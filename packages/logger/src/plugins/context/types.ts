import type { Logger } from "@/core/logger";

/**
 * Arbitrary key-value map attached to every log entry under the `ctx` field.
 *
 * Fields are merged from the active store into each log entry at transform time.
 * Fields set directly on a log-call (`logger.info("msg", { ctx: { … } })`) take
 * precedence over fields from the store, which is useful for one-off overrides.
 */
export type Context = Record<string, unknown>;

// Module augmentation: "../.." resolves to the package root (src/index.ts) from
// this file's location at src/plugins/context/types.ts.
declare module "../.." {
	interface LogEntry {
		/**
		 * Per-request / per-scope context fields automatically merged into every
		 * log entry by the context plugin.  Fields set here override fields from
		 * the active store (useful for one-off per-call overrides).
		 */
		ctx?: Context;
	}

	interface Logger {
		/**
		 * Replace the entire active context with `ctx`.
		 *
		 * With the default shared store this mutates the single global context
		 * object.  With the ALS store it replaces the context for the current
		 * async scope only — other concurrent scopes are unaffected.
		 *
		 * Prefer {@link patchContext} when you only need to add or update a few
		 * fields, especially inside a running request handler.
		 */
		setContext?<C extends Context>(ctx: Partial<C>): void;

		/**
		 * Merge `partial` into the active context without replacing other fields.
		 *
		 * Safe to call from anywhere inside a request handler (e.g. from an auth
		 * middleware after resolving the user ID) because it operates on the current
		 * ALS scope rather than a global object.
		 *
		 * @example
		 * ```ts
		 * // After resolving the authenticated user:
		 * logger.patchContext?.({ user_id: resolvedUserId });
		 * ```
		 */
		patchContext?<C extends Context>(partial: Partial<C>): void;

		/**
		 * Reset the active context to an empty object.
		 *
		 * With the ALS store this clears the context for the current scope only.
		 */
		clearContext?(): void;

		/**
		 * Return the active context for the current scope.
		 *
		 * With the ALS store this reads from the current async scope, so it is
		 * safe to call from any async continuation inside a `runWithContext` block.
		 * Returns the `initial` context (or `{}`) when called outside a scope.
		 *
		 * @returns A reference to the current context object.  Do not mutate it
		 *   directly — use {@link patchContext} or {@link setContext} instead.
		 */
		getContext?<C extends Context>(): C;

		/**
		 * Run `fn` inside an isolated context scope seeded from `ctx`.
		 *
		 * - **Shared store** — swaps the context synchronously and restores the
		 *   previous value on exit (both normal return and throw).  Safe for
		 *   synchronous call stacks and simple async scenarios, but concurrent
		 *   async tasks share the same store so they will see each other's writes.
		 * - **ALS store** — creates a new `AsyncLocalStorage` scope.  All async
		 *   continuations inside `fn` (including across `await` boundaries) see
		 *   the scoped context; other concurrent requests are fully isolated.
		 *
		 * @example
		 * ```ts
		 * // Hono middleware — wraps the rest of the chain in a request scope:
		 * app.use("*", async (c, next) => {
		 *   await logger.runWithContext!({ request_id: crypto.randomUUID() }, () => next());
		 * });
		 * ```
		 */
		runWithContext?<T>(ctx: Context, fn: () => T): T;
	}
}

/**
 * Pluggable context store interface.
 *
 * Implement this to swap the storage strategy used by `contextPlugin`.
 * Two implementations ship with this package:
 *
 * - {@link createSharedContextStore} — the default; safe for RN / edge runtimes.
 * - {@link createAsyncLocalStorageContextStore} — for per-request isolation in
 *   concurrent Node / Bun / Cloudflare Workers environments.
 *
 * You can also supply your own implementation for testing or custom environments
 * (e.g. a Zustand slice, a React context, or a simple `Map` keyed by tenant ID).
 *
 * @example Custom no-op store for testing:
 * ```ts
 * const noopStore: ContextStore = {
 *   get: () => ({}),
 *   set: () => {},
 *   patch: () => {},
 *   clear: () => {},
 *   run: (_ctx, fn) => fn(),
 * };
 * logger.use(contextPlugin({ store: noopStore }));
 * ```
 */
export interface ContextStore {
	/**
	 * Return the current context.
	 *
	 * Must be synchronous — it is called inside `transformEntry` on every log
	 * call.  With the ALS store this reads from the current async scope;
	 * calling it outside any `run()` scope returns the `initial` context.
	 */
	get(): Context;

	/**
	 * Replace the entire current context with `ctx`.
	 *
	 * Retained for back-compat with `setContext`.  Prefer {@link patch} for
	 * incremental updates.
	 */
	set(ctx: Context): void;

	/** Merge `partial` fields into the current context without replacing other fields. */
	patch(partial: Context): void;

	/** Reset the current context to an empty object. */
	clear(): void;

	/**
	 * Run `fn` inside a new context scope seeded from `ctx`.
	 *
	 * The implementation decides how isolation works:
	 * - Shared store: saves and restores the previous context around `fn()`.
	 * - ALS store: opens a new `AsyncLocalStorage` scope for `fn()` and all
	 *   async continuations spawned from it.
	 *
	 * @returns Whatever `fn()` returns (sync or a Promise).
	 */
	run<T>(ctx: Context, fn: () => T): T;
}
