import * as FileSystem from "expo-file-system";

export interface FileLoggerOptions {
	path: string;
}

export class FileLogger {
	private handle: FileSystem.FileHandle | null = null;
	private readonly path: string;

	constructor(options: FileLoggerOptions) {
		this.path = options.path;
	}

	open(): void {
		if (this.handle) return;

		const file = new FileSystem.File(this.path);
		if (!file.exists) {
			file.create();
		}

		this.handle = file.open();
	}

	append(line: string): void {
		if (!this.handle) throw new Error("Log file not open");

		const bytes = new TextEncoder().encode(`${line}\n`);
		this.handle.writeBytes(bytes);
	}

	close(): void {
		if (!this.handle) return;

		this.handle.close();
		this.handle = null;
	}
}
