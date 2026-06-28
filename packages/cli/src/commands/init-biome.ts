import { join } from "node:path";
import { readJSON, resolveDirs, writeIfNeeded } from "../utils/fs";

interface InitBiomeOptions {
	force?: boolean;
}

const getBiomeVersion = async (dir: string): Promise<string> => {
	try {
		const pkg = await readJSON<{ version: string }>(
			join(dir, "node_modules/@biomejs/biome/package.json"),
		);
		return pkg.version;
	} catch {
		return "2.5.1";
	}
};

export const initBiome = async (
	paths: string[],
	opts: InitBiomeOptions,
): Promise<void> => {
	const dirs = resolveDirs(paths);
	const force = opts.force ?? false;

	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		const version = await getBiomeVersion(dir);
		const content = JSON.stringify(
			{
				$schema: `https://biomejs.dev/schemas/${version}/schema.json`,
				extends: ["@padosoft/config/tools/biome"],
			},
			null,
			"\t",
		);
		await writeIfNeeded(`${content}\n`, join(dir, "biome.json"), force);
	}
};
