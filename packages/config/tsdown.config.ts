import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfigFn } from "tsdown";
import { tsdown } from "./src/compiler/tsdown.ts";
import { defaultCustomExports } from "./src/compiler/utils/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const assetsDirs = ["typescript", "tools"];
const assetsExts = ["json"];

/**
 * The `/// <reference />` directives of the source behind a declaration chunk,
 * with `path` ones made relative to `outFile`. Oxc's declaration emit drops
 * them, so entries made only of directives (`src/types/nativewind.ts`,
 * `src/types/css.ts`) were published as `export {}`.
 */
const referenceDirectives = (
	dtsModuleId: string,
	outFile: string,
): string | undefined => {
	// rolldown-plugin-dts names the declarations of `x.ts` `x.d.ts`.
	const source = dtsModuleId.replace(/\.d\.ts$/, ".ts");
	if (source === dtsModuleId || !existsSync(source)) return;

	const directives = readFileSync(source, "utf8")
		.split(/\r?\n/)
		.filter((line) => /^\/\/\/\s*<reference\s/.test(line))
		.map((line) =>
			line.replace(/path="([^"]+)"/, (_, reference: string) => {
				const target = path.resolve(path.dirname(source), reference);
				const relative = path.relative(path.dirname(outFile), target);
				return `path="${relative.split(path.sep).join("/")}"`;
			}),
		);

	return directives.length ? directives.join("\n") : undefined;
};

const config: UserConfigFn = tsdown({
	// `.d.ts` sources (e.g. `src/types/ambient`) ship as they are.
	entry: ["src/**/*.ts", "!src/**/*.d.ts"],
	plugins: [
		{
			name: "padosoft:reference-directives",
			renderChunk: {
				// After rolldown-plugin-dts has rendered the declarations.
				order: "post",
				handler: (code, chunk, { dir }) => {
					if (!chunk.fileName.endsWith(".d.mts") || !chunk.facadeModuleId) {
						return null;
					}
					if (!dir) return null;

					const directives = referenceDirectives(
						chunk.facadeModuleId,
						path.join(dir, chunk.fileName),
					);
					return directives ? `${directives}\n${code}` : null;
				},
			},
		},
	],
	deps: {
		neverBundle: ["tsdown", "rolldown", "unplugin"],
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
