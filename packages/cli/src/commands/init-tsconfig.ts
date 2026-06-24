import { join } from "node:path";
import { resolveDirs, writeIfNeeded } from "../utils/fs";

const VALID_PRESETS = ["base", "compiler", "expo", "hono"] as const;
type TsconfigPreset = (typeof VALID_PRESETS)[number];

interface InitTsconfigOptions {
	preset?: string;
	force?: boolean;
}

export const initTsconfig = async (
	paths: string[],
	opts: InitTsconfigOptions,
): Promise<void> => {
	const dirs = resolveDirs(paths);
	const preset = opts.preset ?? "base";
	const force = opts.force ?? false;

	if (!VALID_PRESETS.includes(preset as TsconfigPreset)) {
		console.error(`Unknown preset "${preset}" — valid: ${VALID_PRESETS.join(", ")}`);
		process.exit(1);
	}

	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		const content = JSON.stringify(
			{ extends: `@padosoft/config/typescript/${preset}` },
			null,
			"\t",
		);
		await writeIfNeeded(`${content}\n`, join(dir, "tsconfig.json"), force);
	}
};
