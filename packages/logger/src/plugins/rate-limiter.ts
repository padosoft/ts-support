import type { Logger } from "@/core/logger";
import type { LogLevel } from "@/lib/levels";
import { createPlugin } from "@/lib/mods";
import type { Plugin } from "@/types/mods";

export const rateLimiterPlugin = (ms: number): Plugin<Logger> => {
	let original: Logger["emit"];
	let last = 0;

	return createPlugin({
		name: "rate-limiter",
		enrichLogger(logger) {
			original = logger.emit.bind(logger);

			const emit: typeof logger.emit = (level: LogLevel, data: unknown[]) => {
				const now = Date.now();
				if (now - last < ms) return logger;
				last = now;

				return original(level, data);
			};

			logger.emit = emit;

			return logger;
		},
		teardown(logger) {
			logger.emit = original;

			return logger;
		},
	});
};
