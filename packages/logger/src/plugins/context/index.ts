import type { Logger } from "@/core/logger";
import { createPlugin } from "@/lib";
import type { Plugin } from "@/types";
import { createSharedContextStore } from "./shared-store";
import type { Context, ContextStore } from "./types";

export type * from "./types"

/**
 * Options for {@link contextPlugin}.
 */
export interface ContextPluginOptions {
	/**
	 * Fields seeded into the store on creation and merged into every log entry
	 * as the baseline context.
	 *
	 * Typical use: static metadata that applies to all log entries in this
	 * process — service name, deployment environment, version.
	 *
	 * @example
	 * ```ts
	 * contextPlugin({ initial: { service: "payments-api", env: "production" } })
	 * ```
	 */
	initial?: Context;

	/**
	 * The backing store that holds and isolates context data.
	 *
	 * When omitted, a shared in-memory store ({@link createSharedContextStore})
	 * is used — suitable for React Native, edge runtimes without
	 * `AsyncLocalStorage`, and single-threaded scripts.
	 *
	 * For **concurrent web servers** (Node, Bun, Cloudflare Workers with
	 * `nodejs_compat`) pass {@link createAsyncLocalStorageContextStore} from
	 * `@padosoft/logger/plugins/context/als-store` so each in-flight request
	 * gets its own isolated context.
	 *
	 * You can also supply a custom implementation of the {@link ContextStore}
	 * interface for testing or specialised environments.
	 *
	 * @example Use the ALS store for a concurrent server:
	 * ```ts
	 * import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context/als-store";
	 *
	 * logger.use(contextPlugin({
	 *   initial: { service: "api" },
	 *   store: createAsyncLocalStorageContextStore({ service: "api" }),
	 * }));
	 * ```
	 */
	store?: ContextStore;
}

/**
 * Plugin that attaches a per-request (or per-scope) context object to every
 * log entry, with no changes to existing logger call sites.
 *
 * ## How it works
 *
 * 1. On registration, the plugin enriches the logger with five methods:
 *    `setContext`, `patchContext`, `clearContext`, `getContext`, and
 *    `runWithContext`.
 * 2. At transform time (on every log call), the active context is read from the
 *    store and merged into the log entry under the `ctx` field.  Fields set
 *    directly on the log call (`logger.info("msg", { ctx: { … } })`) override
 *    store fields.
 * 3. The store strategy is pluggable: the default shared store is synchronous
 *    and safe everywhere; the ALS store provides request isolation for
 *    concurrent async environments.
 *
 * ## Choosing a store
 *
 * | Environment | Recommended store |
 * |---|---|
 * | React Native, edge runtimes without `AsyncLocalStorage` | default (shared) |
 * | CLI scripts, single-request tools | default (shared) |
 * | Concurrent Node / Bun / Cloudflare Workers servers | ALS store |
 *
 * See the [README](./README.md) for full examples.
 *
 * @param options - {@link ContextPluginOptions}
 * @returns A `Plugin<Logger>` ready to be passed to `logger.use(…)`.
 *
 * @example Minimal — shared store with static baseline fields:
 * ```ts
 * import { contextPlugin } from "@padosoft/logger/plugins/context";
 *
 * logger.use(contextPlugin({ initial: { service: "worker" } }));
 * logger.info("started"); // → { …, ctx: { service: "worker" } }
 * ```
 *
 * @example Concurrent server — ALS store + request middleware:
 * ```ts
 * import { contextPlugin } from "@padosoft/logger/plugins/context";
 * import { createAsyncLocalStorageContextStore } from "@padosoft/logger/plugins/context/als-store";
 *
 * logger.use(contextPlugin({
 *   initial: { service: "api" },
 *   store: createAsyncLocalStorageContextStore({ service: "api" }),
 * }));
 *
 * app.use("*", async (c, next) => {
 *   await logger.runWithContext!({ request_id: crypto.randomUUID() }, () => next());
 * });
 * ```
 */
export const contextPlugin = (
	options: ContextPluginOptions = {},
): Plugin<Logger> => {
	const store = options.store ?? createSharedContextStore(options.initial);

	return createPlugin({
		name: "context",
		transformEntry(_logger, entry) {
			// entry.ctx (per-call override) wins over store fields.
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
