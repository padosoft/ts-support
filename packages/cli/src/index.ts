#!/usr/bin/env node

import sade from "sade";
import { agentsSetup } from "./commands/agents-setup";
import { buildBump } from "./commands/build-bump";
import { buildCheck } from "./commands/build-check";
import { buildReset } from "./commands/build-reset";
import { contractGen } from "./commands/contract-gen";
import { depAdd } from "./commands/dep-add";
import { expoUpdate } from "./commands/expo-update";
import { i18nExtract } from "./commands/i18n-extract";
import { initBiome } from "./commands/init-biome";
import { initTsconfig } from "./commands/init-tsconfig";
import { initTsdown } from "./commands/init-tsdown";
import { newPackage } from "./commands/new-package";
import { releaseApps } from "./commands/release-apps";
import {
	stackContext,
	stackPlan,
	stackSkill,
	stackStatus,
	stackValidate,
} from "./commands/stack";
import {
	stackApply,
	stackDoctor,
	stackInit,
	stackMark,
	stackMigrate,
	stackVerify,
} from "./commands/stack-change";
import { syncEditor } from "./commands/sync-editor";
import { withErrorHandling } from "./utils/errors";

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
	.action(withErrorHandling(buildBump));

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
	.action(withErrorHandling(buildCheck));

cli
	.command("build reset")
	.describe(
		"After a version bump: reset sequential buildNumbers to 0, bump yearly/date ones (run after `changeset version`)",
	)
	.option("--apps-dir", "Directory containing the apps", "apps")
	.example("build reset")
	.action(withErrorHandling(buildReset));

// ── styles-contract ─────────────────────────────────────────────────────────────────

cli
	.command("styles-contract gen")
	.describe(
		"Statically extract every fn(path, defaults, options?) call into a typed contract + defaults JSON",
	)
	.option("--fn, -f", "Function whose calls define the contract (required)")
	.option("--src, -s", "Source directories to scan, comma-separated", "src")
	.option("--out, -o", "Output directory", "src/contract")
	.option("--name, -n", "Name of the generated interface", "Contract")
	.option(
		"--variant-type",
		"Name of the generated union of paths that take a variant (default <name>VariantPath)",
	)
	.option(
		"--namespaces",
		"Path namespaces, comma-separated; unprefixed paths get the first (e.g. components,screens)",
	)
	.option(
		"--variant-prop",
		"Option property that marks a call as taking a variant",
		"variant",
	)
	.option(
		"--variants-key",
		"Defaults key that holds the variants (not a slot)",
		"variants",
	)
	.option(
		"--opaque",
		"Expression roots kept as { $expr } instead of evaluated, comma-separated",
		"Platform.select,StyleSheet",
	)
	.option("--check, -c", "Fail if the generated files are out of date", false)
	.option(
		"--minify, -m",
		"Minify the output: single-line JSON, no comments or whitespace in the contract (implies --no-format)",
		false,
	)
	.option("--no-format", "Do not format the output with the project's Biome")
	.example(
		"styles-contract gen --fn useStyleOverride --src packages/core/src,packages/ui/src --out packages/ui/src/style-contract --name StyleContract --namespaces components,screens",
	)
	.example("styles-contract gen --fn useStyleOverride --check")
	.action(withErrorHandling(contractGen));

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
	.action(withErrorHandling(releaseApps));

// ── stack ────────────────────────────────────────────────────────────────────
// Every stack command reads the stacks source from --source or
// $PADOSOFT_STACKS_SOURCE: a local folder, or a git URL cached under
// ~/.cache/padosoft/stacks and refreshed when older than 6 hours.

const SOURCE_FLAG =
	"Stacks source: local folder or git URL (default $PADOSOFT_STACKS_SOURCE)";
const REFRESH_FLAG = "Fetch the stacks source now, whatever the cache age";
const OFFLINE_FLAG = "Use the cached stacks source without fetching";

