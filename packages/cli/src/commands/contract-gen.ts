import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import {
	buildDefaults,
	type ContractOptions,
	collectCalls,
	formatWithBiome,
	listSourceFiles,
	renderContract,
} from "../utils/call-contract";
import { fail } from "../utils/errors";

interface ContractGenOptions {
	fn?: string;
	src?: string | string[];
	out?: string;
	name?: string;
	"variant-type"?: string;
	namespaces?: string | string[];
	"variant-prop"?: string;
	"variants-key"?: string;
	opaque?: string | string[];
	check?: boolean;
	minify?: boolean;
	format?: boolean;
}

/** Accepts `a,b`, repeated flags (`--x a --x b`) or both. */
const list = (value: string | string[] | undefined, fallback: string[]) => {
	const items = [value ?? []]
		.flat()
		.flatMap((v) => v.split(","))
		.map((v) => v.trim())
		.filter(Boolean);
	return items.length > 0 ? items : fallback;
};

const CONTRACT_FILE = "contract.generated.ts";
const DEFAULTS_FILE = "defaults.generated.json";

/**
 * Statically extracts every `fn(path, defaults, options?)` call into a typed
 * contract (`path → slots`) plus the defaults seen at each call site, so apps
 * can be typed against the components they override. `--check` fails when the
 * generated files are stale (for CI).
 */
export const contractGen = async (opts: ContractGenOptions): Promise<void> => {
	if (!opts.fn)
		fail("--fn is required (the function whose calls define the contract)");

	const root = process.cwd().replaceAll("\\", "/");
	const outDir = resolve(opts.out ?? "src/contract");
	const name = opts.name ?? "Contract";
	const options: ContractOptions = {
		fn: opts.fn,
		namespaces: list(opts.namespaces, []),
		variantProp: opts["variant-prop"] ?? "variant",
		variantsKey: opts["variants-key"] ?? "variants",
		opaque: list(opts.opaque, ["Platform.select", "StyleSheet"]),
		name,
		variantTypeName: opts["variant-type"] ?? `${name}VariantPath`,
	};

	const srcDirs = list(opts.src, ["src"]).map((dir) => resolve(dir));
	for (const dir of srcDirs) {
		if (!existsSync(dir)) fail(`source directory not found: ${dir}`);
	}
	const files = listSourceFiles(srcDirs, [outDir.replaceAll("\\", "/")]);
	const { calls, errors } = collectCalls(files, root, options);
	if (errors.length > 0) {
		fail(
			`${options.fn}() calls that cannot be resolved:\n  ${errors.join("\n  ")}`,
		);
	}

	const defaults = buildDefaults(calls, options.variantsKey);
	const minify = opts.minify === true;
	// Biome would re-expand minified output.
	const format = opts.format !== false && !minify;
	const finish = (content: string, file: string) =>
		format ? formatWithBiome(content, file, root) : content;
	const outputs = [
		{
			file: join(outDir, CONTRACT_FILE),
			content: finish(
				renderContract(defaults, { ...options, minify }),
				join(outDir, CONTRACT_FILE),
			),
		},
		{
			file: join(outDir, DEFAULTS_FILE),
			content: finish(
				`${JSON.stringify(defaults, null, minify ? undefined : "\t")}\n`,
				join(outDir, DEFAULTS_FILE),
			),
		},
	];

	if (opts.check) {
		const stale: string[] = [];
		for (const { file, content } of outputs) {
			const current = existsSync(file)
				? (await readFile(file, "utf8")).replaceAll("\r\n", "\n")
				: undefined;
			if (current !== content) stale.push(relative(root, file));
		}
		if (stale.length > 0) {
			fail(
				`contract out of date: ${stale.join(", ")}\n  Re-run without --check to regenerate.`,
			);
		}
		console.log(`  ${chalk.green("ok")}      contract is up to date`);
		return;
	}

	await mkdir(outDir, { recursive: true });
	for (const { file, content } of outputs) {
		await writeFile(file, content, "utf8");
		console.log(`  ${chalk.green("write")}   ${file}`);
	}
	console.log(
		`  ${chalk.dim("found")}   ${calls.length} calls, ${Object.keys(defaults).length} paths\n`,
	);
};
