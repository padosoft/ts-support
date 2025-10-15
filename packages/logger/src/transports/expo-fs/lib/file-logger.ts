import * as Application from "expo-application";
import * as FileSystem from "expo-file-system";

export interface FileLoggerOptions {
	filename: string;
}

export class FileLogger {
	private file: FileSystem.File | null = null;
	private handle: FileSystem.FileHandle | null = null;
	public readonly path: string;

	constructor(options: FileLoggerOptions) {
		const path = FileSystem.Paths.join(
			FileSystem.Paths.cache,
			Application.applicationName || "padosoft",
			options.filename,
		);

		this.path = path;
	}

	open(): void {
		if (this.handle) return;

		this.file = new FileSystem.File(this.path);
		if (!this.file.exists) {
			this.file.create({
				intermediates: true,
				overwrite: true,
			});
		}

		this.handle = this.file.open();
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

	readBytes(length: number): Uint8Array<ArrayBuffer> {
		if (!this.handle) throw new Error("Log file not open");
		return this.handle.readBytes(length);
	}

	readString(length: number): string {
		if (!this.handle) throw new Error("Log file not open");
		const bytes = this.handle.readBytes(length);
		return new TextDecoder().decode(bytes);
	}

	async readLogEntries(): Promise<string[]> {
		if (!this.handle) throw new Error("Log file not open");

		const content = await this.file?.text();
		if (!content) return [];
		return content.split("\n").filter((line) => line.trim().length > 0);
	}
}
