#!/usr/bin/env node
import sade from "sade";
import { newPackage } from "./commands/new-package";
import { syncBiome, syncEditor, syncTsconfig } from "./commands/sync";

const cli = sade("padosoft");

// ── new ──────────────────────────────────────────────────────────────────────

cli
	.command("new package")
	.describe("Scaffold a new package in the monorepo")
	.option("--name, -n", "Package name without scope (e.g. my-lib)")
	.option("--type, -t", "Package type: ts | rn", "ts")
	.option("--scope, -s", "npm scope", "@padosoft")
	.example("new package --name my-lib --type ts")
	.example("new package --name rn-utils --type rn --scope @myorg")
	.action(newPackage);

// ── sync ─────────────────────────────────────────────────────────────────────
// Apply @padosoft/config settings to one or more repo directories.
// Omitting [paths...] targets the current working directory.

cli
	.command("sync editor [paths...]")
	.describe("Copy .vscode + .zed settings from @padosoft/config to one or more repos")
	.option("--force, -f", "Overwrite existing files", false)
	.example("sync editor")
	.example("sync editor ~/repos/app-a ~/repos/app-b --force")
	.action(syncEditor);

cli
	.command("sync biome [paths...]")
	.describe("Write biome.json extending @padosoft/config to one or more repos")
	.option("--force, -f", "Overwrite existing files", false)
	.example("sync biome ~/repos/app-a ~/repos/app-b")
	.action(syncBiome);

cli
	.command("sync tsconfig [paths...]")
	.describe("Write tsconfig.json extending @padosoft/config preset to one or more repos")
	.option("--preset, -p", "Preset: base | compiler | expo | hono", "base")
	.option("--force, -f", "Overwrite existing files", false)
	.example("sync tsconfig --preset compiler")
	.example("sync tsconfig ~/repos/app-a ~/repos/app-b --preset expo")
	.action(syncTsconfig);

cli.parse(process.argv);
