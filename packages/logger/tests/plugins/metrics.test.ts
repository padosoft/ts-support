import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Logger } from "@/core/logger";
import { createPlugin, createTransport } from "@/lib";
import { LogLevels } from "@/lib/levels";
import { metricsPlugin } from "@/plugins/metrics";

describe("metricsPlugin", () => {
	let logger: Logger;

	beforeEach(() => {
		logger = new Logger();
	});

	it("should count plugins and transports when added", () => {
		logger.use(metricsPlugin({}));

		const p = createPlugin({ name: "p" });
		const t = createTransport({ name: "t", send: mock(async () => {}) });

		logger.addPlugin(p);
		logger.addTransport(t);

		expect(logger.getMetrics?.()).toEqual({
			plugins: 2,
			transports: 1,
		});
	});

	it("should count levels if countLevels option is enabled", () => {
		logger.use(metricsPlugin({ countLevels: true }));
		logger.error("oops");
		logger.info("ok");

		const m = logger.getMetrics?.();
		expect(m?.[LogLevels.ERROR]).toBe(1);
		expect(m?.[LogLevels.INFO]).toBe(1);
	});

	it("should not count levels if countLevels option is disabled", () => {
		logger.use(metricsPlugin({ countLevels: false }));
		logger.error("oops");
		logger.info("ok");

		const m = logger.getMetrics?.();
		expect(m?.[LogLevels.ERROR]).toBeUndefined();
		expect(m?.[LogLevels.INFO]).toBeUndefined();
	});
});
