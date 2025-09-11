import { type LogLevel, LogLevels, LogLevelsValues } from "@/lib/levels";
import type { BatchingOptions, BatchingState } from "@/types/batching";
import type { LogEntry, LoggerOptions } from "@/types/logger";
import type { Plugin, Transport } from "@/types/mods";

export class Logger {
	protected level: LogLevel;
	public readonly transports: Transport[];
	public readonly plugins: Plugin[];
	protected batching?: BatchingOptions | undefined;
	protected batchingState: BatchingState;

	constructor(opts: LoggerOptions = {}) {
		this.level = opts.level ?? LogLevels.INFO;
		this.transports = opts.transports ?? [];
		this.plugins = opts.plugins ?? [];
		this.batching = opts.batching ? opts.batching : undefined;
		this.batchingState = { buf: [], timer: null };

		Promise.allSettled(this.plugins.map((p) => p.enrichLogger?.(this)));
	}

	addPlugin(plugin: Plugin): this {
		this.plugins.push(plugin);
		plugin.enrichLogger?.(this);

		return this;
	}

	addTransport(transport: Transport): this {
		this.transports.push(transport);
		return this;
	}

	use(mod: Transport | Plugin): this {
		if (mod._tag === "plugin") {
			return this.addPlugin(mod);
		}

		if (mod._tag === "transport") {
			return this.addTransport(mod);
		}

		return this;
	}

	setLevel(level: LogLevel): this {
		this.level = level;
		return this;
	}

	setBatching(options: BatchingOptions | null): this {
		this.batching = options ?? undefined;
		return this;
	}

	protected shouldLog(level: LogLevel): boolean {
		const logLevel = LogLevelsValues[level];
		const currentLevel = LogLevelsValues[this.level];

		return logLevel >= currentLevel;
	}

	protected async applyTransforms(entry: LogEntry): Promise<LogEntry> {
		let transformed: LogEntry | Promise<LogEntry> = entry;

		for (const plugin of this.plugins) {
			if (!plugin.transformEntry) continue;

			transformed = await plugin.transformEntry(this, transformed);
		}

		return transformed;
	}

	protected async handleEntry(entry: LogEntry): Promise<void> {
		const transformed = await this.applyTransforms(entry);

		if (!this.batching || this.batching.maxBatchSize <= 1) {
			Promise.allSettled(this.transports.map((t) => t.send(this, transformed)));
			return;
		}

		if (
			this.batching.dropIfBufferFull &&
			this.batchingState.buf.length >= this.batching.maxBatchSize
		) {
			return; // drop newest
		}

		this.batchingState.buf.push(transformed);

		if (this.batchingState.buf.length >= this.batching.maxBatchSize) {
			return this.flush();
		}

		if (this.batching.maxIntervalMs && this.batching.maxIntervalMs > 0) {
			this.scheduleTimer();
		}
	}

	emit(level: LogLevel, data: unknown[]): this {
		if (!this.shouldLog(level)) return this;

		const entry: LogEntry = { level, time: new Date(), data };
		void this.handleEntry(entry);
		return this;
	}

	trace = (...a: unknown[]): this => this.emit(LogLevels.TRACE, a);
	debug = (...a: unknown[]): this => this.emit(LogLevels.DEBUG, a);
	info = (...a: unknown[]): this => this.emit(LogLevels.INFO, a);
	success = (...a: unknown[]): this => this.emit(LogLevels.SUCCESS, a);
	warn = (...a: unknown[]): this => this.emit(LogLevels.WARN, a);
	error = (...a: unknown[]): this => this.emit(LogLevels.ERROR, a);
	fatal = (...a: unknown[]): this => this.emit(LogLevels.FATAL, a);

	assert(cond: boolean, ...a: unknown[]): this {
		if (!cond) this.error("Assertion failed:", ...a);
		return this;
	}

	table(data: unknown): this {
		console.table?.(data);
		return this;
	}

	clear(): this {
		console.clear?.();
		return this;
	}
	clone(extra?: Partial<LoggerOptions>): Logger {
		const merged: LoggerOptions = {
			level: this.level,
			transports: this.transports,
			plugins: this.plugins,
			...extra,
		};

		return new Logger(merged);
	}
	async close(): Promise<void> {
		const shouldFlush = this.batching?.flushOnDispose ?? true;
		if (shouldFlush) {
			await this.flush();
		}

		await Promise.all(
			this.transports.map((t) => {
				this.transports.pop();
				return t.teardown?.(this);
			}),
		);
		await Promise.all(
			this.plugins.map((p) => {
				this.plugins.pop();
				return p.teardown?.(this);
			}),
		);

		this.clearTimer();
	}

	[Symbol.asyncDispose](): Promise<void> {
		return this.close();
	}

	[Symbol.dispose](): void {
		this.close();
		return;
	}

	private clearTimer() {
		if (!this.batchingState.timer) return;

		clearTimeout(this.batchingState.timer);
		this.batchingState.timer = null;
	}

	private scheduleTimer() {
		if (!this.batching?.maxIntervalMs || this.batchingState.timer) return;

		this.batchingState.timer = setTimeout(() => {
			void this.flush();
		}, this.batching.maxIntervalMs);
	}

	async flush(): Promise<void> {
		if (this.batchingState.buf.length === 0) return;

		await Promise.allSettled(
			this.transports.map((t) => {
				if (typeof t.batch === "function") {
					return t.batch(this, this.batchingState.buf);
				}

				return Promise.all(
					this.batchingState.buf.map((entry) => t.send(this, entry)),
				);
			}),
		);

		this.batchingState.buf = [];
		this.clearTimer();
	}
}
