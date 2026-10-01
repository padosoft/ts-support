#!/usr/bin/env node

import sade from "sade";
import { buildBump, buildCheck, buildReset } from "./commands/build-number";
import { depAdd } from "./commands/dep-add";
import { expoUpdate } from "./commands/expo-update";
import { i18nExtract } from "./commands/i18n-extract";
import { initBiome } from "./commands/init-biome";
import { initTsconfig } from "./commands/init-tsconfig";
import { initTsdown } from "./commands/init-tsdown";
import { newPackage } from "./commands/new-package";
import { releaseApps } from "./commands/release-apps";
import { syncEditor } from "./commands/sync-editor";

const cli = sade("padosoft");

// Sade only shifts ONE positional arg for [arg...] variadic — the rest go into opts._.
// This helper reconstructs the full array.
function collectArgs(
	first: string | undefined,
	opts: { _?: string[] },
): string[] {
	return first !== undefined ? [first, ...(opts._ ?? [])] : (opts._ ?? []);
}

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

cli
	.command("sync editor [paths...]")
	.describe(
		"Copy .vscode + .zed settings from @padosoft/config to one or more repos",
	)
	.option("--force, -f", "Overwrite existing files", false)
	.example("sync editor")
	.example("sync editor ~/repos/app-a ~/repos/app-b --force")
	.action((first: string | undefined, opts) =>
		syncEditor(collectArgs(first, opts), opts),
	);

// ── init ─────────────────────────────────────────────────────────────────────

cli
	.command("init biome [paths...]")
	.describe(
		"Write biome.json extending @padosoft/config (schema version read from installed @biomejs/biome)",
	)
	.option("--force, -f", "Overwrite existing files", false)
	.example("init biome")
	.example("init biome ~/repos/app-a ~/repos/app-b")
	.action((first: string | undefined, opts) =>
		initBiome(collectArgs(first, opts), opts),
	);

cli
	.command("init tsconfig [paths...]")
	.describe("Write tsconfig.json extending @padosoft/config preset")
	.option("--preset, -p", "Preset: base | compiler | expo | hono", "base")
	.option("--force, -f", "Overwrite existing files", false)
	.example("init tsconfig --preset compiler")
	.example("init tsconfig ~/repos/app-a ~/repos/app-b --preset expo")
	.action((first: string | undefined, opts) =>
		initTsconfig(collectArgs(first, opts), opts),
	);

cli
	.command("init tsdown [paths...]")
	.describe("Write tsdown.config.ts extending @padosoft/config")
	.option("--type, -t", "Package type: ts | rn", "ts")
	.option("--force, -f", "Overwrite existing files", false)
	.example("init tsdown")
	.example("init tsdown --type rn")
	.example("init tsdown ~/repos/app-a --type ts --force")
	.action((first: string | undefined, opts) =>
		initTsdown(collectArgs(first, opts), opts),
	);

// ── dep ──────────────────────────────────────────────────────────────────────

cli
	.command("dep add [packages...]")
	.describe(
		"Add packages to workspace catalog and wire catalog: refs to apps/packages",
	)
	.option(
		"--tag, -t",
		"npm dist-tag to resolve if no explicit version given (e.g. beta, canary)",
	)
	.option(
		"--scope, -s",
		"Which workspace members get catalog: refs: app | package | all",
		"all",
	)
	.option("--dry-run, -d", "Print changes without writing", false)
	.option("--install, -i", "Run bun install after updating", false)
	.example("dep add expo@beta react-native@0.82.0")
	.example("dep add expo-camera --tag latest --scope app --install")
	.action((first: string | undefined, opts) =>
		depAdd(collectArgs(first, opts), opts),
	);

// ── expo ─────────────────────────────────────────────────────────────────────

cli
	.command("expo update")
	.describe(
		"Update all Expo packages in the current workspace to a given npm tag",
	)
	.option(
		"--tag, -t",
		"npm dist-tag: latest | next | canary | <custom> (prompts on a TTY, latest otherwise)",
	)
	.option(
		"--exclude, -e",
		"Comma-separated packages to skip",
		"expo-atlas,expo-quick-actions",
	)
	.example("expo update")
	.example("expo update --tag next")
	.example("expo update --tag canary --exclude expo-av,expo-video")
	.action(expoUpdate);

// ── build ────────────────────────────────────────────────────────────────────

cli
	.command("build bump <app>")
	.describe(
		"Increment apps/<app>/package.json buildNumber according to its build code format",
	)
	.option(
		"--format, -f",
		"Build code format override: sequential | yearly | date",
	)
	.option("--apps-dir", "Directory containing the apps", "apps")
	.example("build bump luisaviaroma")
	.action(buildBump);

cli
	.command("build check <app>")
	.describe(
		"Fail if the app's version + buildNumber was already used by an EAS build (optionally auto-increment)",
	)
	.option(
		"--auto-increment, -a",
		"Bump buildNumber until it is unique, then write it",
		false,
	)
	.option("--platform, -p", "Only check one platform: ios | android")
	.option(
		"--format, -f",
		"Build code format override: sequential | yearly | date",
	)
	.option("--apps-dir", "Directory containing the apps", "apps")
	.example("build check luisaviaroma")
	.example("build check luisaviaroma --auto-increment --platform android")
	.action(buildCheck);

cli
	.command("build reset")
	.describe(
		"After a version bump: reset sequential buildNumbers to 0, bump yearly/date ones (run after `changeset version`)",
	)
	.option("--apps-dir", "Directory containing the apps", "apps")
	.example("build reset")
	.action(buildReset);

// ── release ──────────────────────────────────────────────────────────────────

cli
	.command("release apps")
	.describe(
		"Tag every app as <name>@<version> and publish a GitHub Release from its CHANGELOG (idempotent)",
	)
	.option("--dry-run, -d", "Print what would be tagged/released", false)
	.option("--apps-dir", "Directory containing the apps", "apps")
	.example("release apps --dry-run")
	.example("release apps")
	.action(releaseApps);

// ── i18n ─────────────────────────────────────────────────────────────────────

cli
	.command("i18n extract [paths...]")
	.describe(
		"Extract i18n translation keys in flat dot-notation from a locale file",
	)
	.option("--format, -f", "Output format: array | object", "array")
	.option("--file", "Write output to a file instead of stdout")
	.option("--table, -t", "Print as a table", false)
	.example("i18n extract packages/i18n/src/locales/en/index.ts")
	.example(
		"i18n extract packages/i18n/src/locales/en --format object --file keys.json",
	)
	.action((first: string | undefined, opts) =>
		i18nExtract(collectArgs(first, opts), opts),
	);

cli.parse(process.argv);
