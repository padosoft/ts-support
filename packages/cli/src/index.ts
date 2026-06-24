#!/usr/bin/env node
import sade from "sade";
import { newComponent } from "./commands/new-component";
import { newHook } from "./commands/new-hook";
import { newPackage } from "./commands/new-package";
import { createChangeset } from "./commands/changeset";

const cli = sade("padosoft");

cli
	.command("new package")
	.describe("Scaffold a new package in the monorepo")
	.option("--name, -n", "Package name (without scope, e.g. 'my-lib')")
	.option("--type, -t", "Package type: ts | rn", "ts")
	.option("--scope, -s", "npm scope (default: @padosoft)", "@padosoft")
	.example("new package --name my-lib --type ts")
	.example("new package --name rn-utils --type rn --scope @myorg")
	.action(newPackage);

cli
	.command("new component")
	.describe("Scaffold a React Native component in an existing package")
	.option("--name, -n", "Component name in PascalCase (e.g. 'Button')")
	.option("--pkg, -p", "Target package directory under packages/ (e.g. 'rn-ui')")
	.option("--variants", "Include class-variance-authority variants", false)
	.example("new component --name Button --pkg rn-ui")
	.example("new component --name Badge --pkg rn-ui --variants")
	.action(newComponent);

cli
	.command("new hook")
	.describe("Scaffold a React hook in an existing package")
	.option("--name, -n", "Hook name without use- prefix (e.g. 'AppState')")
	.option("--pkg, -p", "Target package directory under packages/ (e.g. 'react-native')")
	.example("new hook --name AppState --pkg react-native")
	.action(newHook);

cli
	.command("changeset")
	.describe("Create a changeset file for a package bump")
	.option("--pkg, -p", "Package name (e.g. @padosoft/utilities)")
	.option("--type, -t", "Bump type: major | minor | patch", "minor")
	.option("--message, -m", "Changeset description")
	.example('changeset --pkg @padosoft/utilities --type minor --message "add withZodDefaults"')
	.action(createChangeset);

cli.parse(process.argv);
