/** biome-ignore-all lint/complexity/useLiteralKeys: Necessario per accedere a metodi protected/private */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
	mock,
} from "bun:test";
import { sleep } from "bun";
import { Logger } from "@/core/logger"; // adjust import path
import { createPlugin, createTransport } from "@/lib";
import { LogLevels } from "@/lib/levels";
import type { Plugin, Transport } from "@/types/mods";

describe("Logger", () => {
	let transport: Transport;
	let plugin: Plugin;

	beforeEach(() => {
		transport = createTransport({ name: "test", send: mock() });
		plugin = createPlugin({ name: "test" });
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("defaults level to INFO", () => {
		const logger = new Logger();
		expect(logger["level"]).toBe(LogLevels.INFO);
	});

	it("respects constructor options", () => {
		const logger = new Logger({
			level: LogLevels.DEBUG,
			transports: [transport],
			plugins: [plugin],
			batching: { maxBatchSize: 5 },
		});

		expect(logger["level"]).toBe(LogLevels.DEBUG);
		expect(logger.transports).toContain(transport);
		expect(logger.plugins).toContain(plugin);
		expect(logger["batching"]?.maxBatchSize).toBe(5);
	});

	it("addPlugin and addTransport", () => {
		const logger = new Logger();
		const p = createPlugin({
			name: "test",
			enrichLogger: mock((logger) => logger),
		});
		const t = createTransport({ name: "test", send: mock() });

		logger.addPlugin(p);
		expect(logger.plugins).toContain(p);
		expect(p.enrichLogger).toHaveBeenCalledWith(logger);

		logger.addTransport(t);
		expect(logger.transports).toContain(t);
	});

	it("use() detects plugin vs transport", () => {
		const logger = new Logger();
		const p = createPlugin({ name: "test", enrichLogger: (logger) => logger });
		const t = createTransport({ name: "test", send: mock() });

		logger.use(p);
		expect(logger.plugins).toContain(p);

		logger.use(t);
		expect(logger.transports).toContain(t);
	});

	it("setLevel changes level", () => {
		const logger = new Logger();
		logger.setLevel(LogLevels.ERROR);
		expect(logger["level"]).toBe(LogLevels.ERROR);
	});

	it("setBatching enables/disables batching", () => {
		const logger = new Logger();
		logger.setBatching({ maxBatchSize: 3 });
		expect(logger["batching"]?.maxBatchSize).toBe(3);

		logger.setBatching(null);
		expect(logger["batching"]).toBeUndefined();
	});

	it("shouldLog respects log levels", () => {
		const logger = new Logger({ level: LogLevels.WARN });
		expect(logger["shouldLog"](LogLevels.ERROR)).toBe(true);
		expect(logger["shouldLog"](LogLevels.DEBUG)).toBe(false);
	});

	it("applyTransforms applies plugin transforms", async () => {
		const logger = new Logger();
		const p = createPlugin({
			name: "test",
			transformEntry: mock((_, entry) => ({ ...entry, extra: true })),
		});
		logger.addPlugin(p);

		const result = await logger["applyTransforms"]({
			level: LogLevels.INFO,
			time: new Date(),
			data: [],
		});

		expect(result).toHaveProperty("extra", true);
	});

	it("handleEntry sends immediately when no batching", async () => {
		const logger = new Logger({ transports: [transport] });
		const entry = { level: LogLevels.INFO, time: new Date(), data: ["x"] };

		await logger["handleEntry"](entry);
		expect(transport.send).toHaveBeenCalledWith(logger, entry);
	});

	it("handleEntry buffers when batching enabled", async () => {
		const logger = new Logger({
			transports: [transport],
			batching: { maxBatchSize: 2 },
		});
		const entry = { level: LogLevels.INFO, time: new Date(), data: ["x"] };

		await logger["handleEntry"](entry);
		expect(logger["batchingState"].buf.length).toBe(1);
	});

	it("handleEntry drops when buffer full and dropIfBufferFull set", async () => {
		const logger = new Logger({
			transports: [transport],
			batching: { maxBatchSize: 2, dropIfBufferFull: true },
		});
		const entry = { level: LogLevels.INFO, time: new Date(), data: ["x"] };

		logger["handleEntry"](entry);
		logger["handleEntry"](entry);
		logger["handleEntry"](entry);
		await sleep(200);
		expect(transport.send).toHaveBeenCalledTimes(2);
		expect(logger["batchingState"].buf.length).toBe(0);
	});

	it("flush sends batch", async () => {
		const batch = mock();
		const logger = new Logger({
			transports: [
				createTransport({
					name: "test",
					send: mock(),
					batch,
				}),
			],
			batching: { maxBatchSize: 2 },
		});
		logger["batchingState"].buf.push({
			level: LogLevels.INFO,
			time: new Date(),
			data: ["a"],
		});

		await logger.flush();
		expect(batch).toHaveBeenCalled();
		expect(logger["batchingState"].buf).toEqual([]);
	});

	it("flush falls back to send if no batch()", async () => {
		const logger = new Logger({
			transports: [transport],
			batching: { maxBatchSize: 2 },
		});
		logger["batchingState"].buf.push({
			level: LogLevels.INFO,
			time: new Date(),
			data: ["a"],
		});
		await logger.flush();
		expect(transport.send).toHaveBeenCalled();
	});

	it("scheduleTimer sets timer and flushes later", async () => {
		const batch = mock();
		const logger = new Logger({
			transports: [
				createTransport({
					name: "test",
					send: mock(),
					batch,
				}),
			],
			batching: { maxBatchSize: 10, maxIntervalMs: 100 },
		});
		await logger["handleEntry"]({
			level: LogLevels.INFO,
			time: new Date(),
			data: ["a"],
		});

		expect(logger["batchingState"].timer).not.toBeNull();
		await sleep(100);
		await Promise.resolve();
		expect(batch).toHaveBeenCalled();
	});

	it("emit respects shouldLog", async () => {
		transport = createTransport({
			name: "test",
			send: mock(async () => {}),
		});
		const logger = new Logger({
			level: LogLevels.ERROR,
			transports: [transport],
		});
		logger.info("should not log");
		expect(transport.send).not.toHaveBeenCalled();

		logger.error("should log");
		await sleep(100);
		expect(transport.send).toHaveBeenCalled();
	});

	it("level helpers call emit", () => {
		const logger = new Logger({ transports: [transport] });
		const spy = mock(logger.emit.bind(logger));
		logger.emit = spy;

		logger.trace("a");
		logger.debug("b");
		logger.info("c");
		logger.success("d");
		logger.warn("e");
		logger.error("f");
		logger.fatal("g");

		expect(spy.mock.calls.length).toBe(7);
	});

	it("assert logs error when cond false", () => {
		const logger = new Logger({ transports: [transport] });
		const spy = mock();
		logger.error = spy;

		logger.assert(false, "oops");
		expect(spy).toHaveBeenCalledWith("Assertion failed:", "oops");

		logger.assert(true, "ok");
		expect(spy.mock.calls.length).toBe(1);
	});

	it("table calls console.table", () => {
		const spy = mock();
		console.table = spy;

		const logger = new Logger();
		logger.table([1, 2, 3]);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it("clear calls console.clear", () => {
		const spy = mock();
		console.clear = spy;
		const logger = new Logger();
		logger.clear();
		expect(spy).toHaveBeenCalled();
	});

	it("clone creates new Logger with merged options", () => {
		const logger = new Logger({ transports: [transport] });
		const clone = logger.clone({ level: LogLevels.DEBUG });

		expect(clone).toBeInstanceOf(Logger);
		expect(clone).not.toBe(logger);
		expect(clone["level"]).toBe(LogLevels.DEBUG);
		expect(clone.transports).toEqual(logger.transports);
	});

	it("close flushes and tears down transports/plugins", async () => {
		const t = createTransport({ name: "test", send: mock(), teardown: mock() });
		const p = createPlugin({ name: "test", teardown: mock() });
		const logger = new Logger({
			transports: [t],
			plugins: [p],
			batching: { maxBatchSize: 2, maxIntervalMs: 100 },
		});
		// Add something to buffer
		logger["batchingState"].buf.push({
			level: LogLevels.INFO,
			time: new Date(),
			data: ["a"],
		});
		// Schedule a timer
		await logger["handleEntry"]({
			level: LogLevels.INFO,
			time: new Date(),
			data: ["b"],
		});

		await logger.close();

		expect(t.teardown).toHaveBeenCalledWith(logger);
		expect(p.teardown).toHaveBeenCalledWith(logger);

		expect(logger.transports.length).toBe(0);
		expect(logger.plugins.length).toBe(0);
		expect(logger["batchingState"].buf.length).toBe(0);
		expect(logger["batchingState"].timer).toBeNull();
	});

	it("[Symbol.asyncDispose] calls close", async () => {
		const logger = new Logger();
		const spy = mock();
		logger.close = spy;
		await logger[Symbol.asyncDispose]();
		expect(spy).toHaveBeenCalled();
	});

	it("[Symbol.dispose] calls close", () => {
		const logger = new Logger();
		const spy = mock();
		logger.close = spy;
		logger[Symbol.dispose]();
		expect(spy).toHaveBeenCalled();
	});
});
