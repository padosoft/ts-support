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
		clearContext?(): void;
		getContext?<C extends Context>(): C;
	}
}

export interface ContextPluginOptions {
	initial: Record<string, unknown>;
}

export const contextPlugin = (
	options: ContextPluginOptions,
): Plugin<Logger> => {
	let ctx = { ...options.initial };

	return createPlugin({
		name: "context",
		transformEntry(_logger, entry) {
			const context = { ...ctx, ...entry.ctx };
			return { ...entry, ctx: context };
		},
		enrichLogger(logger) {
			const setContext = (newCtx: Record<string, unknown>) => {
				ctx = newCtx;
			};

			const clearContext = () => {
				ctx = {};
			};

			const getContext = <C extends Context>(): C => {
				return ctx as C;
			};

			logger.setContext = setContext;
			logger.clearContext = clearContext;
			logger.getContext = getContext;

			return logger;
		},
	});
};
