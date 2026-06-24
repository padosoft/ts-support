import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve assets bundled with @padosoft/config (installed alongside this CLI)
const configPkg = dirname(
	require.resolve("@padosoft/config/package.json"),
);

const writeIfNeeded = async (
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

const copyIfNeeded = async (
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

const syncEditorTo = async (dir: string, force: boolean): Promise<void> => {
	const editorDir = join(configPkg, "src", "editor");
	await mkdir(join(dir, ".vscode"), { recursive: true });
	await copyIfNeeded(
		join(editorDir, "vscode/settings.json"),
		join(dir, ".vscode/settings.json"),
		force,
	);
	await mkdir(join(dir, ".zed"), { recursive: true });
	await copyIfNeeded(
		join(editorDir, "zed/settings.json"),
		join(dir, ".zed/settings.json"),
		force,
	);
};

const syncBiomeTo = async (dir: string, force: boolean): Promise<void> => {
	const config = JSON.stringify(
		{
			$schema: "https://biomejs.dev/schemas/2.5.1/schema.json",
			extends: ["@padosoft/config/tools/biome"],
		},
		null,
		"\t",
	);
	await writeIfNeeded(`${config}\n`, join(dir, "biome.json"), force);
};

const syncTsconfigTo = async (
	dir: string,
	preset: string,
	force: boolean,
): Promise<void> => {
	const content = JSON.stringify(
		{ extends: `@padosoft/config/typescript/${preset}` },
		null,
		"\t",
	);
	await writeIfNeeded(`${content}\n`, join(dir, "tsconfig.json"), force);
};

// ---------- exported command handlers ----------

interface SyncEditorOptions {
	force?: boolean;
}

export const syncEditor = async (
	paths: string[],
	opts: SyncEditorOptions,
): Promise<void> => {
	const dirs = paths.length > 0 ? paths.map((p) => resolve(p)) : [process.cwd()];
	const force = opts.force ?? false;
	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		await syncEditorTo(dir, force);
	}
};

interface InitBiomeOptions {
	force?: boolean;
}

export const initBiome = async (
	paths: string[],
	opts: InitBiomeOptions,
): Promise<void> => {
	const dirs = paths.length > 0 ? paths.map((p) => resolve(p)) : [process.cwd()];
	const force = opts.force ?? false;
	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		await syncBiomeTo(dir, force);
	}
};

interface InitTsconfigOptions {
	preset?: string;
	force?: boolean;
}

export const initTsconfig = async (
	paths: string[],
	opts: InitTsconfigOptions,
): Promise<void> => {
	const dirs = paths.length > 0 ? paths.map((p) => resolve(p)) : [process.cwd()];
	const preset = opts.preset ?? "base";
	const force = opts.force ?? false;
	const VALID = ["base", "compiler", "expo", "hono"];
	if (!VALID.includes(preset)) {
		console.error(`Unknown preset "${preset}" — valid: ${VALID.join(", ")}`);
		process.exit(1);
	}
	for (const dir of dirs) {
		console.log(`\n→ ${dir}`);
		await syncTsconfigTo(dir, preset, force);
	}
};
