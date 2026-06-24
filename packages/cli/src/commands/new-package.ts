import { join, resolve } from "node:path";
import { assertNotExists, kebabCase, writeFileWithDirs } from "../utils/fs";

interface NewPackageOptions {
	name?: string;
	type?: string;
	scope?: string;
}

const TS_PACKAGE_JSON = (scope: string, name: string) => `{
	"name": "${scope}/${name}",
	"description": "",
	"version": "1.0.0",
	"type": "module",
	"types": "./dist/index.d.mts",
	"files": ["dist"],
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org/"
	},
	"scripts": {
		"build": "tsdown",
		"ts:check": "tsc --noEmit"
	},
	"devDependencies": {
		"@padosoft/config": "npm:@padosoft/config@latest"
	},
	"dependencies": {}
}
`;

const RN_PACKAGE_JSON = (scope: string, name: string) => `{
	"name": "${scope}/${name}",
	"description": "",
	"version": "1.0.0",
	"type": "module",
	"types": "./dist/index.d.mts",
	"files": ["dist"],
	"publishConfig": {
		"access": "public",
		"registry": "https://registry.npmjs.org/"
	},
	"scripts": {
		"build": "tsdown",
		"ts:check": "tsc --noEmit"
	},
	"devDependencies": {
		"@padosoft/config": "npm:@padosoft/config@latest",
		"@types/react": "^19.0.0",
		"react": "^19.0.0",
		"react-native": "^0.79.0",
		"expo": "^53.0.0"
	},
	"peerDependencies": {
		"react": ">=19",
		"react-native": ">=0.79",
		"expo": ">=52"
	}
}
`;

const TS_TSCONFIG = `{
	"$schema": "https://json.schemastore.org/tsconfig",
	"extends": ["@padosoft/config/typescript/compiler"],
	"include": ["src"]
}
`;

const RN_TSCONFIG = `{
	"$schema": "https://json.schemastore.org/tsconfig",
	"extends": ["@padosoft/config/typescript/compiler"],
	"include": ["src"],
	"compilerOptions": {
		"verbatimModuleSyntax": false
	}
}
`;

const TS_TSDOWN = `import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	unbundle: true,
	exports: true,
});
`;

const RN_TSDOWN = `import { tsdown } from "@padosoft/config/compiler/tsdown";

export default tsdown({
	entry: ["src/**/*.ts", "src/**/*.tsx"],
	deps: {
		neverBundle: ["react", "react-native", "expo"],
	},
	unbundle: true,
	exports: true,
});
`;

const INDEX_TS = (pkgName: string) => `// ${pkgName}
export {};
`;

export const newPackage = async (opts: NewPackageOptions): Promise<void> => {
	const name = opts.name ? kebabCase(opts.name) : null;
	const type = opts.type ?? "ts";
	const scope = opts.scope ?? "@padosoft";

	if (!name) {
		console.error("  error   --name is required");
		process.exit(1);
	}

	if (type !== "ts" && type !== "rn") {
		console.error('  error   --type must be "ts" or "rn"');
		process.exit(1);
	}

	const cwd = process.cwd();
	const pkgDir = resolve(join(cwd, "packages", name));

	assertNotExists(pkgDir);

	console.log(`\nScaffolding ${scope}/${name} (${type}) in packages/${name}/\n`);

	const packageJson = type === "rn" ? RN_PACKAGE_JSON(scope, name) : TS_PACKAGE_JSON(scope, name);
	const tsconfig = type === "rn" ? RN_TSCONFIG : TS_TSCONFIG;
	const tsdown = type === "rn" ? RN_TSDOWN : TS_TSDOWN;

	await writeFileWithDirs(join(pkgDir, "package.json"), packageJson);
	await writeFileWithDirs(join(pkgDir, "tsconfig.json"), tsconfig);
	await writeFileWithDirs(join(pkgDir, "tsdown.config.ts"), tsdown);
	await writeFileWithDirs(join(pkgDir, "src/index.ts"), INDEX_TS(`${scope}/${name}`));

	console.log("\nDone. Run `bun install` to update the lockfile.");
};
