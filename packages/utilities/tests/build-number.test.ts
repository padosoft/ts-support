import { describe, expect, test } from "bun:test";
import {
	computeBuildVersions,
	computeVersionCode,
	incrementBuildNumber,
	isBuildCodeFormat,
	resetBuildNumber,
} from "../src/lib/build-number";

const NOW = new Date("2026-10-01T10:00:00Z");

describe("computeVersionCode", () => {
	test("sequential encodes semver + one-digit build slot", () => {
		expect(computeVersionCode("3.2.0", 0, "sequential", NOW)).toBe(302000);
		expect(computeVersionCode("3.1.5", 2, "sequential", NOW)).toBe(301052);
	});

	test("sequential rejects a buildNumber over 9", () => {
		expect(() => computeVersionCode("3.1.5", 10, "sequential", NOW)).toThrow(
			/single digit/,
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

test("resetBuildNumber zeroes sequential, keeps yearly/date increasing", () => {
	expect(resetBuildNumber(7, "sequential", NOW)).toBe(0);
	expect(resetBuildNumber(32, "yearly", NOW)).toBe(33);
	expect(resetBuildNumber(20250101, "date", NOW)).toBe(20261001);
});

test("computeBuildVersions maps iOS to buildNumber and Android to versionCode", () => {
	expect(computeBuildVersions("3.2.0", 32, "yearly", NOW)).toEqual({
		ios: "32",
		android: "2026032",
	});
});

test("isBuildCodeFormat", () => {
	expect(isBuildCodeFormat("yearly")).toBe(true);
	expect(isBuildCodeFormat("weekly")).toBe(false);
	expect(isBuildCodeFormat(1)).toBe(false);
});
