#!/usr/bin/env node
import sade from "sade";
import { newPackage } from "./commands/new-package";
import { initBiome, initTsconfig, syncEditor } from "./commands/sync";

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

// ── init ─────────────────────────────────────────────────────────────────────
// One-time bootstrapping of config files in a repo.

cli
	.command("init biome [paths...]")
	.describe("Write biome.json extending @padosoft/config in one or more repos")
	.option("--force, -f", "Overwrite existing files", false)
	.example("init biome")
	.example("init biome ~/repos/app-a ~/repos/app-b")
	.action(initBiome);

cli
	.command("init tsconfig [paths...]")
	.describe("Write tsconfig.json extending @padosoft/config preset in one or more repos")
	.option("--preset, -p", "Preset: base | compiler | expo | hono", "base")
	.option("--force, -f", "Overwrite existing files", false)
	.example("init tsconfig --preset compiler")
	.example("init tsconfig ~/repos/app-a ~/repos/app-b --preset expo")
	.action(initTsconfig);

cli.parse(process.argv);
