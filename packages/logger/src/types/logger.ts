import type { LogLevel } from "@/lib/levels";
import type { BatchingOptions } from "./batching";
import type { Plugin, Transport } from "./mods";

/**
 * Represents a single log entry created by the Logger.
 */
export interface LogEntry {
	/**
	 * Timestamp when the entry was created.
	 */
	time: Date;

	/**
	 * Severity level of the entry.
	 */
	level: LogLevel;

	/**
	 * Arbitrary data passed by the user.
	 */
	data: unknown[];
}

/**
 * Options passed to the Logger constructor or clone.
 */
export interface LoggerOptions {
	/**
	 * Minimum severity level to emit.
	 * @default LogLevels.INFO
	 */
	level?: LogLevel;

	/**
	 * Destination transports where log entries will be delivered.
	 */
	transports?: Transport[];

	/**
	 * Plugins that can enrich logger or transform log entries.
	 */
	plugins?: Plugin[];

	/**
	 * Optional batching configuration.
	 */
	batching?: BatchingOptions;
}
