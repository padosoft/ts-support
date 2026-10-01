import { describe, expect, test } from "bun:test";
import type { BuildPlatform } from "@padosoft/utilities/lib/build-number";
import {
	type EASBuild,
	findBuildCollision,
	findDuplicateBuild,
	findUniqueBuildNumber,
} from "../src/utils/eas";

const build = (b: Partial<EASBuild>): EASBuild => ({
	id: "abcdef123456",
	status: "FINISHED",
	platform: "ios",
	appVersion: "3.2.0",
	appBuildVersion: "5",
	channel: "production",
	...b,
});

describe("findDuplicateBuild", () => {
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

describe("collisions", () => {
	const state = {
		version: "3.2.0",
		buildNumber: 5,
		format: "sequential" as const,
	};
	// sequential 3.2.0: versionCode = 302000 + buildNumber
	const builds = new Map<BuildPlatform, EASBuild[]>([
		["ios", [build({ appBuildVersion: "5" })]],
		["android", [build({ platform: "android", appBuildVersion: "302006" })]],
	]);

	test("findBuildCollision reports the first colliding platform", () => {
		expect(findBuildCollision(state, builds)).toMatchObject({
			platform: "ios",
			buildVersion: "5",
		});
		expect(
			findBuildCollision({ ...state, buildNumber: 7 }, builds),
		).toBeUndefined();
	});

	test("findUniqueBuildNumber skips every taken number", () => {
		const { buildNumber, skipped } = findUniqueBuildNumber(state, builds);
		expect(buildNumber).toBe(7);
		expect(skipped.map((c) => [c.platform, c.buildNumber])).toEqual([
			["ios", 5],
			["android", 6],
		]);
	});

	test("findUniqueBuildNumber gives up after maxAttempts", () => {
		expect(() => findUniqueBuildNumber(state, builds, 1)).toThrow(
			/after 1 attempts/,
		);
	});
});
