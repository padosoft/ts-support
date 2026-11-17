import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { Visitor } from "oxc-parser";
import {
	isJsonObject,
	type Json,
	OPAQUE_KEY,
	StaticEvalError,
	StaticProject,
} from "./static-eval";

export interface ContractOptions {
	/** Name of the function whose calls define the contract: `fn(path, defaults, options?)`. */
	fn: string;
	/** Unprefixed paths get the first namespace; paths already in a namespace are kept. */
	namespaces: readonly string[];
	/** Property of the options argument that marks a call as taking a variant. */
	variantProp: string;
	/** Key of the defaults object that holds variants (excluded from the slots). */
	variantsKey: string;
	/** Expression roots that stay opaque (`Platform.select`, `StyleSheet`, …). */
	opaque: readonly string[];
	/** Name of the generated interface. */
	name: string;
	/** Name of the generated union of paths that take a variant. */
	variantTypeName: string;
}

export interface CallSite {
	file: string;
	line: number;
	path: string;
	defaults: Record<string, Json>;
	hasVariant: boolean;
}

export interface DefaultsEntry {
	variants: boolean;
	sites: { file: string; defaults: Record<string, Json> }[];
}

export function canonicalPath(
	path: string,
	namespaces: readonly string[],
): string {
	const [fallback] = namespaces;
	if (fallback === undefined) return path;
	if (namespaces.some((ns) => path.startsWith(`${ns}.`))) return path;
	return `${fallback}.${path}`;
}

const SKIPPED_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

/** Every `.ts`/`.tsx` file (declaration files excluded) under `dirs`, sorted. */
export function listSourceFiles(
	dirs: readonly string[],
	exclude: readonly string[] = [],
): string[] {
	const files: string[] = [];
	for (const dir of dirs) {
		for (const entry of readdirSync(dir, { recursive: true })) {
			const rel = entry.toString().replaceAll("\\", "/");
			if (
				!/\.tsx?$/.test(rel) ||
				rel.endsWith(".d.ts") ||
				rel.split("/").some((segment) => SKIPPED_DIRS.has(segment))
			) {
				continue;
			}
			const file = resolve(dir, rel);
			if (!exclude.some((skip) => file.startsWith(skip))) files.push(file);
		}
	}
	return files.map((f) => f.replaceAll("\\", "/")).sort();
}

export function collectCalls(
	files: readonly string[],
	root: string,
	options: ContractOptions,
): { calls: CallSite[]; errors: string[] } {
	const project = new StaticProject(options.opaque);
	const calls: CallSite[] = [];
	const errors: string[] = [];

	for (const file of files) {
		const pf = project.parse(file);
		const rel = relative(root, file).replaceAll("\\", "/");
		new Visitor({
			CallExpression(node) {
				if (
					node.callee.type !== "Identifier" ||
					node.callee.name !== options.fn
				) {
					return;
				}
				try {
					const [pathArg, defaultsArg, optionsArg] = node.arguments;
					if (!pathArg || !defaultsArg) {
						throw project.error(pf, node, "call without path or defaults");
					}
					const defaults = project.evaluate(pf, defaultsArg);
					if (!isJsonObject(defaults)) {
						throw project.error(pf, defaultsArg, "defaults must be an object");
					}
					for (const path of project.resolvePaths(pf, pathArg)) {
						calls.push({
							file: rel,
							line: project.lineOf(pf, node),
							path: canonicalPath(path, options.namespaces),
							defaults,
							hasVariant: project.hasOption(optionsArg, options.variantProp),
						});
					}
				} catch (error) {
					if (!(error instanceof StaticEvalError)) throw error;
					errors.push(error.message.replace(`${root}/`, ""));
				}
			},
		}).visit(pf.program);
	}
	return { calls, errors };
}

export function buildDefaults(
	calls: readonly CallSite[],
	variantsKey: string,
): Record<string, DefaultsEntry> {
	const byPath = new Map<string, DefaultsEntry>();
	for (const call of calls) {
		const entry = byPath.get(call.path) ?? { variants: false, sites: [] };
		entry.variants ||= call.hasVariant || variantsKey in call.defaults;
		if (!entry.sites.some((site) => site.file === call.file)) {
			entry.sites.push({ file: call.file, defaults: call.defaults });
		}
		byPath.set(call.path, entry);
	}
	const sorted: Record<string, DefaultsEntry> = {};
	for (const path of [...byPath.keys()].sort()) {
		const entry = byPath.get(path) as DefaultsEntry;
		entry.sites.sort((a, b) => a.file.localeCompare(b.file));
		sorted[path] = entry;
	}
	return sorted;
}

type Shape =
	| { kind: "string" | "number" | "boolean" | "array" | "json" }
	| { kind: "object"; fields: Map<string, Shape> };

function shapeOf(value: Json): Shape {
	if (typeof value === "string") return { kind: "string" };
	if (typeof value === "number") return { kind: "number" };
	if (typeof value === "boolean") return { kind: "boolean" };
	if (Array.isArray(value)) return { kind: "array" };
	if (isJsonObject(value) && !(OPAQUE_KEY in value)) {
		const fields = new Map<string, Shape>();
		for (const [key, v] of Object.entries(value)) fields.set(key, shapeOf(v));
		return { kind: "object", fields };
	}
	return { kind: "json" };
}

