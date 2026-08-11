import type { Context, ContextStore } from "./types";

/**
 * Create a shared in-memory context store — the default used by `contextPlugin`
 * when no custom store is provided.
 *
 * ## When to use
 *
 * This store is the right choice for:
 * - **React Native** — `node:async_hooks` is not available.
 * - **Edge runtimes** (Cloudflare Workers without `nodejs_compat`, Vercel Edge)
 *   that also lack `AsyncLocalStorage`.
 * - **CLI tools and scripts** — there is only ever one execution context, so
 *   request isolation is not needed.
 * - **Unit tests** — simple, synchronous, no async setup required.
 *
 * ## Isolation behaviour
 *
 * All logger calls share a **single mutable context object**.  `runWithContext`
 * saves the previous context, runs `fn()` synchronously or as a single async
 * chain, then restores the previous context on exit (including on throw).
 *
 * This works correctly when requests are serialised, but is **not safe** under
 * concurrent async load: if two requests run `runWithContext` at the same time
 * and both `await` inside `fn`, the second call will overwrite the first's context
 * before the first's continuation resumes.  Use
 * {@link createAsyncLocalStorageContextStore} from `./als-store` instead.
 *
 * @param initial - Fields copied into the store on creation and treated as the
 *   baseline.  Subsequent calls to `setContext`, `patchContext`, or
 *   `runWithContext` stack on top of (or replace) this baseline.
 * @returns A `ContextStore` bound to a single shared object.
 *
 * @example Basic usage (scripts / RN):
 * ```ts
 * import { contextPlugin } from "@padosoft/logger/plugins/context";
 * import { createSharedContextStore } from "@padosoft/logger/plugins/context/shared-store";
 *
 * logger.use(contextPlugin({
 *   store: createSharedContextStore({ service: "my-script" }),
 * }));
 *
 * logger.info("started"); // ctx: { service: "my-script" }
 * logger.patchContext?.({ step: "fetch" });
 * logger.info("fetching"); // ctx: { service: "my-script", step: "fetch" }
 * ```
 *
 * @example runWithContext (synchronous scope):
 * ```ts
 * logger.setContext?.({ app: "cli" });
 *
 * logger.runWithContext?.({ task: "export" }, () => {
 *   logger.info("exporting"); // ctx: { app: "cli", task: "export" }
 * });
 *
 * logger.info("done"); // ctx: { app: "cli" } — task field is gone
 * ```
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
