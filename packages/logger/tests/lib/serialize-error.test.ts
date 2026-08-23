/** biome-ignore-all lint/complexity/useLiteralKeys: bracket access required by tsc noPropertyAccessFromIndexSignature (TS4111) */
import { describe, expect, it } from "bun:test";
import {
	isPlainObject,
	normalizeErrors,
	normalizeLogEntryErrors,
	serializeError,
} from "@/lib/serialize-error";

describe("serializeError", () => {
	it("documents the root cause: JSON.stringify(Error) loses message and stack", () => {
		// This IS the defect the module prevents (message/stack/name are not
		// enumerable). If this assert ever fails the module can be revisited.
		expect(JSON.stringify(new Error("boom"))).toBe("{}");
	});

	it("produces name/message/stack that survive JSON round-trips", () => {
		const result = serializeError(new TypeError("boom"));

		expect(result.name).toBe("TypeError");
		expect(result.message).toBe("boom");
		expect(typeof result.stack).toBe("string");

		const roundTrip = JSON.parse(JSON.stringify(result));
		expect(roundTrip.name).toBe("TypeError");
		expect(roundTrip.message).toBe("boom");
	});

	it("serializes the cause chain recursively", () => {
		const error = new Error("outer", {
			cause: new Error("inner", { cause: "root-detail" }),
		});

		const result = serializeError(error);
		const cause = result.cause as { message: string; cause: unknown };

		expect(cause.message).toBe("inner");
		expect(cause.cause).toBe("root-detail");
	});

	it("caps the cause chain depth instead of recursing forever", () => {
		let error = new Error("level-0");
		for (let i = 1; i <= 10; i++) {
			error = new Error(`level-${i}`, { cause: error });
		}

		// Deeply nested causes degrade to String(...) past the cap — the
		// point is that this returns (no stack overflow) and stays JSON-safe.
		const result = serializeError(error);
		expect(() => JSON.stringify(result)).not.toThrow();
	});

	it("serializes AggregateError members", () => {
		const aggregate = new AggregateError(
			[new TypeError("first"), "second-detail"],
			"all failed",
		);

		const result = serializeError(aggregate);
		const members = result.errors as [{ message: string }, string];

		expect(result.message).toBe("all failed");
		expect(members[0].message).toBe("first");
		expect(members[1]).toBe("second-detail");
	});

	it("keeps enumerable diagnostic fields of Error subclasses", () => {
		class ApiError extends Error {
			readonly statusCode: number;
			readonly code: string;
			constructor(statusCode: number, code: string, message: string) {
				super(message);
				this.name = "ApiError";
				this.statusCode = statusCode;
				this.code = code;
			}
		}

		const result = serializeError(new ApiError(502, "UPSTREAM", "boom"));

		expect(result["statusCode"]).toBe(502);
		expect(result["code"]).toBe("UPSTREAM");
		expect(result.message).toBe("boom");
	});

	it("normalizes Errors nested inside container fields, cause and members", () => {
		const error = Object.assign(new Error("outer"), {
			meta: { inner: new Error("inner-field") },
		});
		error.cause = { nested: new Error("inner-cause") };

		const result = serializeError(error);

		const meta = result["meta"] as { inner: { message: string } };
		expect(meta.inner.message).toBe("inner-field");
		const cause = result.cause as { nested: { message: string } };
		expect(cause.nested.message).toBe("inner-cause");

		// The whole point: a nested Error must not collapse to `{}`.
		const json = JSON.stringify(result);
		expect(json).toContain('"message":"inner-field"');
		expect(json).toContain('"message":"inner-cause"');
	});

	it("degrades non-JSON-safe custom fields to strings", () => {
		const circular: Record<string, unknown> = {};
		circular["self"] = circular;
		const error = Object.assign(new Error("boom"), { payload: circular });

		const result = serializeError(error);

		expect(result["payload"]).toBe("[object Object]");
		expect(() => JSON.stringify(result)).not.toThrow();
	});
});

describe("normalizeErrors", () => {
	it("replaces a bare Error with its serialized form", () => {
		const normalized = normalizeErrors(new TypeError("boom")) as {
			message: string;
		};
		expect(normalized.message).toBe("boom");
	});

	it("replaces Errors nested in plain objects and arrays", () => {
		const normalized = normalizeErrors({
			url: "https://example.test",
			errors: [new Error("in-array")],
		}) as { url: string; errors: [{ message: string }] };

		expect(normalized.url).toBe("https://example.test");
		expect(normalized.errors[0].message).toBe("in-array");
	});

	it("returns the SAME reference when no Error is present", () => {
		const value = { a: 1, nested: { b: [2, 3] } };
		expect(normalizeErrors(value)).toBe(value);

		const array = [1, "two", { three: 3 }];
		expect(normalizeErrors(array)).toBe(array);
	});

	it("does not loop on circular structures (depth cap)", () => {
		const circular: Record<string, unknown> = { error: new Error("boom") };
		circular["self"] = circular;

		expect(() => normalizeErrors(circular)).not.toThrow();
	});
});

describe("normalizeLogEntryErrors", () => {
	it("normalizes entry.data and keeps the rest of the entry", () => {
		const entry = {
			level: "error" as const,
			time: new Date(),
			data: ["failed", new Error("boom")],
		};

		const normalized = normalizeLogEntryErrors(entry);

		expect(normalized.level).toBe("error");
		expect(normalized.data[0]).toBe("failed");
		expect((normalized.data[1] as { message: string }).message).toBe("boom");
		// The regression this whole module exists for:
		expect(JSON.stringify(normalized)).toContain('"message":"boom"');
	});

	it("returns the SAME entry when data has no Errors", () => {
		const entry = {
			level: "info" as const,
			time: new Date(),
			data: ["hello", { count: 1 }],
		};

		expect(normalizeLogEntryErrors(entry)).toBe(entry);
	});
});

describe("isPlainObject", () => {
	it("accepts plain objects and rejects arrays/Errors/primitives", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject(new Error())).toBe(false);
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject("x")).toBe(false);
	});
});
