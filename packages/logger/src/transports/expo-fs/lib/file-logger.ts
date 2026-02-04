import { applicationName } from "expo-application";
import { File, type FileHandle, Paths } from "expo-file-system";
import { LOG_FILE_SEPARATOR } from "./constants";

export interface FileLoggerOptions {
	filename: string;
	cleanOnStart?: boolean;
}

export class FileLogger {
	private file: File | null = null;
	private handle: FileHandle | null = null;
	private readonly cleanOnStart: boolean = false;
	public readonly path: string;

	constructor(options: FileLoggerOptions) {
		const path = Paths.join(
			Paths.cache,
			applicationName || "padosoft",
			options.filename,
		);

		this.path = path;
		this.cleanOnStart = options.cleanOnStart ?? false;
	}

	open(): void {
		if (this.handle) return;

		this.file = new File(this.path);
		if (this.cleanOnStart) {
			this.file.delete();
		}

		this.file.create({
			intermediates: true,
			overwrite: true,
		});

		this.handle = this.file.open();
	}

	append(line: string): void {
		if (!this.handle) throw new Error("Log file not open");

		const bytes = new TextEncoder().encode(`${line}${LOG_FILE_SEPARATOR}`);
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
		return content
			.split(LOG_FILE_SEPARATOR)
			.filter((line) => line.trim().length > 0);
	}
}
