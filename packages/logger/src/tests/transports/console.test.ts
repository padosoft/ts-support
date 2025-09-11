import { describe, expect, it, mock } from "bun:test";
import { sleep } from "bun";
import { Logger } from "@/core/logger";
import { LogLevels } from "@/lib/levels";
import { consoleTransport } from "@/transports/console";

describe("consoleTransport", () => {
	it("should call correct console method with formatted output", async () => {
		const spy = mock();
		console.info = spy; // default fallback

		const logger = new Logger({
			transports: [consoleTransport()],
		});

		logger.info("hello", "world");
		await sleep(100);

		expect(spy).toHaveBeenCalled();
		const call = spy.mock.calls[0];
		expect(call?.[1]).toBe("hello");
		expect(call?.[2]).toBe("world");
	});

	it("should support custom timestamp function", async () => {
		const spy = mock();
		console.info = spy;

		const logger = new Logger({
			transports: [
				consoleTransport({
					timestamp: () => "STATIC",
				}),
			],
		});

		logger.info("msg");
	});

	it("batch should call send for each entry", async () => {
		const spy = mock();
		console.info = spy;

		const t = consoleTransport();
		const logger = new Logger({ transports: [t] });

		const entries = [
			{ level: LogLevels.INFO, time: new Date(), data: ["a"] },
			{ level: LogLevels.ERROR, time: new Date(), data: ["b"] },
		];

		await t.batch?.(logger, entries);
		expect(spy.mock.calls.length).toBe(1);
	});
});
