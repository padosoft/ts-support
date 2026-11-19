import { describe, expect, it } from "bun:test";
import { resolveModuleInterop } from "../../src/lib/module-interop";

type Api = {
	parse: (input: string) => string;
	build: (input: string) => string;
};

const api: Api = {
	parse: (input) => `parsed:${input}`,
	build: (input) => `built:${input}`,
};

const expectApi = (resolved: Api) => {
	expect(resolved.parse("x")).toBe("parsed:x");
	expect(resolved.build("y")).toBe("built:y");
};

describe("resolveModuleInterop", () => {
	it("returns the namespace itself when it exposes the keys", () => {
		const resolved = resolveModuleInterop<Api>(api, ["parse", "build"]);
		expect(resolved).toBe(api);
		expectApi(resolved);
	});

	it("unwraps a single default level ({ default: api })", () => {
		const resolved = resolveModuleInterop<Api>({ default: api }, [
			"parse",
			"build",
		]);
		expect(resolved).toBe(api);
	});

	it("unwraps a double default level ({ default: { default: api } })", () => {
		const resolved = resolveModuleInterop<Api>({ default: { default: api } }, [
			"parse",
			"build",
		]);
		expect(resolved).toBe(api);
	});

	it("prefers the namespace when it has named exports and a default export", () => {
		const other = { parse: () => "other", build: () => "other" };
		const namespace = { parse: api.parse, build: api.build, default: other };
		const resolved = resolveModuleInterop<Api>(namespace, ["parse", "build"]);
		expect(resolved).toBe(namespace);
		expectApi(resolved);
	});

	it("falls back to the default export when the namespace only partially matches", () => {
		const namespace = { parse: api.parse, default: api };
		const resolved = resolveModuleInterop<Api>(namespace, ["parse", "build"]);
		expect(resolved).toBe(api);
	});

	it("accepts a function value that carries the keys as properties", () => {
		const callable = Object.assign(() => undefined, api);
		const resolved = resolveModuleInterop<Api>({ default: callable }, [
			"parse",
			"build",
		]);
		expect(resolved).toBe(callable);
	});

	it("respects maxDepth", () => {
		const deep = { default: { default: { default: api } } };
		expect(() =>
			resolveModuleInterop<Api>(deep, ["parse", "build"], {
				name: "deep-pkg",
				maxDepth: 2,
			}),
		).toThrow(/deep-pkg/);
		expect(
			resolveModuleInterop<Api>(deep, ["parse", "build"], { maxDepth: 3 }),
		).toBe(api);
	});

	it("does not loop forever on a cyclic default chain", () => {
		const cyclic: { default?: unknown } = {};
		cyclic.default = cyclic;
		expect(() => resolveModuleInterop<Api>(cyclic, ["parse", "build"])).toThrow(
			/no interop level exposes/,
		);
	});

	it("throws a clear error naming the missing keys and the shapes it saw", () => {
		const input = { default: { parse: api.parse, other: 1 } };
		let message = "";
		try {
			resolveModuleInterop<Api>(input, ["parse", "build"], {
				name: "@expo/plist",
			});
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain("@expo/plist");
		expect(message).toContain("functions [parse, build]");
		expect(message).toContain("value: object with keys [default]");
		expect(message).toContain("value.default: object with keys [parse, other]");
		expect(message).not.toContain("value.default.default");
	});

	it("throws for null, undefined and primitive input", () => {
		expect(() => resolveModuleInterop<Api>(null, ["parse"])).toThrow(
			/value: null/,
		);
		expect(() => resolveModuleInterop<Api>(undefined, ["parse"])).toThrow(
			/value: undefined/,
		);
		expect(() => resolveModuleInterop<Api>("text", ["parse"])).toThrow(
			/value: string/,
		);
		expect(() => resolveModuleInterop<Api>(42, ["parse"])).toThrow(
			/value: number/,
		);
	});

	it("does not treat non-function values as matching keys", () => {
		const notFunctions = { parse: "not-a-function", build: 1 };
		expect(() =>
			resolveModuleInterop<Api>(notFunctions, ["parse", "build"]),
		).toThrow(/no interop level exposes/);
		expect(() =>
			resolveModuleInterop<Api>(
				{ default: { parse: api.parse, build: null } },
				["parse", "build"],
			),
		).toThrow(/no interop level exposes/);
	});

	it("uses the type guard overload when given a predicate", () => {
		type Named = { name: string };
		const isNamed = (candidate: unknown): candidate is Named =>
			typeof candidate === "object" &&
			candidate !== null &&
			typeof (candidate as { name?: unknown }).name === "string";

		const resolved = resolveModuleInterop({ default: { name: "x" } }, isNamed);
		expect(resolved).toEqual({ name: "x" });
		expect(() => resolveModuleInterop({ default: {} }, isNamed)).toThrow(
			/type guard/,
		);
	});
});
