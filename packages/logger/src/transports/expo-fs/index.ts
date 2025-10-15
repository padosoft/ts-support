import { makeTimestamp } from "@/lib/format";
import type { LogLevel } from "@/lib/levels";
import { createTransport } from "@/lib/mods";
import type { TimestampType } from "@/types/format";
import type { Transport } from "@/types/mods";
import { FileLogger } from "./lib/file-logger";

export let expoFileLogger: FileLogger | null = null;

export interface ExpoFileSystemTransportOptions {
	filename?: string;
	timestamp?: TimestampType;
}

export const expoFileSystemTransport = (
	options: ExpoFileSystemTransportOptions = {
		timestamp: "local",
	},
): Transport => {
	const filename = options.filename ?? "app.log";
	const selectedTimestamp = options.timestamp ?? "local";
	const timestamp = makeTimestamp(selectedTimestamp);

	expoFileLogger = new FileLogger({
		filename,
	});
	expoFileLogger.open();

	const format = (level: LogLevel, args: unknown[]) => {
		const now = new Date();

		const messages = [timestamp(now), `[${level.toUpperCase()}]`];

		const prefix = messages.filter((s) => s.length).join(" ");
		return [prefix, ...args];
	};

	return createTransport({
		name: "expo-fs",
		send: (_logger, entry) => {
			const out = format(entry.level, entry.data).join(" ");
			expoFileLogger?.append(out);
		},
		batch(_logger, batch) {
			const out = batch
				.map((entry) => format(entry.level, entry.data).join(" "))
				.join("\n");
			expoFileLogger?.append(out);
		},
		[Symbol.dispose]() {
			expoFileLogger?.close();
		},
		async [Symbol.asyncDispose]() {
			expoFileLogger?.close();
		},
	});
};
