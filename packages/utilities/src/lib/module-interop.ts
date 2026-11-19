/**
 * Options shared by both `resolveModuleInterop` overloads.
 */
export type ModuleInteropOptions = {
	/** Label used in error messages, typically the imported package name. */
	name?: string;
	/**
	 * How many `.default` levels to descend below the imported value.
	 * Defaults to 3, which covers every shape seen in practice.
	 */
	maxDepth?: number;
};

const DEFAULT_MAX_DEPTH = 3;
const MAX_LISTED_KEYS = 8;

const isObjectLike = (value: unknown): value is object =>
	(typeof value === "object" && value !== null) || typeof value === "function";

const describeShape = (path: string, value: unknown): string => {
	if (value === null) return `${path}: null`;
	if (typeof value !== "object" && typeof value !== "function") {
		return `${path}: ${typeof value}`;
	}
	const keys = Object.keys(value);
	const listed = keys.slice(0, MAX_LISTED_KEYS).join(", ");
	const more = keys.length > MAX_LISTED_KEYS ? ", ..." : "";
	return `${path}: ${typeof value} with keys [${listed}${more}]`;
};

/**
 * Walks `value`, `value.default`, `value.default.default`, ... (bounded by
 * `maxDepth`, stopping on primitives, missing `default` and cycles) and
 * returns every visited level in order, so the first match wins.
 */
const collectCandidates = (
	value: unknown,
	maxDepth: number,
): { path: string; value: unknown }[] => {
	const candidates: { path: string; value: unknown }[] = [];
	const seen = new Set<object>();
	let current: unknown = value;
	let path = "value";

	for (let depth = 0; ; depth++) {
		candidates.push({ path, value: current });
		if (!isObjectLike(current) || depth === maxDepth) break;
		if (seen.has(current)) break;
		seen.add(current);
		if (!("default" in current)) break;
		current = Reflect.get(current, "default");
		path = `${path}.default`;
	}

	return candidates;
};

/**
 * Resolves the real API of a module imported through a CommonJS/ESM interop
 * layer. The shape depends on the bundler and interop mode: the API can be the
 * namespace itself, `ns.default`, or `ns.default.default`.
 *
 * Motivating incident: `@padosoft/apple-targets` 2.10.1 built to CJS with
 * `__toESM(require("@expo/plist"), 1)` made the default import equal the whole
 * `module.exports`, so `plist.parse` was undefined (`TypeError:
 * a.default.parse is not a function`). This helper finds the level that
 * actually exposes `parse` and `build`, instead of guessing one shape.
 *
 * Levels are checked in order (`value`, `.default`, `.default.default`, ...,
 * bounded by `maxDepth`). The first level that has every required key as a
 * function is returned. If none matches, the function throws an `Error`
 * listing the missing keys and the shapes it saw.
 *
 * @example
 * import plistModule from "@expo/plist";
 *
 * type PlistApi = {
 *   parse: (xml: string) => unknown;
 *   build: (value: unknown) => string;
 * };
 *
 * const plist = resolveModuleInterop<PlistApi>(plistModule, ["parse", "build"], {
 *   name: "@expo/plist",
 * });
 * plist.parse("<plist>...</plist>");
 *
 * @param value - The imported namespace or default export (any value).
 * @param requiredKeys - Keys that must be present as functions on the matched level.
 * @param options - Optional error label and maximum `.default` depth.
 * @returns The first level exposing all required keys, typed as `T`.
 * @throws {Error} When no level exposes all required keys as functions.
 */
export function resolveModuleInterop<
	T extends object = Record<string, unknown>,
>(
	value: unknown,
	requiredKeys: readonly (keyof T & string)[],
	options?: ModuleInteropOptions,
): T;
/**
 * Type-guard variant: the first level for which `isMatch` returns `true` is
 * returned. Use it when the expected API is not just a set of function keys.
 *
 * @param value - The imported namespace or default export (any value).
 * @param isMatch - Type guard applied to each visited level.
 * @param options - Optional error label and maximum `.default` depth.
 * @returns The first level accepted by `isMatch`, typed as `T`.
 * @throws {Error} When no level is accepted by `isMatch`.
 */
export function resolveModuleInterop<T>(
	value: unknown,
	isMatch: (candidate: unknown) => candidate is T,
	options?: ModuleInteropOptions,
): T;
export function resolveModuleInterop(
	value: unknown,
	requirement: readonly string[] | ((candidate: unknown) => boolean),
	options: ModuleInteropOptions = {},
): unknown {
	const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
	const label = options.name ?? "resolveModuleInterop";
	const candidates = collectCandidates(value, maxDepth);

	const matches =
		typeof requirement === "function"
			? requirement
			: (candidate: unknown): boolean =>
					isObjectLike(candidate) &&
					requirement.every(
						(key) => typeof Reflect.get(candidate, key) === "function",
					);

	const found = candidates.find((candidate) => matches(candidate.value));
	if (found) return found.value;

	const expected =
		typeof requirement === "function"
			? "a value accepted by the provided type guard"
			: `functions [${requirement.join(", ")}]`;
	const seen = candidates.map((c) => describeShape(c.path, c.value)).join("; ");
	throw new Error(
		`${label}: no interop level exposes ${expected}. Checked ${seen}.`,
	);
}
