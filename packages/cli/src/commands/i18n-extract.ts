import { resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { writeJSON } from "../utils/workspace";

interface I18nExtractOptions {
	format?: string;
	file?: string;
	table?: boolean;
}

function flattenKeys(
	obj: Record<string, unknown>,
	prefix = "",
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(obj)) {
		const full = prefix ? `${prefix}.${key}` : key;
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			result[full] = String(value ?? "");
		} else {
			Object.assign(result, flattenKeys(value as Record<string, unknown>, full));
		}
	}
	return result;
}

async function loadTranslation(
	sourcePath: string,
): Promise<Record<string, unknown>> {
	const absPath = resolve(sourcePath);
	// dynamic import — works with .mjs/.js at runtime; .ts requires bun or tsx
	const mod = (await import(absPath)) as Record<string, unknown>;
	const raw = mod["default"] ?? mod["translation"] ?? mod;
	if (typeof raw !== "object" || raw === null) {
		throw new Error(`${absPath} does not export a plain object`);
	}
	return raw as Record<string, unknown>;
}

export const i18nExtract = async (
	paths: string[],
	opts: I18nExtractOptions,
): Promise<void> => {
	const format = opts.format === "object" ? "object" : "array";
	const useTable = opts.table ?? false;
	const outputFile = opts.file;

	if (!paths.length) {
		console.error(
			`  ${chalk.red("error")}   specify at least one path to a translation file`,
		);
		process.exit(1);
	}

	const allKeys: Record<string, string> = {};

	for (const src of paths) {
		const absPath = resolve(src);
		console.log(`  ${chalk.dim("loading")}  ${absPath}`);
		const translation = await loadTranslation(absPath);
		Object.assign(allKeys, flattenKeys(translation));
	}

	const keyCount = Object.keys(allKeys).length;
	console.log(`  ${chalk.green("found")}    ${keyCount} keys\n`);

	const output: string[] | Record<string, string> =
		format === "array" ? Object.keys(allKeys) : allKeys;

	if (outputFile) {
		const filePath = resolve(outputFile);
		await writeJSON(filePath, output);
		console.log(`  ${chalk.green("written")}  ${filePath}\n`);
		return;
	}

	if (useTable) {
		if (format === "array") {
			console.table((output as string[]).map((key) => ({ key })));
		} else {
			console.table(
				Object.entries(output as Record<string, string>).map(
					([key, value]) => ({ key, value }),
				),
			);
		}
		return;
	}

	console.log(JSON.stringify(output, null, 2));
};
