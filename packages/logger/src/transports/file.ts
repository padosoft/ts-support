import type { OpenMode } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { mkdir, open } from "node:fs/promises";
import * as path from "node:path";
import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types";
import type { Transport } from "@/types/mods";

export interface FileTransportOptions {
	/**
	 * Full path to the log file.
	 */
	filePath: string;

	/**
	 * Optional flag to append to file (default is true).
	 */
	append?: boolean;

	/**
	 * Optional flag to write data in mode different than appen/write
	 */
	writeMode?: OpenMode;
}

export const fileTransport = (options: FileTransportOptions): Transport => {
	const writeMode: OpenMode = options.writeMode ?? (options.append ? "a" : "w");
	let file: FileHandle | null = null;

	const formatEntry = (entry: LogEntry): string => JSON.stringify(entry) + "\n";

	const ensureHandle = async () => {
		if (!file) {
			await mkdir(path.dirname(options.filePath), { recursive: true });
			file = await open(options.filePath, writeMode);
		}
		return file;
	};
	ensureHandle();

	return createTransport({
		name: "file",

		send(_logger, entry) {
			file?.write(formatEntry(entry));
		},

		batch(_logger, batch) {
			const data = batch.map(formatEntry).join("");
			file?.write(data);
		},

		async teardown() {
			file?.close();
		},

		[Symbol.dispose]() {
			this.teardown();
		},

		async [Symbol.asyncDispose]() {
			await this.teardown();
		},
	});
};
