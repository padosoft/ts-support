/** biome-ignore-all lint/complexity/useLiteralKeys: bracket access required by tsc noPropertyAccessFromIndexSignature (TS4111) */
import { beforeEach, describe, expect, it } from "bun:test";
import { Logger } from "@/core/logger";
import { LogLevels } from "@/lib/levels";
import { contextPlugin } from "@/plugins/context";
import { createAsyncLocalStorageContextStore } from "@/plugins/context/als-store";

describe("contextPlugin (default shared store)", () => {
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

	it("should patch (merge) context without replacing other fields", async () => {
		logger.setContext?.({ app: "test-app", env: "test" });
		logger.patchContext?.({ user: "bob" });
		expect(logger.getContext?.()).toEqual({
			app: "test-app",
			env: "test",
			user: "bob",
		});
	});

	it("runWithContext swaps context for the duration and restores afterwards", async () => {
		logger.setContext?.({ app: "test-app" });

		logger.runWithContext?.({ request_id: "r1" }, () => {
			expect(logger.getContext?.()).toMatchObject({
				app: "test-app",
				request_id: "r1",
			});
		});

		// restored after exit
		expect(logger.getContext?.()).toEqual({ app: "test-app" });
	});

	it("entry.ctx fields override store context", async () => {
		logger.setContext?.({ user: "alice", request_id: "old" });
		const entry = {
			level: LogLevels.INFO,
			time: new Date(),
			data: [],
			ctx: { request_id: "new" },
		};
		const transformed = await logger["applyTransforms"](entry);
		expect(transformed.ctx).toMatchObject({ user: "alice", request_id: "new" });
	});

	it("works with no options (empty initial)", async () => {
		const l = new Logger();
		l.use(contextPlugin());
		const entry = { level: LogLevels.INFO, time: new Date(), data: [] };
		const transformed = await l["applyTransforms"](entry);
		expect(transformed.ctx).toEqual({});
	});
});

describe("contextPlugin (AsyncLocalStorage store)", () => {
	it("isolates context across concurrent async tasks", async () => {
		const logger = new Logger();
		logger.use(
			contextPlugin({
				initial: { service: "api" },
				store: createAsyncLocalStorageContextStore({ service: "api" }),
			}),
		);

		const results: Array<{ id: string; ctx: Record<string, unknown> }> = [];

		async function simulateRequest(id: string, delayMs: number) {
			await logger.runWithContext!({ request_id: id }, async () => {
				// Simulate async work before reading context
				await new Promise((r) => setTimeout(r, delayMs));
				logger.patchContext?.({ enriched: true });
				const ctx = logger.getContext?.() ?? {};
				results.push({ id, ctx });
			});
		}

		// Start two "requests" concurrently with different delays so they interleave
		await Promise.all([
			simulateRequest("req-A", 10),
			simulateRequest("req-B", 5),
		]);

		const a = results.find((r) => r.id === "req-A");
		const b = results.find((r) => r.id === "req-B");

		expect(a?.ctx["request_id"]).toBe("req-A");
		expect(b?.ctx["request_id"]).toBe("req-B");
		// Neither should see the other's request_id
		expect(a?.ctx["request_id"]).not.toBe("req-B");
		expect(b?.ctx["request_id"]).not.toBe("req-A");
		// Both should have enriched=true from patchContext
		expect(a?.ctx["enriched"]).toBe(true);
		expect(b?.ctx["enriched"]).toBe(true);
		// Both should carry the initial context
		expect(a?.ctx["service"]).toBe("api");
		expect(b?.ctx["service"]).toBe("api");
	});

	it("outside a runWithContext scope, get() returns initial", () => {
		const logger = new Logger();
		logger.use(
			contextPlugin({
				store: createAsyncLocalStorageContextStore({ service: "api" }),
			}),
		);
		// No runWithContext called — falls back to initial
		expect(logger.getContext?.()).toEqual({ service: "api" });
	});

	it("patchContext merges into the current ALS scope only", async () => {
		const logger = new Logger();
		logger.use(
			contextPlugin({
				store: createAsyncLocalStorageContextStore(),
			}),
		);

		let ctxInsideA: Record<string, unknown> = {};
		let ctxInsideB: Record<string, unknown> = {};

		await Promise.all([
			logger.runWithContext!({ req: "A" }, async () => {
				await new Promise((r) => setTimeout(r, 5));
				logger.patchContext?.({ extra: "for-A" });
				ctxInsideA = logger.getContext?.() ?? {};
			}),
			logger.runWithContext!({ req: "B" }, async () => {
				await new Promise((r) => setTimeout(r, 2));
				logger.patchContext?.({ extra: "for-B" });
				ctxInsideB = logger.getContext?.() ?? {};
			}),
		]);

		expect(ctxInsideA).toMatchObject({ req: "A", extra: "for-A" });
		expect(ctxInsideB).toMatchObject({ req: "B", extra: "for-B" });
		expect(ctxInsideA["extra"]).not.toBe("for-B");
	});
});
