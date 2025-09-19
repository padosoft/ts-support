import { beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { sleep } from "bun";
import { Logger } from "@/core/logger";
import { createTransport } from "@/lib";
import { rateLimiterPlugin } from "@/plugins/rate-limiter";

describe("rateLimiterPlugin", () => {
	let logger: Logger;
	let transportSend: ReturnType<typeof mock>;

	beforeEach(() => {
		jest.useFakeTimers();
		transportSend = mock(() => {});
		logger = new Logger({
			transports: [createTransport({ name: "t", send: transportSend })],
		});
	});

	it("should allow first log, block second within interval, allow after interval", async () => {
		logger.use(rateLimiterPlugin(500));

		logger.info("first");
		logger.info("second (blocked)");

		await sleep(100);
		expect(transportSend).toHaveBeenCalledTimes(1);

		await sleep(500);
		logger.info("third (allowed)");

		expect(transportSend).toHaveBeenCalledTimes(1);
	});

	it("should restore original emit after teardown", () => {
		const plugin = rateLimiterPlugin(1000);
		logger.use(plugin);

		const originalEmit = logger.emit;
		plugin.teardown?.(logger);
		expect(logger.emit).not.toBe(originalEmit); // restored
	});
});
