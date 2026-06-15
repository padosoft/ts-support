import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfigFn } from "tsdown";
import { tsdown } from "./src/compiler/tsdown.ts";
import { defaultCustomExports } from "./src/compiler/utils/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assetsDirs = ["typescript", "tools"];
const assetsExts = ["json"];

const config: UserConfigFn = tsdown({
	entry: ["src/**/*.ts"],
	deps: {
		neverBundle: ["tsdown", "rolldown"],
	},
	exports: {
		customExports: async (exports, context) => {
			const assetExports: Record<string, string> = {
				...exports,
			};

			for (const dir of assetsDirs) {
				const absDir = path.join(__dirname, "src", dir);
				const files = await readdir(absDir);

				for (const file of files) {
					const ext = path.extname(file).slice(1);
					console.log(path.extname(file), ext);

					if (!assetsExts.includes(ext)) continue;

					const base = path.basename(file, `.${ext}`);
					const relPath = `./${dir}/${base}`;
					const fullRelPath = `./src/${dir}/${file}`;

					assetExports[relPath] = fullRelPath;
				}
			}

			return await defaultCustomExports(assetExports, context);
		},
	},
});

export default config;
