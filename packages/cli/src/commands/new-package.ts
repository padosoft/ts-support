import { join, resolve } from "node:path";
import { chalk } from "@padosoft/utilities/lib/chalk";
import { assertNotExists, kebabCase, writeFileWithDirs } from "../utils/fs";
import { TSDOWN_CONTENT } from "./init-tsdown";

interface NewPackageOptions {
	name?: string;
	type?: string;
	scope?: string;
}

const PACKAGE_JSON = (scope: string, name: string, type: "ts" | "rn") => {
	const base = {
		name: `${scope}/${name}`,
		description: "",
		version: "1.0.0",
		type: "module",
		types: "./dist/index.d.mts",
		files: ["dist"],
		publishConfig: {
			access: "public",
			registry: "https://registry.npmjs.org/",
		},
		scripts: {
			build: "tsdown",
			"ts:check": "tsc --noEmit",
		},
		devDependencies: {
			"@padosoft/config": "npm:@padosoft/config@latest",
			...(type === "rn" && {
				"@types/react": "^19.0.0",
				react: "^19.0.0",
				"react-native": "^0.79.0",
				expo: "^53.0.0",
			}),
		},
		dependencies: {},
		...(type === "rn" && {
			peerDependencies: {
				react: ">=19",
				"react-native": ">=0.79",
				expo: ">=52",
			},
		}),
	};
	return `${JSON.stringify(base, null, "\t")}\n`;
};

const TSCONFIG = (type: "ts" | "rn") => {
	const base = {
		$schema: "https://json.schemastore.org/tsconfig",
		extends: ["@padosoft/config/typescript/compiler"],
		include: ["src"],
		...(type === "rn" && { compilerOptions: { verbatimModuleSyntax: false } }),
	};
	return `${JSON.stringify(base, null, "\t")}\n`;
};

const INDEX_TS = (pkgName: string) => `// ${pkgName}\nexport {};\n`;

export const newPackage = async (opts: NewPackageOptions): Promise<void> => {
	const name = opts.name ? kebabCase(opts.name) : null;
	const type = (opts.type ?? "ts") as "ts" | "rn";
	const scope = opts.scope ?? "@padosoft";

	if (!name) {
		console.error(`  ${chalk.red("error")}   --name is required`);
		process.exit(1);
	}

	if (type !== "ts" && type !== "rn") {
		console.error(`  ${chalk.red("error")}   --type must be "ts" or "rn"`);
		process.exit(1);
	}

	const pkgDir = resolve(join(process.cwd(), "packages", name));

	assertNotExists(pkgDir);

	console.log(`\nScaffolding ${chalk.cyan(`${scope}/${name}`)} (${type}) in packages/${name}/\n`);

	await writeFileWithDirs(join(pkgDir, "package.json"), PACKAGE_JSON(scope, name, type));
	await writeFileWithDirs(join(pkgDir, "tsconfig.json"), TSCONFIG(type));
	await writeFileWithDirs(join(pkgDir, "tsdown.config.ts"), TSDOWN_CONTENT[type]);
	await writeFileWithDirs(join(pkgDir, "src/index.ts"), INDEX_TS(`${scope}/${name}`));

	console.log(`\n${chalk.green("Done.")} Run \`bun install\` to update the lockfile.`);
};
