import { describe, expect, it, mock } from "bun:test";
import { Logger } from "@/core/logger";
import {
	isPlainObject,
	levelToSeverityNumber,
	OtelSeverityNumber,
	redactAttributes,
	sensitiveLeafKeys,
	severityMethodFor,
	splitLogEntry,
} from "@/transports/otel/core";
import { otelTransport } from "@/transports/otel/index";
import type { ProcessedLogRecord } from "@/transports/otel/types";

const SENSITIVE_KEYS = [
	"header.authorization",
	"header.cookie",
	"body.password",
	"response.token",
];

describe("core: severityMethodFor", () => {
	it("maps logger levels to OTel sink methods", () => {
		expect(severityMethodFor("warn")).toBe("warn");
		expect(severityMethodFor("fatal")).toBe("fatal");
		expect(severityMethodFor("success")).toBe("info");
		expect(severityMethodFor("something-new")).toBe("info");
	});
});

describe("core: levelToSeverityNumber", () => {
	it("maps every logger level to OTel severity numbers", () => {
		expect(levelToSeverityNumber.error).toBe(OtelSeverityNumber.ERROR);
		expect(levelToSeverityNumber.warn).toBe(OtelSeverityNumber.WARN);
		expect(levelToSeverityNumber.info).toBe(OtelSeverityNumber.INFO);
		expect(levelToSeverityNumber.success).toBe(OtelSeverityNumber.INFO);
		expect(levelToSeverityNumber.debug).toBe(OtelSeverityNumber.DEBUG);
		expect(levelToSeverityNumber.trace).toBe(OtelSeverityNumber.TRACE);
		expect(levelToSeverityNumber.fatal).toBe(OtelSeverityNumber.FATAL);
	});
});

describe("core: isPlainObject", () => {
	it("returns true for plain objects", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({ a: 1 })).toBe(true);
	});

	it("returns false for non-plain-objects", () => {
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject(new Error())).toBe(false);
		expect(isPlainObject("string")).toBe(false);
		expect(isPlainObject(42)).toBe(false);
	});
});

describe("core: sensitiveLeafKeys", () => {
	it("extracts leaf segments from dotted keys", () => {
		const leaves = sensitiveLeafKeys(SENSITIVE_KEYS);
		expect([...leaves].sort()).toEqual([
			"authorization",
			"cookie",
			"password",
			"token",
		]);
	});
});

describe("core: splitLogEntry", () => {
	it("keeps readable part in body and rest in attributes", () => {
		const { attributes, body } = splitLogEntry([
			"[Cart]",
			"add failed",
			{ articoloId: 42 },
		]);

		expect(body).toBe("[Cart] add failed");
		expect(attributes["log.articoloId"]).toBe(42);
	});

	it("turns an Error into exception attributes", () => {
		const error = new TypeError("boom");
		const { attributes, body } = splitLogEntry(["failed", error]);

		expect(body).toBe("failed boom");
		expect(attributes["exception.type"]).toBe("TypeError");
		expect(attributes["exception.message"]).toBe("boom");
		expect(attributes["exception.stacktrace"]).toBeString();
	});

	it("converts numbers and booleans to body strings", () => {
		const { body } = splitLogEntry(["count:", 42, true]);
		expect(body).toBe("count: 42 true");
	});

	it("puts non-string non-object values in indexed attributes", () => {
		const sym = Symbol("test");
		const { attributes } = splitLogEntry([sym]);
		expect(attributes["log.arg0"]).toBe(sym);
	});
});

describe("core: redactAttributes", () => {
	const leaves = sensitiveLeafKeys(SENSITIVE_KEYS);

	it("redacts by leaf key at the first level", () => {
		const result = redactAttributes(
			{ password: "secret", user: "mario" },
			leaves,
		);
		expect(result.password).toBe("[REDACTED]");
		expect(result.user).toBe("mario");
	});

	it("redacts nested values recursively", () => {
		const result = redactAttributes(
			{ "log.payload": { email: "a@b.it", password: "hunter2" } },
			leaves,
		);
		expect(result["log.payload"]).toEqual({
			email: "a@b.it",
			password: "[REDACTED]",
		});
	});

	it("recurses into arrays of objects", () => {
		const result = redactAttributes(
			{
				"log.users": [
					{ name: "alice", password: "s1" },
					{ name: "bob", password: "s2" },
				],
			},
			leaves,
		);
		expect(result["log.users"]).toEqual([
			{ name: "alice", password: "[REDACTED]" },
			{ name: "bob", password: "[REDACTED]" },
		]);
	});

	it("leaves non-object array items untouched", () => {
		const result = redactAttributes({ ids: [1, 2, 3] }, leaves);
		expect(result.ids).toEqual([1, 2, 3]);
	});
});

