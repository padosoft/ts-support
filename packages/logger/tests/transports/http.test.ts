import { describe, expect, it, mock } from "bun:test";
import { Logger } from "@/core/logger";
import { LogLevels } from "@/lib/levels";
import { httpTransport } from "@/transports/http";

describe("httpTransport", () => {
	it("should use custom fetchFn when provided", async () => {
		const fetchFn = mock(async () => {});
		const t = httpTransport({ fetchFn });
		const logger = new Logger({ transports: [t] });

		await logger.info("msg");

		expect(fetchFn).toHaveBeenCalled();
	});

	it("should send batch using endpoint", async () => {
		const spy = mock(async () => {});
		//@ts-expect-error
		globalThis.fetch = spy;

		const t = httpTransport({ endpoint: "http://test" });
		const logger = new Logger({ transports: [t] });

		const entries = [
			{ level: LogLevels.INFO, time: new Date(), data: ["a"] },
			{ level: LogLevels.WARN, time: new Date(), data: ["b"] },
		];

		await t.batch?.(logger, entries);

		expect(spy).toHaveBeenCalled();
		//@ts-expect-error
		const args = spy.mock.calls[0]?.[1];
		//@ts-expect-error
		expect(args?.body).toContain("a");
		//@ts-expect-error
		expect(args?.body).toContain("b");
	});
});
