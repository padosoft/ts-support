import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	computeVersionCode,
	type EASBuild,
	findDuplicateBuild,
	incrementBuildNumber,
	loadAppBuildConfig,
	writeBuildNumber,
} from "../src/utils/build-number";

const NOW = new Date("2026-10-01T10:00:00Z");

describe("computeVersionCode", () => {
	test("sequential encodes semver + one-digit build slot", () => {
		expect(computeVersionCode("3.2.0", 0, "sequential", NOW)).toBe(302000);
		expect(computeVersionCode("3.1.5", 2, "sequential", NOW)).toBe(301052);
	});

	test("sequential rejects a buildNumber over 9", () => {
		expect(() => computeVersionCode("3.1.5", 10, "sequential", NOW)).toThrow(
			/ONE digit/,
		);
	});

	test("yearly and date ignore the semver", () => {
		expect(computeVersionCode("3.2.0", 32, "yearly", NOW)).toBe(2026032);
		expect(computeVersionCode("3.2.0", 32, "date", NOW)).toBe(20261001);
	});
});

describe("incrementBuildNumber", () => {
	test("sequential increments", () => {
		expect(incrementBuildNumber(3, "sequential", NOW)).toBe(4);
	});

	test("date returns today", () => {
		expect(incrementBuildNumber(20250101, "date", NOW)).toBe(20261001);
	});

	test("yearly restarts at 1 when the stored year is past", () => {
		expect(incrementBuildNumber(2025010, "yearly", NOW)).toBe(1);
		expect(incrementBuildNumber(32, "yearly", NOW)).toBe(33);
	});
});

describe("findDuplicateBuild", () => {
	const build = (b: Partial<EASBuild>): EASBuild => ({
		id: "abc",
		status: "FINISHED",
		platform: "ios",
		appVersion: "3.2.0",
		appBuildVersion: "5",
		channel: "production",
		...b,
	});

	test("iOS build numbers are unique per app version", () => {
		const builds = [build({ appVersion: "3.1.0" })];
		expect(findDuplicateBuild(builds, "3.2.0", "5", "ios")).toBeUndefined();
		expect(findDuplicateBuild(builds, "3.1.0", "5", "ios")).toBeDefined();
	});

	test("Android versionCodes are unique across versions", () => {
		const builds = [build({ appVersion: "3.1.0", platform: "android" })];
		expect(findDuplicateBuild(builds, "3.2.0", "5", "android")).toBeDefined();
	});

	test("errored/canceled builds do not count", () => {
		expect(
			findDuplicateBuild([build({ status: "ERRORED" })], "3.2.0", "5", "ios"),
		).toBeUndefined();
	});
});

describe("loadAppBuildConfig", () => {
	const makeApp = (pkg: Record<string, unknown>, config?: string) => {
		const appsDir = mkdtempSync(join(tmpdir(), "padosoft-build-"));
		const appDir = join(appsDir, "shop");
		mkdirSync(join(appDir, "src", "config"), { recursive: true });
		writeFileSync(
			join(appDir, "package.json"),
			`${JSON.stringify(pkg, null, "\t")}\n`,
		);
		if (config)
			writeFileSync(join(appDir, "src", "config", "index.ts"), config);
		return appsDir;
	};

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

		const bare = makeApp({ version: "1.0.0" });
		const config = await loadAppBuildConfig("shop", bare);
		expect(config.format).toBe("sequential");
		expect(config.buildNumber).toBe(0);
	});

	test("rejects an unknown format", async () => {
		const appsDir = makeApp({ version: "1.0.0" });
		await expect(loadAppBuildConfig("shop", appsDir, "weekly")).rejects.toThrow(
			/Invalid buildCodeFormat/,
		);
	});

	test("writeBuildNumber keeps the file's indentation", async () => {
		const appsDir = makeApp({ version: "1.0.0", buildNumber: 1 });
		const config = await loadAppBuildConfig("shop", appsDir);
		config.buildNumber = 2;
		await writeBuildNumber(config);
		expect(readFileSync(config.pkgPath, "utf8")).toBe(
			`{\n\t"version": "1.0.0",\n\t"buildNumber": 2\n}\n`,
		);
	});
});
