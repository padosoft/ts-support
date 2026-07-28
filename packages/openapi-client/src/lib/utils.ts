/**
 * Splits the `cause` field out of an error-details object so it can be attached
 * to the native `Error` (`{ cause }`) instead of being stringified into the message.
 */
export function extractErrorCause(details: unknown): { cause: unknown; rest: unknown } {
	if (details && typeof details === "object" && "cause" in details) {
		const { cause, ...rest } = details as Record<string, unknown>;
		return { cause, rest };
	}
	return { cause: undefined, rest: details };
}
