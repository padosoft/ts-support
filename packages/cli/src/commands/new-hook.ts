import { join, resolve } from "node:path";
import { assertNotExists, kebabCase, pascalCase, writeFileWithDirs } from "../utils/fs";

interface NewHookOptions {
	name?: string;
	pkg?: string;
}

const HOOK_TEMPLATE = (hookName: string, typeName: string) => `import { useState } from "react";

export interface ${typeName}Options {}

export interface ${typeName}Result {}

export const ${hookName} = (options: ${typeName}Options = {}): ${typeName}Result => {
	return {};
};
`;

export const newHook = async (opts: NewHookOptions): Promise<void> => {
	const rawName = opts.name;
	const pkg = opts.pkg;

	if (!rawName) {
		console.error("  error   --name is required");
		process.exit(1);
	}
	if (!pkg) {
		console.error("  error   --pkg is required");
		process.exit(1);
	}

	// Accept "AppState", "useAppState", "app-state" — normalise to useAppState
	const stripped = rawName.replace(/^use[-_]?/i, "");
	const hookName = `use${pascalCase(stripped)}`;
	const typeName = pascalCase(stripped);
	const fileName = `use-${kebabCase(stripped)}`;

	const cwd = process.cwd();
	const filePath = resolve(join(cwd, "packages", pkg, "src/hooks", `${fileName}.ts`));

	assertNotExists(filePath);

	console.log(`\nCreating hook ${hookName}\n`);
	await writeFileWithDirs(filePath, HOOK_TEMPLATE(hookName, typeName));
	console.log("\nDone.");
};
