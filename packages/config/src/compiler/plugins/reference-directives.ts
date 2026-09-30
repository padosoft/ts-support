import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Rolldown } from "tsdown";

const DTS_FILE = /\.d\.([cm]?)ts$/;
const PRESERVED_DIRECTIVE = /^\/\/\/\s*<reference\s[^>]*\bpreserve="true"/;
const PATH_ATTRIBUTE = /\bpath="([^"]+)"/;

/**
 * The sources rolldown-plugin-dts names a declaration module after:
 * `a.ts` / `a.tsx` → `a.d.ts`, `a.mts` → `a.d.mts`, `a.cts` → `a.d.cts`.
 */
const sourceCandidates = (dtsModuleId: string): string[] => {
	const match = DTS_FILE.exec(dtsModuleId);
	if (!match) return [];

	const base = dtsModuleId.slice(0, match.index);
	return match[1] ? [`${base}.${match[1]}ts`] : [`${base}.ts`, `${base}.tsx`];
};

/** Directives only count before the first statement, so stop there. */
const preservedDirectives = (source: string): string[] => {
	const directives: string[] = [];
	for (const line of source.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (PRESERVED_DIRECTIVE.test(trimmed)) directives.push(trimmed);
		else if (trimmed && !/^(\/\/|\/\*|\*)/.test(trimmed)) break;
	}
	return directives;
};

/** A `path` reference is relative to its source: make it relative to `outFile`. */
const rebase = (directive: string, source: string, outFile: string): string =>
	directive.replace(PATH_ATTRIBUTE, (_, reference: string) => {
		const target = path.resolve(path.dirname(source), reference);
		const relative = path.relative(path.dirname(outFile), target);
		return `path="${relative.split(path.sep).join("/")}"`;
	});

// Don't write a directive in the doc comment below: rolldown-plugin-dts would
// hoist the whole comment to the top of the `.d.mts` as if it were one.
/**
 * Keeps the triple-slash reference directives marked `preserve="true"` in the
 * declaration files built by tsdown (rolldown-plugin-dts), as `tsc` does.
 * Oxc's declaration emit, used with `isolatedDeclarations`, drops them: an
 * entry made only of directives was published as an empty `export {}`.
 *
 * Unmarked directives are left out, as `tsc` leaves them out since TypeScript
 * 5.5. `path` references are rebased on the output file, so the file they point
 * to must be published too (e.g. from `src`).
 *
 * Already part of the `tsdown()` factory in `@padosoft/config/compiler/tsdown`.
 */
export const referenceDirectives = (): Rolldown.Plugin => ({
	name: "padosoft:reference-directives",
	renderChunk: {
		// After rolldown-plugin-dts has rendered the declarations.
		order: "post",
		handler(code, chunk, { dir, file }) {
			if (!DTS_FILE.test(chunk.fileName)) return null;

			const outDir = dir ?? (file ? path.dirname(file) : undefined);
			if (!outDir) return null;
			const outFile = path.join(outDir, chunk.fileName);

			const directives = new Set<string>();
			for (const moduleId of chunk.moduleIds) {
				const source = sourceCandidates(moduleId).find(existsSync);
				if (!source) continue;

				for (const directive of preservedDirectives(
					readFileSync(source, "utf8"),
				)) {
					directives.add(rebase(directive, source, outFile));
				}
			}

			const missing = [...directives].filter(
				(directive) => !code.includes(directive),
			);
			return missing.length ? `${missing.join("\n")}\n${code}` : null;
		},
	},
});
