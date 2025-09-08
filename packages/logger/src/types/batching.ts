import type { LogEntry } from "@/types/logger";

/**
 * Options that control batching behavior in the Logger.
 */
export interface BatchingOptions {
	/**
	 * Flush when buffer reaches this size.
	 * @example 10
	 */
	maxBatchSize: number;

	/**
	 * Also flush after this many milliseconds (if > 0).
	 * Disabled if `0` or undefined.
	 * @example 2000
	 */
	maxIntervalMs?: number | 0;

	/**
	 * Whether to flush remaining logs automatically on dispose/close.
	 * @default true
	 */
	flushOnDispose?: boolean;

	/**
	 * Drop the newest log when buffer is full instead of flushing immediately.
	 * @default false
	 */
	dropIfBufferFull?: boolean;
}

/**
 * Internal batching state, maintained per Logger.
 */
export interface BatchingState {
	/**
	 * Current buffer of entries waiting to be flushed.
	 */
	buf: LogEntry[];

	/**
	 * Reference to the currently scheduled timer, if any.
	 */
	timer: ReturnType<typeof setTimeout> | null;
}
