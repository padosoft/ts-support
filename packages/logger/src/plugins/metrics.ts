import type { Logger } from "@/core/logger";
import { createPlugin, type LogLevel } from "@/lib";
import type { Plugin } from "@/types";

export interface Metrics extends Partial<Record<LogLevel, number>> {
	plugins: number;
	transports: number;
}

declare module ".." {
	interface Logger {
		getMetrics?(): Metrics;
	}
}

export interface MetricsPluginOptions {
	countLevels?: boolean;
}

export const metricsPlugin = (
	options: MetricsPluginOptions,
): Plugin<Logger> => {
	let originalEmit: Logger["emit"];
	let originalAddPlugin: Logger["addPlugin"];
	let originalAddTransport: Logger["addTransport"];

	const metrics: Metrics = {
		plugins: 0,
		transports: 0,
	};

	return createPlugin({
		name: "metrics",
		enrichLogger(logger) {
			metrics.plugins = logger.plugins.length;
			metrics.transports = logger.transports.length;

			originalEmit = logger.emit.bind(logger);
			originalAddPlugin = logger.addPlugin.bind(logger);
			originalAddTransport = logger.addTransport.bind(logger);

			const emit: typeof logger.emit = (level, data) => {
				metrics[level] = (metrics[level] ?? 0) + 1;
				return originalEmit(level, data);
			};

			const addPlugin: typeof logger.addPlugin = (plugin) => {
				metrics.plugins++;
				return originalAddPlugin(plugin);
			};

			const addTransport: typeof logger.addTransport = (transport) => {
				metrics.transports++;
				return originalAddTransport(transport);
			};

			logger.emit = options.countLevels ? emit : originalEmit;
			logger.addPlugin = addPlugin;
			logger.addTransport = addTransport;

			const getMetrics = () => {
				return metrics;
			};

			logger.getMetrics = getMetrics;

			return logger;
		},
	});
};
