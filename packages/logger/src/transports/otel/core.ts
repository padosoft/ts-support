import type { LogLevel } from "@/lib/levels";

const MAX_REDACTION_DEPTH = 4;

export const OtelSeverityNumber = {
	UNSPECIFIED: 0,
	TRACE: 1,
	DEBUG: 5,
	INFO: 9,
	WARN: 13,
	ERROR: 17,
	FATAL: 21,
} as const;

export const levelToSeverityNumber: Record<LogLevel, number> = {
	trace: OtelSeverityNumber.TRACE,
	debug: OtelSeverityNumber.DEBUG,
	info: OtelSeverityNumber.INFO,
	success: OtelSeverityNumber.INFO,
	warn: OtelSeverityNumber.WARN,
	error: OtelSeverityNumber.ERROR,
	fatal: OtelSeverityNumber.FATAL,
};

export type OtelSinkMethod =
	| "trace"
	| "debug"
	| "info"
	| "warn"
	| "error"
	| "fatal";

const LEVEL_TO_SINK_METHOD: Record<string, OtelSinkMethod> = {
	debug: "debug",
	error: "error",
	fatal: "fatal",
	info: "info",
	success: "info",
	trace: "trace",
	warn: "warn",
};

export function severityMethodFor(level: string): OtelSinkMethod {
	return LEVEL_TO_SINK_METHOD[level] ?? "info";
}

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		!(value instanceof Error)
	);
}

function leafOf(key: string): string {
	return key.slice(key.lastIndexOf(".") + 1).toLowerCase();
}

export function sensitiveLeafKeys(sensitiveKeys: string[]): Set<string> {
	const leaves = new Set<string>();
	for (const key of sensitiveKeys) {
		const leaf = leafOf(key);
		if (leaf) {
			leaves.add(leaf);
		}
	}
	return leaves;
}

export function redactAttributes(
	attributes: Record<string, unknown>,
	sensitiveLeaves: Set<string>,
	depth = 0,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(attributes)) {
		if (sensitiveLeaves.has(leafOf(key))) {
			result[key] = "[REDACTED]";
			continue;
		}
		if (depth >= MAX_REDACTION_DEPTH) {
			result[key] = value;
			continue;
		}
		if (Array.isArray(value)) {
			result[key] = value.map((item) =>
				isPlainObject(item)
					? redactAttributes(item, sensitiveLeaves, depth + 1)
					: item,
			);
			continue;
		}
		if (!isPlainObject(value)) {
			result[key] = value;
			continue;
		}
		result[key] = redactAttributes(value, sensitiveLeaves, depth + 1);
	}

	return result;
}

export function splitLogEntry(data: unknown[]): {
	body: string;
	attributes: Record<string, unknown>;
} {
	const bodyParts: string[] = [];
	const attributes: Record<string, unknown> = {};
	let extraIndex = 0;

	for (const value of data) {
		if (typeof value === "string") {
			bodyParts.push(value);
			continue;
		}
		if (typeof value === "number" || typeof value === "boolean") {
			bodyParts.push(String(value));
			continue;
		}
		if (value instanceof Error) {
			bodyParts.push(value.message);
			attributes["exception.type"] = value.name;
			attributes["exception.message"] = value.message;
			if (value.stack) {
				attributes["exception.stacktrace"] = value.stack;
			}
			continue;
		}
		if (isPlainObject(value)) {
			for (const [key, nested] of Object.entries(value)) {
				attributes[`log.${key}`] = nested;
			}
			continue;
		}
		if (value !== null && value !== undefined) {
			attributes[`log.arg${extraIndex}`] = value;
			extraIndex += 1;
		}
	}

	return { attributes, body: bodyParts.join(" ") };
}