describe("otelTransport", () => {
	it("emits a processed record with correct severity", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			sensitiveKeys: SENSITIVE_KEYS,
		});

		transport.send(undefined as never, {
			data: ["login failed", { token: "secret", user: "mario" }],
			level: "error",
			time: new Date(),
		});

		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.body).toBe("login failed");
		expect(emitted[0]!.attributes["log.token"]).toBe("[REDACTED]");
		expect(emitted[0]!.attributes["log.user"]).toBe("mario");
		expect(emitted[0]!.severityNumber).toBe(OtelSeverityNumber.ERROR);
		expect(emitted[0]!.severityText).toBe("ERROR");
	});

	it("drops records when isDisabled returns true", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			isDisabled: () => true,
		});

		transport.send(undefined as never, {
			data: ["hello"],
			level: "info",
			time: new Date(),
		});

		expect(emitted).toHaveLength(0);
	});

	it("drops records when shouldEmit returns false", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			shouldEmit: (level) => level !== "debug",
		});

		transport.send(undefined as never, {
			data: ["verbose"],
			level: "debug",
			time: new Date(),
		});

		expect(emitted).toHaveLength(0);
	});

	it("calls onError instead of throwing", () => {
		const errors: unknown[] = [];
		const transport = otelTransport({
			emit: () => {
				throw new Error("emit exploded");
			},
			onError: (e) => errors.push(e),
		});

		expect(() =>
			transport.send(undefined as never, {
				data: ["hello"],
				level: "info",
				time: new Date(),
			}),
		).not.toThrow();

		expect(errors).toHaveLength(1);
	});

	it("prevents re-entrancy", () => {
		const emitted: ProcessedLogRecord[] = [];
		let reEntryTransport: ReturnType<typeof otelTransport>;

		reEntryTransport = otelTransport({
			emit: (record) => {
				emitted.push(record);
				reEntryTransport.send(undefined as never, {
					data: ["re-entrant"],
					level: "warn",
					time: new Date(),
				});
			},
		});

		reEntryTransport.send(undefined as never, {
			data: ["first"],
			level: "info",
			time: new Date(),
		});

		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.body).toBe("first");
	});

	it("uses custom processEntry", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			processEntry: (data) => ({
				body: `CUSTOM: ${data.join(",")}`,
				attributes: { custom: true },
			}),
		});

		transport.send(undefined as never, {
			data: ["a", "b"],
			level: "info",
			time: new Date(),
		});

		expect(emitted[0]!.body).toBe("CUSTOM: a,b");
		expect(emitted[0]!.attributes.custom).toBe(true);
	});

	it("uses enrichAttributes", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			enrichAttributes: (attrs) => ({
				...attrs,
				"service.tenant": "test-tenant",
			}),
		});

		transport.send(undefined as never, {
			data: ["hello"],
			level: "info",
			time: new Date(),
		});

		expect(emitted[0]!.attributes["service.tenant"]).toBe("test-tenant");
	});

	it("supports dynamic sensitiveKeys resolver", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
			sensitiveKeys: () => ["body.secret"],
		});

		transport.send(undefined as never, {
			data: [{ secret: "hidden", visible: "ok" }],
			level: "info",
			time: new Date(),
		});

		expect(emitted[0]!.attributes["log.secret"]).toBe("[REDACTED]");
		expect(emitted[0]!.attributes["log.visible"]).toBe("ok");
	});

	it("skips redaction when no sensitiveKeys", () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
		});

		transport.send(undefined as never, {
			data: [{ password: "visible" }],
			level: "info",
			time: new Date(),
		});

		expect(emitted[0]!.attributes["log.password"]).toBe("visible");
	});

	it("integrates with Logger", async () => {
		const emitted: ProcessedLogRecord[] = [];
		const transport = otelTransport({
			emit: (record) => emitted.push(record),
		});

		const logger = new Logger({ transports: [transport] });
		logger.setBatching(null);
		logger.info("test message", { key: "value" });

		await Bun.sleep(50);

		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.body).toBe("test message");
		expect(emitted[0]!.attributes["log.key"]).toBe("value");
	});
});
