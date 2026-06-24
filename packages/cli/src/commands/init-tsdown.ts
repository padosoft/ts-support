import { join } from "node:path";
import { resolveDirs, writeIfNeeded } from "../utils/fs";

export const TSDOWN_CONTENT = {
	ts: `import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
\tentry: ["src/**/*.ts"],
\tunbundle: true,
\texports: true,
});
`,
	rn: `import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
\tentry: ["src/**/*.ts", "src/**/*.tsx"],
\tdeps: {
\t\tneverBundle: ["react", "react-native", "expo"],
\t},
\tunbundle: true,
\texports: true,
});
`,
} as const;

export type TsdownType = keyof typeof TSDOWN_CONTENT;

const VALID_TYPES = Object.keys(TSDOWN_CONTENT) as TsdownType[];

interface InitTsdownOptions {
	type?: string;
	force?: boolean;
}

export const initTsdown = async (
	paths: string[],
	opts: InitTsdownOptions,
): Promise<void> => {
	const dirs = resolveDirs(paths);
	const type = opts.type ?? "ts";
	const force = opts.force ?? false;

	if (!VALID_TYPES.includes(type as TsdownType)) {
		console.error(`Unknown type "${type}" — valid: ${VALID_TYPES.join(", ")}`);
		process.exit(1);
	}

	const content = TSDOWN_CONTENT[type as TsdownType];

	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		await writeIfNeeded(content, join(dir, "tsdown.config.ts"), force);
	}
};