function unionShape(a: Shape, b: Shape): Shape {
	if (a.kind === "object" && b.kind === "object") {
		const fields = new Map(a.fields);
		for (const [key, shape] of b.fields) {
			const existing = fields.get(key);
			fields.set(key, existing ? unionShape(existing, shape) : shape);
		}
		return { kind: "object", fields };
	}
	return a.kind === b.kind ? a : { kind: "json" };
}

const quoteKey = (key: string) =>
	/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);

function renderShape(
	shape: Shape,
	indent: string,
	name: string,
	minify: boolean,
): string {
	switch (shape.kind) {
		case "string":
		case "number":
		case "boolean":
			return shape.kind;
		case "array":
			return `readonly ${name}Json[]`;
		case "json":
			return `${name}Json`;
		case "object": {
			if (shape.fields.size === 0) return `${name}Object`;
			const inner = minify ? "" : `${indent}\t`;
			const members = [...shape.fields.keys()]
				.sort()
				.map(
					(key) =>
						`${inner}${quoteKey(key)}${minify ? ":" : ": "}${renderShape(shape.fields.get(key) as Shape, inner, name, minify)}`,
				);
			return minify
				? `{${members.join(";")}}`
				: `{\n${members.map((m) => `${m};`).join("\n")}\n${indent}}`;
		}
	}
}

/**
 * The contract as TypeScript: path → slots (union of the shapes seen at every
 * call site). `minify` drops comments, indentation and line breaks.
 */
export function renderContract(
	defaults: Record<string, DefaultsEntry>,
	options: Pick<ContractOptions, "name" | "variantTypeName" | "variantsKey"> & {
		minify?: boolean;
	},
): string {
	const { name, variantTypeName, variantsKey, minify = false } = options;
	const entries: string[] = [];
	const variantPaths: string[] = [];
	for (const [path, entry] of Object.entries(defaults)) {
		let shape: Shape = { kind: "object", fields: new Map() };
		for (const site of entry.sites) {
			const { [variantsKey]: _variants, ...slots } = site.defaults;
			shape = unionShape(shape, shapeOf(slots));
		}
		const rendered =
			shape.kind === "object" && shape.fields.size === 0
				? "{}"
				: renderShape(shape, "\t", name, minify);
		entries.push(
			minify
				? `${JSON.stringify(path)}:${rendered}`
				: `\t${JSON.stringify(path)}: ${rendered};`,
		);
		if (entry.variants) variantPaths.push(path);
	}
	const header = "// GENERATED by `padosoft styles-contract gen`. Do not edit.";
	if (minify) {
		const variantUnion =
			variantPaths.length === 0
				? "never"
				: variantPaths.map((p) => JSON.stringify(p)).join("|");
		return [
			header,
			`export type ${name}Json=string|number|boolean|null|readonly ${name}Json[]|{readonly [key:string]:${name}Json};`,
			`export type ${name}Object={readonly [key:string]:${name}Json};`,
			`export interface ${name}{${entries.join(";")}}`,
			`export type ${variantTypeName}=${variantUnion};`,
			"",
		].join("\n");
	}
	return [
		header,
		"",
		"/** JSON-serializable value. */",
		`export type ${name}Json =`,
		"\t| string",
		"\t| number",
		"\t| boolean",
		"\t| null",
		`\t| readonly ${name}Json[]`,
		`\t| { readonly [key: string]: ${name}Json };`,
		"",
		"/** Free-form object with no known keys. */",
		`export type ${name}Object = { readonly [key: string]: ${name}Json };`,
		"",
		"/** Every path passed to the function, with the slots of its defaults. */",
		`export interface ${name} {`,
		...entries,
		"}",
		"",
		"/** Paths whose calls take a variant. */",
		variantPaths.length === 0
			? `export type ${variantTypeName} = never;`
			: `export type ${variantTypeName} =\n${variantPaths.map((p) => `\t| ${JSON.stringify(p)}`).join("\n")};`,
		"",
	].join("\n");
}

function findBinary(root: string, name: string): string | undefined {
	const names =
		process.platform === "win32"
			? [`${name}.exe`, `${name}.cmd`, name]
			: [name];
	for (let dir = root; ; dir = dirname(dir)) {
		for (const candidate of names) {
			const bin = join(dir, "node_modules", ".bin", candidate);
			if (existsSync(bin)) return bin;
		}
		if (dirname(dir) === dir) return;
	}
}

/**
 * Formats with the project's Biome (found in `node_modules/.bin`) so generated
 * files pass `biome check`. Without Biome the content is returned unchanged.
 */
export function formatWithBiome(
	content: string,
	filePath: string,
	root: string,
): string {
	const bin = findBinary(root, "biome");
	if (!bin) return content;
	const result = spawnSync(bin, ["format", `--stdin-file-path=${filePath}`], {
		cwd: root,
		input: content,
		encoding: "utf8",
		shell: bin.endsWith(".cmd"),
	});
	if (result.status !== 0) {
		throw new Error(`biome format failed for ${filePath}: ${result.stderr}`);
	}
	return result.stdout.replaceAll("\r\n", "\n");
}
