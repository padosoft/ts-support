/**
 * Node-only JSON file helpers that round-trip a file's indentation. Not
 * re-exported from the `lib` barrel: import from `@padosoft/utilities/lib/json-file`.
 */
import { readFile, writeFile } from "node:fs/promises";

export interface JSONFile<T> {
	path: string;
	data: T;
	/** Indentation detected on read, reused on write. */
	indent: string;
}

/** Indentation of the first nested line of a JSON document; tab when undetectable. */
export const detectIndent = (json: string): string =>
	/^[{[]\r?\n([ \t]+)/.exec(json)?.[1] ?? "\t";

export const readJSONFile = async <T>(path: string): Promise<JSONFile<T>> => {
	const raw = await readFile(path, "utf8");
	return { path, data: JSON.parse(raw) as T, indent: detectIndent(raw) };
};

export const writeJSONFile = async <T>({
	path,
	data,
	indent,
}: JSONFile<T>): Promise<void> => {
	await writeFile(path, `${JSON.stringify(data, null, indent)}\n`, "utf8");
};
