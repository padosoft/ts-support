import { createTransport } from "@/lib";
import { normalizeLogEntryErrors } from "@/lib/serialize-error";
import type { Transport } from "@/types";

export interface WebSocketTransportOptions {
	url: string;
}

export const webSocketTransport = (
	options: WebSocketTransportOptions,
): Transport => {
	const ws = new WebSocket(options.url);

	return createTransport({
		name: "ws",
		// Errors in entry.data have non-enumerable message/stack and would
		// serialize to `{}`: normalize before JSON.stringify (see
		// @/lib/serialize-error).
		send(_logger, entry) {
			ws.send(JSON.stringify([normalizeLogEntryErrors(entry)]));
		},
		batch(_logger, entries) {
			ws.send(JSON.stringify(entries.map(normalizeLogEntryErrors)));
		},
		teardown() {
			ws.close();
		},
	});
};
