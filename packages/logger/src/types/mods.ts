import type { Logger } from "@/core/logger";
import type { LogEntry } from "./logger";

export interface Mod<Tag extends string> {
	readonly _tag: Tag;
}

/**
 * A plugin can extend the Logger with transformations or enrichments.
 */
export interface Plugin<EnrichedLogger extends Logger = Logger>
	extends Mod<"plugin"> {
	/**
	 * Unique plugin name.
	 * @example "rate-limiter"
	 */
	name: string;

	/**
	 * Transform a log entry before it is emitted.
	 */
	transformEntry?(
		logger: EnrichedLogger,
		entry: LogEntry,
	): LogEntry | Promise<LogEntry>;

	/**
	 * Enrich the Logger instance with additional methods or props.
	 * May return sync or async.
	 */
	enrichLogger?(logger: Logger): EnrichedLogger | Promise<EnrichedLogger>;

	/**
	 * Cleanup called when logger closes.
	 * @property
	 */
	teardown?(logger: EnrichedLogger): Logger;

	/**
	 * Optional dispose hook (sync).
	 */
	[Symbol.dispose]?(): void;

	/**
	 * Optional dispose hook (async).
	 */
	[Symbol.asyncDispose]?(): Promise<void>;
}

/**
 * A transport is responsible for delivering log entries to a destination
 * (console, file, remote API, etc.).
 */
export interface Transport extends Mod<"transport"> {
	/**
	 * Unique transport name.
	 * @example "websocket"
	 */
	name: string;

	/**
	 * Send a single log entry.
	 * Called immediately unless batching is enabled.
	 */
	send(logger: Logger, entry: LogEntry): void | Promise<void>;

	/**
	 * Send a batch of log entries at once.
	 * Used if available when batching is enabled.
	 */
	batch?(logger: Logger, batch: LogEntry[]): void | Promise<void>;

	/**
	 * Optional cleanup invoked during logger shutdown.
	 */
	teardown?(logger: Logger): void | Promise<void>;

	/**
	 * Optional sync dispose hook.
	 */
	[Symbol.dispose]?(): void;

	/**
	 * Optional async dispose hook.
	 */
	[Symbol.asyncDispose]?(): Promise<void>;
}
