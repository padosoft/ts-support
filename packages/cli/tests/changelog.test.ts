import { expect, test } from "bun:test";
import { extractChangelogSection } from "../src/utils/changelog";

const CHANGELOG = `# luisaviaroma

## 3.2.0

### Minor Changes

- abc1234: feat: something new

### Patch Changes

- def5678: fix: something broken

## 3.1.7

### Patch Changes

- 7a869a5: fix(account): older fix
`;

test("extracts only the requested version section", () => {
	expect(extractChangelogSection(CHANGELOG, "3.2.0")).toBe(
		[
			"### Minor Changes",
			"",
			"- abc1234: feat: something new",
			"",
			"### Patch Changes",
			"",
			"- def5678: fix: something broken",
		].join("\n"),
	);
});

test("extracts the last section up to the end of the file", () => {
	expect(extractChangelogSection(CHANGELOG, "3.1.7")).toBe(
		"### Patch Changes\n\n- 7a869a5: fix(account): older fix",
	);
});

test("matches the version exactly, not as a prefix", () => {
	expect(extractChangelogSection(CHANGELOG, "3.2")).toBeNull();
	expect(extractChangelogSection(CHANGELOG, "3.1.70")).toBeNull();
});

test("handles CRLF changelogs", () => {
	expect(
		extractChangelogSection(CHANGELOG.replace(/\n/g, "\r\n"), "3.1.7"),
	).toBe("### Patch Changes\n\n- 7a869a5: fix(account): older fix");
});

test("returns null for a missing or empty section", () => {
	expect(extractChangelogSection(CHANGELOG, "9.9.9")).toBeNull();
	expect(
		extractChangelogSection("## 1.0.0\n\n## 0.9.0\n- x", "1.0.0"),
	).toBeNull();
});
