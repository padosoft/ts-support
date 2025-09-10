/** biome-ignore-all lint/complexity/useLiteralKeys: needed to set attributes */
import {
	context,
	DiagConsoleLogger,
	DiagLogLevel,
	diag,
	trace,
} from "@opentelemetry/api";
import { type AnyValue, type AnyValueMap, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import {
	detectResources,
	envDetector,
	hostDetector,
	osDetector,
	processDetector,
	resourceFromAttributes,
	serviceInstanceIdDetector,
} from "@opentelemetry/resources";
import { LoggerProvider } from "@opentelemetry/sdk-logs";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { name, version } from "@/../package.json";
import { createTransport } from "@/lib/mods";
import type { Transport } from "@/types/mods";
import type { OpenTelemetryTransportOptions } from "./types";
import { createLogProcessor, mapLevelToSeverity } from "./utils";

/**
 * OpenTelemetry transport (portable: Node + Edge + RN).
 */
export const openTelemetryTransport = (
	options: OpenTelemetryTransportOptions,
): Transport => {
	const serviceName = options.service?.name || name;
	const serviceVersion = options.service?.version || version;

	if (options.debug) {
		diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
	}

	const detectedResources = detectResources({
		detectors: [
			envDetector,
			hostDetector,
			osDetector,
			processDetector,
			serviceInstanceIdDetector,
		],
	});

	const resources = resourceFromAttributes({
		[ATTR_SERVICE_NAME]: serviceName,
		[ATTR_SERVICE_VERSION]: serviceVersion,
		"deployment.environment": options.environment ?? "unknown",
	});

	const customResources = resourceFromAttributes(options.resources || {});
	const resource = detectedResources.merge(resources).merge(customResources);

	const exporter = new OTLPLogExporter({
		concurrencyLimit: 10,
		...options.httpExporterOptions,
	});

	const processors = options.exporters.map((exporter) =>
		createLogProcessor(exporter, options.processor),
	) || [createLogProcessor(exporter, options.processor)];

	const provider =
		options.loggerProvider ??
		new LoggerProvider({
			resource,
			processors,
		});

	logs.setGlobalLoggerProvider(provider);
	const otelLogger = provider.getLogger(serviceName, serviceVersion);

	return createTransport({
		name: "opentelemetry",
		async send(_logger, entry) {
			const severityNumber = mapLevelToSeverity(entry.level);
			const data = entry.data.join(" ");

			const attributes: AnyValueMap = {
				args: entry.data as AnyValue,
				time: entry.time.toISOString(),
			};

			const ctx = context.active();

			// capture trace context if available
			const span = trace.getSpan(ctx);
			const spanCtx = span?.spanContext();

			if (spanCtx) {
				attributes["trace_id"] = spanCtx.traceId;
				attributes["span_id"] = spanCtx.spanId;
				attributes["trace_flags"] = spanCtx.traceFlags;
			}

			otelLogger.emit({
				body: data,
				timestamp: entry.time,
				severityNumber,
				severityText: entry.level.toUpperCase(),
				attributes,
				context: ctx,
			});
		},
		async batch(logger, batch) {
			await Promise.allSettled(batch.map((e) => this.send(logger, e)));
		},
		async teardown() {
			await Promise.allSettled(processors.map((p) => p.shutdown()));
			logs.disable();
		},
	});
};
