import { describe, expect, it, mock } from "bun:test";
import { sleep } from "bun";
import { Logger } from "@/core/logger";
import { LogLevels } from "@/lib/levels";
import { webSocketTransport } from "@/transports/ws";

describe("webSocketTransport", () => {
	it("should send messages via WebSocket", async () => {
		const send = mock();
		// fake WebSocket
		// @ts-expect-error override global
		global.WebSocket = class {
			send = send;
			close = mock();
		};

		const t = webSocketTransport({ url: "ws://test" });
		const logger = new Logger({ transports: [t] });

		logger.info("hello");
		await sleep(100);

		expect(send).toHaveBeenCalled();

		const payload = JSON.parse(send.mock.calls[0]?.[0]);
		expect(payload[0].data).toContain("hello");
	});

	it("should batch multiple entries", async () => {
		const send = mock();
		// @ts-expect-error override global
		global.WebSocket = class {
			send = send;
			close = mock();
		};

		const t = webSocketTransport({ url: "ws://test" });
		const logger = new Logger({ transports: [t] });

		const entries = [
			{ level: LogLevels.INFO, time: new Date(), data: ["a"] },
			{ level: LogLevels.ERROR, time: new Date(), data: ["b"] },
		];

		await t.batch?.(logger, entries);

		expect(send).toHaveBeenCalledTimes(1);
		const payload = JSON.parse(send.mock.calls[0]?.[0]);
		expect(payload.length).toBe(2);
	});

	it("should close websocket on teardown", () => {
		const close = mock();
		// @ts-expect-error override global
		global.WebSocket = class {
			send = mock();
			close = close;
		};

		const t = webSocketTransport({ url: "ws://test" });
		const logger = new Logger({ transports: [t] });
		t.teardown?.(logger);

		expect(close).toHaveBeenCalled();
	});
});
