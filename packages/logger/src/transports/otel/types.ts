import type { LoggerProvider } from "@opentelemetry/api-logs";
import type { OTLPExporterNodeConfigBase } from "@opentelemetry/otlp-exporter-base";
import type { DetectedResourceAttributes } from "@opentelemetry/resources";
import type {
	LogRecordExporter,
	LogRecordProcessor,
} from "@opentelemetry/sdk-logs";

export interface OTELServiceOptions {
	name?: string;
	version?: string;
}

export type OTELLogProcessor = (
	_exporter: LogRecordExporter,
) => LogRecordProcessor;

export interface OpenTelemetryTransportOptions {
	service?: OTELServiceOptions;
	environment?: string;
	loggerProvider: LoggerProvider;
	processor?: "batch" | "simple" | OTELLogProcessor;
	debug?: boolean;
	httpExporterOptions?: OTLPExporterNodeConfigBase;
	resources?: DetectedResourceAttributes;
	exporters: LogRecordExporter[];
}
