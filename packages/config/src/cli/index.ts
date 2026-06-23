#!/usr/bin/env node
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options: {
		force: { type: "boolean", short: "f", default: false },
		preset: { type: "string", default: "base" },
	},
	allowPositionals: true,
});

const [command, subcommand] = positionals;
const force = values.force as boolean;
const preset = values.preset as string;

const TSCONFIG_PRESETS = ["base", "compiler", "expo", "hono"] as const;
type TsconfigPreset = (typeof TSCONFIG_PRESETS)[number];

async function copyIfNeeded(src: string, dest: string, label: string) {
	if (existsSync(dest) && !force) {
		console.log(`  skip  ${label}`);
		return;
	}
	await copyFile(src, dest);
	console.log(`  write ${label}`);
}

async function writeIfNeeded(content: string, dest: string, label: string) {
	if (existsSync(dest) && !force) {
		console.log(`  skip  ${label}`);
		return;
	}
	await writeFile(dest, content, "utf8");
	console.log(`  write ${label}`);
}

function usage() {
	console.log("Usage:");
	console.log("  bunx @padosoft/config init editor   [--force]");
	console.log("  bunx @padosoft/config init biome    [--force]");
	console.log(
		"  bunx @padosoft/config init tsconfig [--preset base|compiler|expo|hono] [--force]",
	);
}

if (command !== "init") {
	usage();
	process.exit(1);
}

const cwd = process.cwd();

if (subcommand === "editor") {
	const editorDir = join(__dirname, "../../src/editor");

	await mkdir(join(cwd, ".vscode"), { recursive: true });
	await copyIfNeeded(
		join(editorDir, "vscode/settings.json"),
		join(cwd, ".vscode/settings.json"),
		".vscode/settings.json",
	);

	await mkdir(join(cwd, ".zed"), { recursive: true });
	await copyIfNeeded(
		join(editorDir, "zed/settings.json"),
		join(cwd, ".zed/settings.json"),
		".zed/settings.json",
	);
} else if (subcommand === "biome") {
	const config = {
		$schema: "https://biomejs.dev/schemas/2.5.1/schema.json",
		extends: ["@padosoft/config/tools/biome"],
	};
	await writeIfNeeded(
		`${JSON.stringify(config, null, "\t")}\n`,
		join(cwd, "biome.json"),
		"biome.json",
	);
} else if (subcommand === "tsconfig") {
	if (!TSCONFIG_PRESETS.includes(preset as TsconfigPreset)) {
		console.error(`Unknown preset "${preset}" — valid: ${TSCONFIG_PRESETS.join(", ")}`);
		process.exit(1);
	}
	await writeIfNeeded(
		`${JSON.stringify({ extends: `@padosoft/config/typescript/${preset}` }, null, "\t")}\n`,
		join(cwd, "tsconfig.json"),
		"tsconfig.json",
	);
} else {
	usage();
	process.exit(1);
}
