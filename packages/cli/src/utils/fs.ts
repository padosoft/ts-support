import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const writeIfNeeded = async (
	content: string,
	dest: string,
	force: boolean,
): Promise<void> => {
	if (existsSync(dest) && !force) {
		console.log(`  skip    ${dest}`);
		return;
	}
	await mkdir(dirname(dest), { recursive: true });
	await writeFile(dest, content, "utf8");
	console.log(`  write   ${dest}`);
};

export const copyIfNeeded = async (
	src: string,
	dest: string,
	force: boolean,
): Promise<void> => {
	if (existsSync(dest) && !force) {
		console.log(`  skip    ${dest}`);
		return;
	}
	await mkdir(dirname(dest), { recursive: true });
	await copyFile(src, dest);
	console.log(`  write   ${dest}`);
};

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

export const readJsonFile = async <T>(filePath: string): Promise<T | null> => {
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
};

export const resolveDirs = (paths: string[]): string[] =>
	paths.length > 0 ? paths.map((p) => resolve(p)) : [process.cwd()];

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
