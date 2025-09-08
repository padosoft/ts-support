import {
	context,
	DiagConsoleLogger,
	DiagLogLevel,
	diag,
	trace,
} from "@opentelemetry/api";
import { type AnyValue, logs, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	BatchLogRecordProcessor,
	type LoggerProvider,
} from "@opentelemetry/sdk-logs";
import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types/logger";
import type { Transport } from "@/types/mods";

export interface OpenTelemetryTransportOptions {
	serviceName: string;
	serviceVersion?: string;
	environment?: string;
	loggerProvider: LoggerProvider;
	endpoint?: string; // default http://localhost:4318/v1/logs
}

/**
 * OpenTelemetry transport (portable: Node + Edge + RN).
 */
export const opentelemetryTransport = (
	options: OpenTelemetryTransportOptions,
): Transport => {
	// enable internal errors
	diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

	// resources
	const resource = resourceFromAttributes({
		"service.name": options.serviceName,
		"service.version": options.serviceVersion ?? "unknown",
		"deployment.environment": options.environment ?? "unknown",
	});

	const provider = new LoggerProvider({ resource });
	const exporter = new OTLPLogExporter({
		url: options.endpoint ?? "http://localhost:4318/v1/logs",
		concurrencyLimit: 10,
	});

	provider.addLogRecordProcessor(new BatchLogRecordProcessor(exporter));
	logs.setGlobalLoggerProvider(provider);

	const otelLogger = provider.getLogger(options.serviceName);

	const mapLevel = (level: LogEntry["level"]): SeverityNumber => {
		switch (level) {
			case "fatal":
				return SeverityNumber.FATAL;
			case "error":
				return SeverityNumber.ERROR;
			case "warn":
				return SeverityNumber.WARN;
			case "info":
				return SeverityNumber.INFO;
			case "success":
				return SeverityNumber.INFO;
			case "debug":
				return SeverityNumber.DEBUG;
			case "trace":
				return SeverityNumber.TRACE;
			default:
				return SeverityNumber.UNSPECIFIED;
		}
	};

	return createTransport({
		name: "opentelemetry",
		async send(_logger, entry) {
			const sev = mapLevel(entry.level);

			// capture trace context if available
			const span = trace.getSpan(context.active());
			const spanCtx = span?.spanContext();

			otelLogger.emit({
				body: entry.data.map((d) => String(d)).join(" "),
				severityNumber: sev,
				severityText: entry.level.toUpperCase(),
				attributes: {
					args: entry.data as AnyValue,
					time: entry.time.toISOString(),
					...(spanCtx && {
						trace_id: spanCtx.traceId,
						span_id: spanCtx.spanId,
						trace_flags: spanCtx.traceFlags,
					}),
				},
			});
		},
		async batch(logger, batch) {
			await Promise.allSettled(batch.map((e) => this.send(logger, e)));
		},
		async teardown() {
			await provider.shutdown(); // flush + close exporter
		},
	});
};
