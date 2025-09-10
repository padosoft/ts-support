import { createTransport } from "@/lib";
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
		send(_logger, entry) {
			ws.send(JSON.stringify([entry]));
		},
		batch(_logger, entries) {
			ws.send(JSON.stringify(entries));
		},
		teardown() {
			ws.close();
		},
	});
};
