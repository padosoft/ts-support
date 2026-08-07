import { createTransport } from "@/lib/mods";
import type { Transport } from "@/types/mods";
import pkg from "../../../package.json";
import {
	levelToSeverityNumber,
	redactAttributes,
	sensitiveLeafKeys,
	splitLogEntry,
} from "./core";
import type { OtelTransportOptions } from "./types";

const SCOPE_ATTRIBUTES = {
	"otel.scope.name": pkg.name,
	"otel.scope.version": pkg.version,
} as const;

export type { OtelTransportOptions, ProcessedLogRecord } from "./types";

export {
	isPlainObject,
	levelToSeverityNumber,
	OtelSeverityNumber,
	redactAttributes,
	sensitiveLeafKeys,
	severityMethodFor,
	splitLogEntry,
	type OtelSinkMethod,
} from "./core";

export const otelTransport = (options: OtelTransportOptions): Transport => {
	let emitting = false;

	const processEntry = options.processEntry ?? splitLogEntry;

	const resolveSensitiveLeaves = (): Set<string> => {
		const keys = options.sensitiveKeys;
		if (!keys) return new Set();
		const resolved = typeof keys === "function" ? keys() : keys;
		return sensitiveLeafKeys(resolved);
	};

	const redact = options.redact ?? redactAttributes;

	return createTransport({
		name: "otel",
		send(_logger, entry) {
			if (emitting) return;
			if (options.isDisabled?.()) return;
			if (options.shouldEmit && !options.shouldEmit(entry.level)) return;

			emitting = true;

			try {
				const { body, attributes: rawAttributes } = processEntry(entry.data);

				const leaves = resolveSensitiveLeaves();
				const redacted =
					leaves.size > 0 ? redact(rawAttributes, leaves) : rawAttributes;

				const enriched = options.enrichAttributes
					? options.enrichAttributes(redacted, {
							level: entry.level,
							time: entry.time,
							data: entry.data,
						})
					: redacted;

				const severityNumber =
					levelToSeverityNumber[
						entry.level as keyof typeof levelToSeverityNumber
					] ?? 0;

				const attributes = { ...SCOPE_ATTRIBUTES, ...enriched };

				options.emit({
					body,
					attributes,
					level: entry.level,
					severityNumber,
					severityText: entry.level.toUpperCase(),
					timestamp: entry.time,
				});
			} catch (error) {
				if (options.onError) {
					options.onError(error);
				} else {
					console.warn("[otelTransport]", error);
				}
			} finally {
				emitting = false;
			}
		},
		async teardown() {
			await options.teardown?.();
		},
	});
};
