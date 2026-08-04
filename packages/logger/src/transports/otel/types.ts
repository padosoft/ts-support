export interface ProcessedLogRecord {
	body: string;
	attributes: Record<string, unknown>;
	level: string;
	severityNumber: number;
	severityText: string;
	timestamp: Date;
}

export interface OtelTransportOptions {
	/** Emit a processed log record to your OTel backend. Plug in either
	 *  Node SDK's `Logger.emit()` or react-native-otel's `OtelLogger.info()`. */
	emit: (record: ProcessedLogRecord) => void;

	/** Keys to redact (dot-notation, e.g. `"body.password"`).
	 *  Static array or dynamic resolver for runtime-configurable keys. */
	sensitiveKeys?: string[] | (() => string[]);

	/** Replace the default entry processor (`splitLogEntry` from core).
	 *  Controls how log args are split into body + attributes. */
	processEntry?: (
		data: unknown[],
	) => { body: string; attributes: Record<string, unknown> };

	/** Replace the default key-leaf redaction.
	 *  Receives attributes after `processEntry`, returns redacted version. */
	redact?: (
		attributes: Record<string, unknown>,
		sensitiveLeaves: Set<string>,
	) => Record<string, unknown>;

	/** Filter which log levels are forwarded to OTel.
	 *  Return `true` to emit, `false` to drop. Default: all levels pass. */
	shouldEmit?: (level: string) => boolean;

	/** Enrich every record with extra attributes before emission. */
	enrichAttributes?: (
		attributes: Record<string, unknown>,
		entry: { level: string; time: Date; data: unknown[] },
	) => Record<string, unknown>;

	/** Called when the transport itself fails.
	 *  Must NOT go through the application logger to avoid re-entrancy. */
	onError?: (error: unknown) => void;

	/** When `true`, the transport drops the record silently. */
	isDisabled?: () => boolean;

	/** Teardown hook called on logger shutdown. */
	teardown?: () => void | Promise<void>;
}
