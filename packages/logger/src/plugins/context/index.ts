import type { Logger } from "@/core/logger";
import { createPlugin } from "@/lib";
import type { Plugin } from "@/types";
import { createSharedContextStore } from "./shared-store";
import type { Context, ContextStore } from "./types";

// Re-export so consumers can import ContextStore/Context from the same subpath.
export type { Context, ContextStore };

export interface ContextPluginOptions {
	/** Initial context fields seeded into every log entry. */
	initial?: Context;
	/**
	 * Custom store implementation.  When omitted a shared in-memory store is used
	 * (React-Native / edge friendly but not request-isolated).
	 * Pass `createAsyncLocalStorageContextStore()` from `@padosoft/logger/plugins/context-als`
	 * for per-request isolation in concurrent Node/Bun environments.
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
