import { makeTimestamp } from "@/lib/format";
import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types";
import type { TimestampType } from "@/types/format";
import type { Transport } from "@/types/mods";
import { FileLogger } from "./lib/file-logger";

export let expoFileLogger: FileLogger | null = null;

export interface ExpoFileSystemTransportOptions {
	filename?: string;
	timestamp?: TimestampType;
	raw?: boolean;
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

	const format = (entry: LogEntry) => {
		if (options.raw) {
			try {
				return JSON.stringify(entry);
			} catch {
				return String(entry);
			}
		}

		const messages = [timestamp(entry.time), `[${entry.level.toUpperCase()}]`];

		const prefix = messages.filter((s) => s.trim().length).join(" ");
		const formattedArgs = entry.data?.map?.((a) => {
			if (!a) return "";

			if (
				typeof a === "string" ||
				typeof a === "number" ||
				typeof a === "boolean"
			) {
				return a.toString().trim();
			}

			try {
				return JSON.stringify(a);
			} catch {
				return String(a);
			}
		});

		return [prefix, ...formattedArgs].filter((s) => s.trim().length).join(" ");
	};

	return createTransport({
		name: "expo-fs",
		send: (_logger, entry) => {
			const out = format(entry);
			expoFileLogger?.append(out);
		},
		batch(_logger, batch) {
			const out = batch.map((entry) => format(entry)).join("\n");
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
