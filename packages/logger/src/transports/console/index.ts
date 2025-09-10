import type { LogLevel } from "@/lib/levels";
import { createTransport } from "@/lib/mods";
import { colors, getLevelColor } from "@/transports/console/lib/colors";
import { symbolize } from "@/transports/console/lib/symbols";
import type { Transport } from "@/types/mods";
import { consoleMethods } from "./lib/utils";

export interface ConsoleTransportOptions {
	timestamp?: "iso" | "local" | ((date: Date) => string);
}

export const consoleTransport = (
	options: ConsoleTransportOptions = {
		timestamp: "local",
	},
): Transport => {
	const timestamp = (date: Date): string =>
		typeof options.timestamp === "function"
			? options.timestamp(date)
			: options.timestamp === "local"
				? date.toLocaleString()
				: date.toISOString();

	const format = (level: LogLevel, args: unknown[]) => {
		const symbol = symbolize(level);
		const color = getLevelColor(level);

		const now = new Date();

		const messages = [
			colors.gray(timestamp(now)),
			symbol ? color(symbol) : "",
			`[${color(level.toUpperCase())}]`,
		];

		const prefix = messages.filter((s) => s.length).join(" ");
		return [prefix, ...args];
	};

	return createTransport({
		name: "console",
		send: (_logger, entry) => {
			const out = format(entry.level, entry.data);
			const method = consoleMethods[entry.level] || "log";

			const func = console[method];
			return func(...out);
		},
		batch(logger, batch) {
			Promise.all(batch.map((e) => this.send(logger, e)));
			return;
		},
	});
};
