import { makeTimestamp } from "@/lib/format";
import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types";
import type { TimestampType } from "@/types/format";
import type { Transport } from "@/types/mods";
import { LOG_FILE_SEPARATOR } from "./lib/constants";
import { FileLogger } from "./lib/file-logger";
import { formatLogEntry } from "./lib/format";

export let expoFileLogger: FileLogger | null = null;

export interface ExpoFileSystemTransportOptions {
	filename?: string;
	timestamp?: TimestampType;
	raw?: boolean;
	cleanOnStart?: boolean;
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

	// Extracted to ./lib/format (pure, testable without native deps); it
	// normalizes Errors so they no longer reach the file as `{}`.
	const format = (entry: LogEntry) =>
		formatLogEntry(entry, { raw: options.raw, timestamp });

	return createTransport({
		name: "expo-fs",
		send: (_logger, entry) => {
			const out = format(entry);
			expoFileLogger?.append(out);
		},
		batch(_logger, batch) {
			const out = batch.map((entry) => format(entry)).join(LOG_FILE_SEPARATOR);
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
