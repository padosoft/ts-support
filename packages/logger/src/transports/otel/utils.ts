import { SeverityNumber } from "@opentelemetry/api-logs";
import type {
	LogRecordExporter,
	LogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
	BatchLogRecordProcessor,
	SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import type { LogEntry } from "@/types";
import type { OpenTelemetryTransportOptions } from "./types";

export const levelToSeverity: Record<LogEntry["level"], SeverityNumber> = {
	fatal: SeverityNumber.FATAL,
	error: SeverityNumber.ERROR,
	warn: SeverityNumber.WARN,
	info: SeverityNumber.INFO,
	success: SeverityNumber.INFO,
	debug: SeverityNumber.DEBUG,
	trace: SeverityNumber.TRACE,
};

export const mapLevelToSeverity = (
	level: LogEntry["level"],
): SeverityNumber => {
	return levelToSeverity[level] ?? SeverityNumber.UNSPECIFIED;
};

export const createLogProcessor = (
	exporter: LogRecordExporter,
	type: OpenTelemetryTransportOptions["processor"] = "batch",
): LogRecordProcessor => {
	const processors = {
		batch: BatchLogRecordProcessor,
		simple: SimpleLogRecordProcessor,
	};

	if (typeof type === "function") {
		return type(exporter);
	}

	return new processors[type](exporter);
};
