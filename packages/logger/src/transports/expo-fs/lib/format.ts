import {
	normalizeErrors,
	normalizeLogEntryErrors,
} from "@/lib/serialize-error";
import type { LogEntry } from "@/types";

export interface FormatLogEntryOptions {
	raw?: boolean | undefined;
	timestamp: (date: Date) => string;
}

/**
 * Pure formatter for the expo-fs transport, extracted from the transport
 * factory so it can be unit tested without the native expo-file-system /
 * expo-application dependencies.
 *
 * Errors are normalized before `JSON.stringify`: `message`/`stack`/`name`
 * are not enumerable, so a raw Error used to reach the log file as `{}` —
 * the anonymous-crash case of padosoft/gescat-mobile-app#572, where the
 * ErrorBoundary crashes arrived in `app.log` with no message.
 */
export const formatLogEntry = (
	entry: LogEntry,
	options: FormatLogEntryOptions,
): string => {
	if (options.raw) {
		try {
			return JSON.stringify(normalizeLogEntryErrors(entry));
		} catch {
			return String(entry);
		}
	}

	const messages = [
		options.timestamp(entry.time),
		`[${entry.level.toUpperCase()}]`,
	];

	const prefix = messages.filter((s) => s.trim().length).join(" ");
	const formattedArgs = (entry.data ?? []).map((a) => {
		if (!a) return "";

		if (
			typeof a === "string" ||
			typeof a === "number" ||
			typeof a === "boolean"
		) {
			return a.toString().trim();
		}

		const normalized = normalizeErrors(a);
		try {
			return JSON.stringify(normalized);
		} catch {
			return String(normalized);
		}
	});

	return [prefix, ...formattedArgs].filter((s) => s.trim().length).join(" ");
};
