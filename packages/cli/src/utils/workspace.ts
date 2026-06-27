import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

export type DepMap = Record<string, string>;

export function sortDeps(deps: DepMap): DepMap {
	return Object.fromEntries(
		Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
	);
}

export async function readJSON<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
	await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function runCommand(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${cmd} ${args.join(" ")} exited with code ${String(code)}`));
		});
		child.on("error", reject);
	});
}

export async function formatFile(filePath: string): Promise<void> {
	await runCommand("bunx", ["biome", "format", filePath, "--write"]);
}

export function parsePackageSpec(spec: string): { name: string; version?: string } {
	// handles: expo | expo@beta | expo@1.2.3 | @scope/pkg@1.0.0
	const at = spec.lastIndexOf("@");
	if (at <= 0) return { name: spec };
	return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

export async function getTaggedVersion(
	pkg: string,
	tag: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		const chunks: Buffer[] = [];
		const child = spawn("npm", ["view", `${pkg}@${tag}`, "version"], {
			stdio: ["ignore", "pipe", "ignore"],
		});
		child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.on("close", () => {
			const result = Buffer.concat(chunks).toString("utf8").trim();
			resolve(result || null);
		});
		child.on("error", () => resolve(null));
	});
}

export async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length) as R[];
	let idx = 0;
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, async () => {
			while (true) {
				const i = idx++;
				if (i >= items.length) break;
				results[i] = await fn(items[i] as T);
			}
		}),
	);
	return results;
}
