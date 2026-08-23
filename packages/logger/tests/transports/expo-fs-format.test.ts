import { describe, expect, it } from "bun:test";
import { formatLogEntry } from "@/transports/expo-fs/lib/format";

const timestamp = () => "12:00:00";

describe("expo-fs formatLogEntry", () => {
	it("formats prefix + primitive args", () => {
		const out = formatLogEntry(
			{ level: "info", time: new Date(), data: ["hello", 42, true] },
			{ timestamp },
		);

		expect(out).toBe("12:00:00 [INFO] hello 42 true");
	});

	it("serializes objects as JSON", () => {
		const out = formatLogEntry(
			{ level: "warn", time: new Date(), data: ["ctx", { a: 1 }] },
			{ timestamp },
		);

		expect(out).toBe('12:00:00 [WARN] ctx {"a":1}');
	});

	it("regression (gescat-mobile-app#572): an Error no longer becomes `{}`", () => {
		const out = formatLogEntry(
			{
				level: "error",
				time: new Date(),
				data: ["caught in ErrorBoundary", new TypeError("boom")],
			},
			{ timestamp },
		);

		// Before the fix this line was `... caught in ErrorBoundary {}` — the
		// crash arrived in app.log with no message at all.
		expect(out).not.toContain(" {}");
		expect(out).toContain('"name":"TypeError"');
		expect(out).toContain('"message":"boom"');
		expect(out).toContain('"stack":');
	});

	it("normalizes Errors nested in object args", () => {
		const out = formatLogEntry(
			{
				level: "warn",
				time: new Date(),
				data: [{ url: "https://x.test", error: new Error("nested") }],
			},
			{ timestamp },
		);

		expect(out).toContain('"message":"nested"');
	});

	it("raw mode serializes the whole entry with normalized Errors", () => {
		const out = formatLogEntry(
			{ level: "error", time: new Date(), data: [new Error("boom")] },
			{ raw: true, timestamp },
		);

		const parsed = JSON.parse(out);
		expect(parsed.level).toBe("error");
		expect(parsed.data[0].message).toBe("boom");
	});
});
