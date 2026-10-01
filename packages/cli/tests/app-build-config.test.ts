import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	loadAppBuildConfig,
	writeBuildNumber,
} from "../src/utils/app-build-config";

const makeApp = (pkg: Record<string, unknown>, config?: string) => {
	const appsDir = mkdtempSync(join(tmpdir(), "padosoft-build-"));
	const appDir = join(appsDir, "shop");
	mkdirSync(join(appDir, "src", "config"), { recursive: true });
	writeFileSync(
		join(appDir, "package.json"),
		`${JSON.stringify(pkg, null, "\t")}\n`,
	);
	if (config) writeFileSync(join(appDir, "src", "config", "index.ts"), config);
	return appsDir;
};

describe("loadAppBuildConfig", () => {
	test("resolves format: --format > package.json > app config > sequential", async () => {
		const appsDir = makeApp(
			{ version: "1.0.0", buildNumber: 4 },
			`export default { buildCodeFormat: "yearly" };\n`,
		);
		expect((await loadAppBuildConfig("shop", appsDir)).format).toBe("yearly");
		expect((await loadAppBuildConfig("shop", appsDir, "date")).format).toBe(
			"date",
		);

		const fromPkg = makeApp({ version: "1.0.0", buildCodeFormat: "date" });
		expect((await loadAppBuildConfig("shop", fromPkg)).format).toBe("date");

		const config = await loadAppBuildConfig(
			"shop",
			makeApp({ version: "1.0.0" }),
		);
		expect(config.format).toBe("sequential");
		expect(config.buildNumber).toBe(0);
	});

	test("rejects an unknown format", async () => {
		await expect(
			loadAppBuildConfig("shop", makeApp({ version: "1.0.0" }), "weekly"),
		).rejects.toThrow(/Invalid buildCodeFormat/);
	});

	test("fails loudly when the app config cannot be imported", async () => {
		const appsDir = makeApp(
			{ version: "1.0.0" },
			`import x from "./missing";\nexport default x;\n`,
		);
		await expect(loadAppBuildConfig("shop", appsDir)).rejects.toThrow(
			/Cannot import/,
		);
	});
});

test("writeBuildNumber keeps the file's indentation", async () => {
	const config = await loadAppBuildConfig(
		"shop",
		makeApp({ version: "1.0.0", buildNumber: 1 }),
	);
	config.buildNumber = 2;
	await writeBuildNumber(config);
	expect(readFileSync(config.manifest.path, "utf8")).toBe(
		`{\n\t"version": "1.0.0",\n\t"buildNumber": 2\n}\n`,
	);
});
