import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const writeFileWithDirs = async (
	filePath: string,
	content: string,
): Promise<void> => {
	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf8");
	console.log(`  create  ${filePath}`);
};

export const assertNotExists = (filePath: string): void => {
	if (existsSync(filePath)) {
		console.error(`  error   ${filePath} already exists`);
		process.exit(1);
	}
};

export const kebabCase = (str: string): string =>
	str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();

export const camelCase = (str: string): string =>
	str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export const pascalCase = (str: string): string => {
	const c = camelCase(str);
	return c.charAt(0).toUpperCase() + c.slice(1);
};
