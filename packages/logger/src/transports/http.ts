import { createTransport } from "@/lib/mods";
import type { LogEntry } from "@/types";
import type { Transport } from "@/types/mods";

export interface HttpTransportOptions {
	/** Endpoint URL to send logs to */
	endpoint?: string;

	/** HTTP method (default: POST) */
	method?: string;

	/** Optional headers */
	headers?: Record<string, string>;

	/** Custom fetch function (default: global fetch) */
	fetchFn?: (batch: LogEntry[]) => Promise<void>;
}

export const httpTransport = (options: HttpTransportOptions): Transport => {
	const method = options.method ?? "POST";
	const headers = { "Content-Type": "application/json", ...options.headers };

	const fetchFn = async (batch: LogEntry[]) => {
		if (!options.endpoint) {
			throw new Error("httpTransport: no endpoint or fetchFn provided");
		}

		return globalThis.fetch(options.endpoint, {
			method,
			headers,
			body: JSON.stringify(batch),
		});
	};

	const sendRequest = options.fetchFn ?? fetchFn;

	return createTransport({
		name: "http",

		send(_logger, entry) {
			sendRequest([entry]);
		},

		batch(_logger, batch) {
			sendRequest(batch);
		},
	});
};
