import type { Client } from "openapi-fetch";
import type { MediaType } from "openapi-typescript-helpers";
import type { OpenApiPaths } from "../types";

/**
 * Splits the `cause` field out of an error-details object so it can be attached
 * to the native `Error` (`{ cause }`) instead of being stringified into the message.
 */
export function extractErrorCause(details: unknown): {
	cause: unknown;
	rest: unknown;
} {
	if (details && typeof details === "object" && "cause" in details) {
		const { cause, ...rest } = details as Record<string, unknown>;
		return { cause, rest };
	}
	return { cause: undefined, rest: details };
}

/**
 * `JSON.stringify` that never throws: handles BigInt and circular references,
 * falling back to `String(value)` when serialization is impossible.
 */
export function safeJSONStringify(value: unknown): string {
	const seen = new WeakSet();

	try {
		return JSON.stringify(value, (_key, val) => {
			if (typeof val === "bigint") {
				return val.toString();
			}

			if (val && typeof val === "object") {
				if (seen.has(val)) {
					return "[Circular]";
				}

				seen.add(val);
			}

			return val;
		});
	} catch {
		return String(value);
	}
}

export function isOpenApiFetchClient<Paths extends OpenApiPaths>(
	v: unknown,
): v is Client<Paths, MediaType> {
	return (
		!!v &&
		typeof v === "object" &&
		"GET" in v &&
		typeof (v as { GET: unknown }).GET === "function"
	);
}
