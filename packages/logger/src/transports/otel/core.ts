import type { LogLevel } from "@/lib/levels";
import {
	isPlainObject,
	normalizeErrors,
	serializeError,
} from "@/lib/serialize-error";

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

/**
 * Attribute keys of {@link serializeError} output that already have a
 * dedicated `exception.*` mapping; everything else is a custom enumerable
 * diagnostic field of the subclass (statusCode, code, ...).
 */
const ERROR_STANDARD_KEYS = new Set([
	"name",
	"message",
	"stack",
	"cause",
	"errors",
]);

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
			// Non-enumerable extras the plain mapping above drops: the
			// recursive `cause` chain, `AggregateError.errors`, and the
			// enumerable diagnostic fields of subclasses (statusCode, code,
			// ...) — kept so Grafana can filter on them.
			//
			// Kept as structures (like the `log.*` attributes below), NOT
			// stringified here: `redactAttributes` runs after `splitLogEntry`
			// and must recurse into them so a sensitive leaf nested in a
			// `cause` (e.g. `{ password }`) is redacted before it reaches the
			// backend. `serializeError` has already made them JSON-safe.
			const serialized = serializeError(value);
			if (serialized.cause !== undefined) {
				attributes["exception.cause"] = serialized.cause;
			}
			if (serialized.errors !== undefined) {
				attributes["exception.errors"] = serialized.errors;
			}
			for (const [key, extra] of Object.entries(serialized)) {
				if (ERROR_STANDARD_KEYS.has(key)) continue;
				attributes[`exception.${key}`] = extra;
			}
			continue;
		}
		if (isPlainObject(value)) {
			// Normalized first: a raw Error nested in the object would reach
			// both the attributes and the JSON body as `{}` — message/stack
			// are not enumerable.
			const normalized = normalizeErrors(value);
			const record = isPlainObject(normalized) ? normalized : value;
			for (const [key, nested] of Object.entries(record)) {
				attributes[`log.${key}`] = nested;
			}
			try {
				bodyParts.push(JSON.stringify(record));
			} catch {
				/* non-serializable — attributes still carry the data */
			}
			continue;
		}
		if (value !== null && value !== undefined) {
			attributes[`log.arg${extraIndex}`] = normalizeErrors(value);
			extraIndex += 1;
		}
	}

	return { attributes, body: bodyParts.join(" ") };
}
