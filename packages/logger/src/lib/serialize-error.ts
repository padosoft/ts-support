import type { LogEntry } from "@/types/logger";

/**
 * Error → plain-object normalization for serializing transports.
 *
 * `message`, `stack` and `name` are NOT enumerable own properties of `Error`:
 * `JSON.stringify(new Error("boom"))` yields `"{}"`. Any transport that
 * serializes its arguments (expo-fs, file, http, ws, otel attributes) would
 * therefore deliver the failure anonymous — while the console renders Errors
 * just fine, which is exactly why raw-Error call sites go unnoticed until a
 * crash reaches the logs that matter with no message (real case:
 * padosoft/gescat-mobile-app#572, ErrorBoundary crashes logged as `{}`).
 *
 * `normalizeErrors` / `normalizeLogEntryErrors` are applied by every
 * serializing transport right before `JSON.stringify`, so ALL call sites —
 * including future ones — are safe by default, mirroring pino's `err`
 * serializer, winston's `format.errors` and the platform console. The console
 * and discord transports keep raw Errors on purpose: native rendering
 * (clickable stacks in dev tools) is strictly better there.
 */

/**
 * Depth cap for `cause` chains, `AggregateError.errors` and nested
 * containers. Mirrors `MAX_REDACTION_DEPTH` of the OTel transport.
 */
const MAX_DEPTH = 4;

/**
 * Keys extracted explicitly by {@link serializeError}: the enumerable
 * own-property loop must not overwrite them with a different representation.
 */
const RESERVED_KEYS = new Set(["name", "message", "stack", "cause", "errors"]);

export interface SerializedError {
	name: string;
	message: string;
	/** Stack trace, when available. */
	stack?: string;
	/** Recursive `Error.cause` chain (depth-capped). */
	cause?: unknown;
	/** `AggregateError.errors`, each member serialized (depth-capped). */
	errors?: unknown[];
	/**
	 * Custom enumerable own properties of `Error` subclasses (e.g.
	 * `statusCode`, `code`): primitives pass through, the rest is kept only
	 * if JSON-safe, otherwise degraded to `String(value)`.
	 */
	[key: string]: unknown;
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

/**
 * Keeps a value only if it survives `JSON.stringify` (circular structures,
 * bigints and throwing getters do not); degrades to `String(value)` so the
 * serialized error object as a whole always remains JSON-safe.
 */
const jsonSafe = (value: unknown): unknown => {
	try {
		JSON.stringify(value);
		return value;
	} catch {
		return String(value);
	}
};

const serializeNested = (value: unknown, depth: number): unknown => {
	if (value instanceof Error) {
		return depth < MAX_DEPTH ? serializeError(value, depth + 1) : String(value);
	}
	// A container (a `cause`, an `AggregateError` member, or a custom field) can
	// itself hold Errors: walk it so a nested Error becomes a serialized object
	// instead of the `{}` that `JSON.stringify` would emit for it. Depth-capped
	// exactly like the Error branch above.
	if (depth < MAX_DEPTH && (Array.isArray(value) || isPlainObject(value))) {
		return jsonSafe(normalizeErrors(value, depth));
	}
	return jsonSafe(value);
};

/**
 * Converts an `Error` into a plain object with only enumerable, JSON-safe
 * properties: `name` + `message` + `stack`, the recursive `cause` chain,
 * `AggregateError.errors`, and any custom enumerable diagnostic fields the
 * subclass carries (`statusCode`, `code`, ...).
 */
export const serializeError = (error: Error, depth = 0): SerializedError => {
	const serialized: SerializedError = {
		name: error.name,
		message: error.message,
	};

	if (error.stack) {
		serialized.stack = error.stack;
	}

	// `cause` is installed non-enumerable by the spec: read it explicitly.
	if ("cause" in error && error.cause !== undefined) {
		serialized.cause = serializeNested(error.cause, depth);
	}

	// `AggregateError.errors` is non-enumerable as well.
	if ("errors" in error && Array.isArray(error.errors)) {
		serialized.errors = error.errors.map((item) =>
			serializeNested(item, depth),
		);
	}

	// Subclasses often carry enumerable diagnostic fields (statusCode, code,
	// ...): before this module they were the only thing surviving
	// JSON serialization — keep them alongside message/stack.
	for (const [key, value] of Object.entries(error)) {
		if (RESERVED_KEYS.has(key) || value === undefined) continue;
		serialized[key] = serializeNested(value, depth);
	}

	return serialized;
};

/**
 * Identity-preserving walk that replaces every `Error` found in `value`
 * (bare, in arrays, or nested in plain objects, depth-capped) with its
 * {@link serializeError} form. Anything without Errors is returned as-is,
 * by reference, so non-Error data serializes exactly as before.
 */
export const normalizeErrors = (value: unknown, depth = 0): unknown => {
	if (value instanceof Error) {
		return serializeError(value, depth);
	}
	if (depth >= MAX_DEPTH) {
		return value;
	}
	if (Array.isArray(value)) {
		let changed = false;
		const mapped = value.map((item) => {
			const normalized = normalizeErrors(item, depth + 1);
			if (normalized !== item) changed = true;
			return normalized;
		});
		return changed ? mapped : value;
	}
	if (isPlainObject(value)) {
		let changed = false;
		const mapped: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			const normalized = normalizeErrors(item, depth + 1);
			if (normalized !== item) changed = true;
			mapped[key] = normalized;
		}
		return changed ? mapped : value;
	}
	return value;
};

/**
 * {@link normalizeErrors} applied to `entry.data`. Returns the SAME entry
 * object when no Error is found, so transports pay no cost on the common
 * path.
 */
export const normalizeLogEntryErrors = (entry: LogEntry): LogEntry => {
	let changed = false;
	const data = entry.data.map((value) => {
		const normalized = normalizeErrors(value);
		if (normalized !== value) changed = true;
		return normalized;
	});
	return changed ? { ...entry, data } : entry;
};
