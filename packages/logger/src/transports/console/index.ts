import { makeTimestamp } from "@/lib/format";
import type { LogLevel } from "@/lib/levels";
import { createTransport } from "@/lib/mods";
import {
	type ColorFn,
	colors,
	getLevelColor,
} from "@/transports/console/lib/colors";
import { symbolize } from "@/transports/console/lib/symbols";
import type { TimestampType } from "@/types/format";
import type { Transport } from "@/types/mods";
import { consoleMethods } from "./lib/utils";

export interface ConsoleTransportOptions {
	timestamp?: TimestampType;
	symbols?: boolean;
	colors?: boolean;
	level?: boolean;
}

export const consoleTransport = (
	options: ConsoleTransportOptions = {
		timestamp: "local",
		colors: true,
		symbols: true,
		level: true,
	},
): Transport => {
	const colorize = (color: ColorFn, s: string) =>
		options.colors ? color(s) : s;

	const selectedTimestamp = options.timestamp ?? "local";
	const timestamp = makeTimestamp(selectedTimestamp);

	const format = (level: LogLevel, args: unknown[]) => {
		const symbolsEnabled = options.symbols ?? true;
		const symbol = symbolsEnabled ? symbolize(level) : null;

		const color = getLevelColor(level);
		const now = new Date();

		const messages = [
			colorize(colors.gray, timestamp(now)),
			symbol ? colorize(color, symbol) : "",
		];

		const hasLevel = options.level ?? true;
		if (hasLevel) {
			messages.push(`[${colorize(color, level.toUpperCase())}]`);
		}

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
