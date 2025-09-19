import { beforeEach, describe, expect, it } from "bun:test";
import { Logger } from "@/core/logger";
import { LogLevels } from "@/lib/levels";
import { contextPlugin } from "@/plugins/context";

describe("contextPlugin", () => {
	let logger: Logger;

	beforeEach(() => {
		logger = new Logger();
		logger.use(contextPlugin({ initial: { app: "test-app" } }));
	});

	it("should enrich log entries with initial context", async () => {
		const entry = { level: LogLevels.INFO, time: new Date(), data: ["msg"] };
		const transformed = await logger["applyTransforms"](entry);

		expect(transformed.ctx).toEqual({ app: "test-app" });
	});

	it("should allow setting and clearing context", async () => {
		logger.setContext?.({ user: "alice" });
		const entry = { level: LogLevels.INFO, time: new Date(), data: [] };
		const transformed = await logger["applyTransforms"](entry);

		expect(transformed.ctx).toEqual({ user: "alice" });

		logger.clearContext?.();
		const transformed2 = await logger["applyTransforms"](entry);
		expect(transformed2.ctx).toEqual({});
	});

	it("should return current context with getContext", () => {
		logger.setContext?.({ foo: 123 });
		expect(logger.getContext?.()).toEqual({ foo: 123 });
	});
});