cli
	.command("stack status")
	.describe(
		"Show the project's stacks, choices and pending migrations from .padosoft/stack.json",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option("--json", "Print as JSON", false)
	.example("stack status")
	.example("stack status --json --offline")
	.action(withErrorHandling(stackStatus));

cli
	.command("stack context")
	.describe(
		"Print the rules and skills index that apply to this project, for a coding agent",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option(
		"--if-present",
		"For session hooks: print nothing outside a stack project, never fail",
		false,
	)
	.example("stack context")
	.example("stack context --if-present")
	.action(withErrorHandling(stackContext));

cli
	.command("stack skill <name>")
	.describe("Print one skill of the project's stacks")
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.example("stack skill add-otel")
	.action(withErrorHandling(stackSkill));

cli
	.command("stack plan")
	.describe(
		"List the migrations pending for this project, in the order to apply them",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option("--json", "Print as JSON", false)
	.example("stack plan")
	.action(withErrorHandling(stackPlan));

cli
	.command("stack migrate <id>")
	.describe(
		"Run a pending migration's package changes and codemod, then print its manual steps",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.example("stack migrate mobile/2026.12-flashlist-to-legend-list")
	.action(withErrorHandling(stackMigrate));

cli
	.command("stack verify <id>")
	.describe("Run a pending migration's verify commands")
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.example("stack verify mobile/2026.12-flashlist-to-legend-list")
	.action(withErrorHandling(stackVerify));

cli
	.command("stack mark <id>")
	.describe(
		"Run a migration's verify commands, then record it as applied with the choices it sets",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.example("stack mark mobile/2026.12-flashlist-to-legend-list")
	.action(withErrorHandling(stackMark));

cli
	.command("stack apply <recipe>")
	.describe(
		"Apply a recipe (packages, files, JSON merges) and record the choice or feature it stands for",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option(
		"--force, -f",
		"Overwrite project files that differ from the recipe's",
		false,
	)
	.example("stack apply feature/otel")
	.example("stack apply styling/uniwind")
	.action(withErrorHandling(stackApply));

cli
	.command("stack init")
	.describe(
		"Create .padosoft/stack.json here and apply the init, choice and feature recipes",
	)
	.option("--stack, -s", "Stack id (repeat or comma-separate for several)")
	.option(
		"--choice, -c",
		"axis=option (repeat or comma-separate); asked for on a TTY when missing",
	)
	.option("--feature", "Feature to add (repeat or comma-separate)")
	.option(
		"--defaults",
		"Use each axis default for choices not given (non-interactive)",
		false,
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option(
		"--force, -f",
		"Overwrite project files that differ from the recipes'",
		false,
	)
	.example("stack init --stack mobile")
	.example(
		"stack init --stack mobile --choice styling=uniwind,lint=biome --feature otel",
	)
	.example("stack init --stack api --defaults")
	.action(withErrorHandling(stackInit));

cli
	.command("stack doctor")
	.describe(
		"Fail when the project drifted from its stacks: problems, unset axes, pending migrations, packages (for CI)",
	)
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.option("--json", "Print as JSON", false)
	.example("stack doctor")
	.action(withErrorHandling(stackDoctor));

cli
	.command("stack validate")
	.describe("Check a whole stacks source (for its authors and CI)")
	.option("--source", SOURCE_FLAG)
	.option("--refresh", REFRESH_FLAG, false)
	.option("--offline", OFFLINE_FLAG, false)
	.example("stack validate --source .")
	.action(withErrorHandling(stackValidate));

// ── agents ───────────────────────────────────────────────────────────────────

cli
	.command("agents setup")
	.describe(
		"Make coding agents on this machine load `padosoft stack context` at session start",
	)
	.option(
		"--agents, -a",
		"Comma-separated: claude, codex, gemini (default: those installed)",
	)
	.option(
		"--source",
		"Stacks source baked into the command (otherwise $PADOSOFT_STACKS_SOURCE)",
	)
	.option("--dry-run, -d", "Show what would change", false)
	.example("agents setup --source git@github.com:acme/stacks.git")
	.example("agents setup --agents claude,codex --dry-run")
	.action(withErrorHandling(agentsSetup));

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
