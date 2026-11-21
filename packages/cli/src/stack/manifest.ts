import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
	type JSONFile,
	readJSONFile,
	writeJSONFile,
} from "@padosoft/utilities/lib/json-file";
import {
	formatZodError,
	type StackManifest,
	StackManifestSchema,
} from "./schemas";

export const MANIFEST_PATH: string = join(".padosoft", "stack.json");

/** Nearest `.padosoft/stack.json` from `cwd` upwards, so subfolders and monorepo packages resolve to their own. */
export function findManifest(cwd: string = process.cwd()): string | undefined {
	let dir = resolve(cwd);
	for (;;) {
		const candidate = join(dir, MANIFEST_PATH);
		if (existsSync(candidate)) return candidate;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

export interface LoadedManifest {
	file: JSONFile<unknown>;
	manifest: StackManifest;
}

export async function readManifest(path: string): Promise<LoadedManifest> {
	let file: JSONFile<unknown>;
	try {
		file = await readJSONFile<unknown>(path);
	} catch (error) {
		throw new Error(`Cannot read ${path}: ${String(error)}`);
	}
	const parsed = StackManifestSchema.safeParse(file.data);
	if (!parsed.success) {
		throw new Error(`Invalid ${path}: ${formatZodError(parsed.error)}`);
	}
	return { file, manifest: parsed.data };
}

/** Writes the manifest back with the file's own indentation. */
export const writeManifest = (
	{ file }: LoadedManifest,
	manifest: StackManifest,
): Promise<void> => writeJSONFile({ ...file, data: manifest });

/** Writes a new manifest, creating `.padosoft/`. */
export async function createManifest(
	path: string,
	manifest: StackManifest,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeJSONFile({ path, data: manifest, indent: "\t" });
}
