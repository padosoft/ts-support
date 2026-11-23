import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	bumpVersion,
	compareVersions,
	formatReleaseTag,
	nextPreviewNumber,
	parseReleaseTag,
} from "../src/utils/release-version";

// ── tags and versions ────────────────────────────────────────────────────────

describe("parseReleaseTag", () => {
	test("plain and app tags, production and preview", () => {
		expect(parseReleaseTag("v1.2.3")).toEqual({
			version: "1.2.3",
			profile: "production",
		});
		expect(parseReleaseTag("v1.2.3-preview.4")).toEqual({
			version: "1.2.3",
			preview: 4,
			profile: "preview",
		});
		expect(parseReleaseTag("my-app@v0.10.0")).toEqual({
			app: "my-app",
			version: "0.10.0",
			profile: "production",
		});
		expect(parseReleaseTag("refs/tags/my-app@v2.0.0-preview.1")).toEqual({
			app: "my-app",
			version: "2.0.0",
			preview: 1,
			profile: "preview",
		});
	});

	test("rejects anything else", () => {
		for (const tag of [
			"1.2.3",
			"v1.2",
			"v1.2.3-beta.1",
			"v1.2.3-preview",
			"v01.2.3",
			"@scope/app@1.2.3",
			"app@1.2.3",
			"v1.2.3-preview.1-x",
		]) {
			expect(() => parseReleaseTag(tag)).toThrow("Not a release tag");
		}
	});

	test("formatReleaseTag round-trips", () => {
		for (const tag of [
			"v1.2.3",
			"v1.2.3-preview.2",
			"a@v1.0.0",
			"a@v1.0.0-preview.9",
		]) {
			expect(formatReleaseTag(parseReleaseTag(tag))).toBe(tag);
		}
	});
});

describe("versions", () => {
	test("bumpVersion", () => {
		expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
		expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
		expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
		expect(() => bumpVersion("1.2", "patch")).toThrow();
	});

	test("compareVersions is numeric", () => {
		expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
		expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
	});

	test("nextPreviewNumber counts only the same version and tag prefixes", () => {
		const tags = [
			"v1.3.0-preview.1",
			"v1.3.0-preview.4",
			"v1.2.0-preview.9",
			"a@v1.3.0-preview.6",
			"b@v1.3.0-preview.2",
			"v1.3.0",
			"not-a-tag",
		];
		expect(nextPreviewNumber(tags, "1.3.0", [undefined])).toBe(5);
		expect(nextPreviewNumber(tags, "1.3.0", ["b"])).toBe(3);
		expect(nextPreviewNumber(tags, "1.3.0", ["a", "b"])).toBe(7);
		expect(nextPreviewNumber(tags, "2.0.0", [undefined])).toBe(1);
	});
});

// ── commands, against real git repositories ──────────────────────────────────

const CLI = join(import.meta.dir, "..", "src", "index.ts");
const roots: string[] = [];

afterAll(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const sh = (cwd: string, command: string, args: string[]): string => {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.status !== 0)
		throw new Error(`${command} ${args.join(" ")}: ${result.stderr}`);
	return result.stdout.trim();
};

const git = (cwd: string, ...args: string[]): string => sh(cwd, "git", args);

const cli = (cwd: string, ...args: string[]) => {
	const result = spawnSync(process.execPath, [CLI, ...args], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
	});
	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
	};
};

const writeJson = (path: string, data: unknown): void => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`);
};

const readVersion = (path: string): unknown =>
	JSON.parse(readFileSync(path, "utf8")).version;

/**
 * A bare `origin` and a clone of it with `files` committed on `main` and
 * pushed. Returns the clone.
 */
function makeRepo(files: Record<string, unknown>): {
	root: string;
	repo: string;
	origin: string;
} {
	const root = mkdtempSync(join(tmpdir(), "padosoft-release-"));
	roots.push(root);
	const origin = join(root, "origin.git");
	const repo = join(root, "repo");
	git(root, "init", "--quiet", "--bare", "--initial-branch=main", origin);
	git(root, "clone", "--quiet", origin, repo);
	git(repo, "config", "user.email", "test@example.com");
	git(repo, "config", "user.name", "Test");
	git(repo, "config", "core.autocrlf", "false");
	git(repo, "checkout", "--quiet", "-B", "main");
	for (const [path, data] of Object.entries(files))
		writeJson(join(repo, path), data);
	git(repo, "add", ".");
	git(repo, "commit", "--quiet", "-m", "init");
	git(repo, "push", "--quiet", "origin", "main");
	return { root, repo, origin };
}

const SINGLE = { "package.json": { name: "solo", version: "1.2.0" } };
const MONO = {
	"package.json": { name: "root", private: true },
	"apps/a/package.json": { name: "@acme/a", version: "2.0.0" },
	"apps/b/package.json": { name: "@acme/b", version: "2.0.0" },
};

describe("release check-tag", () => {
	test("production tag on main matching package.json", () => {
		const { repo } = makeRepo(SINGLE);
		git(repo, "tag", "v1.2.0");
		const out = cli(repo, "release", "check-tag", "v1.2.0");
		expect(out.status).toBe(0);
		expect(out.stdout).toBe("profile=production\nversion=1.2.0\napps=\n");
	});

	test("production tag with another version fails", () => {
		const { repo } = makeRepo(SINGLE);
		git(repo, "tag", "v1.3.0");
		const out = cli(repo, "release", "check-tag", "v1.3.0");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("does not match the version in package.json");
		expect(out.stdout).toBe("");
	});

	test("production tag off main fails; preview tag passes on any branch", () => {
		const { repo } = makeRepo(SINGLE);
		git(repo, "checkout", "--quiet", "-b", "feature");
		writeFileSync(join(repo, "x.txt"), "x");
		git(repo, "add", ".");
		git(repo, "commit", "--quiet", "-m", "feature");
		git(repo, "push", "--quiet", "origin", "feature");
		git(repo, "tag", "v1.2.0");
		git(repo, "tag", "v1.2.1-preview.1");

		const prod = cli(repo, "release", "check-tag", "v1.2.0");
		expect(prod.status).toBe(1);
		expect(prod.stderr).toContain("is not on origin/main");

		const preview = cli(repo, "release", "check-tag", "v1.2.1-preview.1");
		expect(preview.status).toBe(0);
		expect(preview.stdout).toContain("profile=preview\nversion=1.2.1\n");

		const onDevelop = cli(
			repo,
			"release",
			"check-tag",
			"v1.2.1-preview.1",
			"--preview-branch",
			"feature",
		);
		expect(onDevelop.status).toBe(0);
		const onMain = cli(
			repo,
			"release",
			"check-tag",
			"v1.2.1-preview.1",
			"--preview-branch",
			"main",
		);
		expect(onMain.status).toBe(1);
	});

	test("a preview tag only on an unpushed commit fails", () => {
		const { repo } = makeRepo(SINGLE);
		writeFileSync(join(repo, "x.txt"), "x");
		git(repo, "add", ".");
		git(repo, "commit", "--quiet", "-m", "local only");
		git(repo, "tag", "v1.2.1-preview.1");
		const out = cli(repo, "release", "check-tag", "v1.2.1-preview.1");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("not on any branch of origin");
	});

	test("fetches the production branch and the tag when the clone lacks them", () => {
		const { root, repo } = makeRepo(SINGLE);
		git(repo, "tag", "v1.2.0");
		git(repo, "push", "--quiet", "origin", "v1.2.0");
		git(repo, "checkout", "--quiet", "-b", "other");
		git(repo, "push", "--quiet", "origin", "other");
		const narrow = join(root, "narrow");
		git(
			root,
			"clone",
			"--quiet",
			"--single-branch",
			"--no-tags",
			"--branch",
			"other",
			join(root, "origin.git"),
			narrow,
		);
		const out = cli(narrow, "release", "check-tag", "v1.2.0");
		expect(out.stderr).toBe("");
		expect(out.status).toBe(0);
	});

	test("monorepo: plain tag covers every app, app tag one app", () => {
		const { repo } = makeRepo(MONO);
		git(repo, "tag", "v2.0.0");
		git(repo, "tag", "b@v2.0.0");
		expect(cli(repo, "release", "check-tag", "v2.0.0").stdout).toContain(
			"apps=a,b\n",
		);
		expect(cli(repo, "release", "check-tag", "b@v2.0.0").stdout).toContain(
			"apps=b\n",
		);
		expect(
			cli(repo, "release", "check-tag", "v2.0.0", "--app", "a").stdout,
		).toContain("apps=a\n");
		const wrongApp = cli(repo, "release", "check-tag", "c@v2.0.0");
		expect(wrongApp.status).toBe(1);
		expect(wrongApp.stderr).toContain('No app "c"');
	});

	test("monorepo: a plain production tag needs every app at its version", () => {
		const { repo } = makeRepo({
			...MONO,
			"apps/b/package.json": { name: "@acme/b", version: "1.0.0" },
		});
		git(repo, "tag", "v2.0.0");
		const out = cli(repo, "release", "check-tag", "v2.0.0");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("b is 1.0.0");
	});

	test("rejects a malformed tag", () => {
		const { repo } = makeRepo(SINGLE);
		const out = cli(repo, "release", "check-tag", "release-1");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("Not a release tag");
	});
});

describe("release tag", () => {
	test("bumps, commits, tags and pushes", () => {
		const { repo, origin } = makeRepo(SINGLE);
		const out = cli(repo, "release", "tag", "minor");
		expect(out.stderr).toBe("");
		expect(out.status).toBe(0);
		expect(readVersion(join(repo, "package.json"))).toBe("1.3.0");
		expect(git(repo, "log", "-1", "--format=%s")).toBe(
			"chore(release): v1.3.0",
		);
		expect(git(origin, "rev-parse", "main")).toBe(
			git(repo, "rev-parse", "HEAD"),
		);
		expect(git(origin, "rev-parse", "v1.3.0^{commit}")).toBe(
			git(repo, "rev-parse", "HEAD"),
		);
	});

	test("without a bump or changesets it asks for one", () => {
		const { repo } = makeRepo(SINGLE);
		const out = cli(repo, "release", "tag");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("Pass patch, minor, major");
	});

	test("with changesets and no bump it tags the current version", () => {
		const { repo, origin } = makeRepo({
			...SINGLE,
			".changeset/config.json": {},
		});
		const out = cli(repo, "release", "tag");
		expect(out.status).toBe(0);
		expect(readVersion(join(repo, "package.json"))).toBe("1.2.0");
		expect(git(origin, "tag", "--list")).toBe("v1.2.0");
	});

	test("refuses a tag that already exists", () => {
		const { repo } = makeRepo(SINGLE);
		git(repo, "tag", "v1.2.1");
		const out = cli(repo, "release", "tag", "patch");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("Tag already exists: v1.2.1");
	});

	test("--preview tags patch+1 with the next N and leaves package.json alone", () => {
		const { repo, origin } = makeRepo(SINGLE);
		expect(cli(repo, "release", "tag", "--preview").status).toBe(0);
		expect(cli(repo, "release", "tag", "--preview").status).toBe(0);
		expect(readVersion(join(repo, "package.json"))).toBe("1.2.0");
		expect(git(origin, "tag", "--list").split("\n")).toEqual([
			"v1.2.1-preview.1",
			"v1.2.1-preview.2",
		]);
		expect(git(repo, "log", "--format=%s")).toBe("init");
	});

	test("--apps tags each app and bumps only those", () => {
		const { repo, origin } = makeRepo(MONO);
		const out = cli(repo, "release", "tag", "patch", "--apps", "a");
		expect(out.status).toBe(0);
		expect(readVersion(join(repo, "apps/a/package.json"))).toBe("2.0.1");
		expect(readVersion(join(repo, "apps/b/package.json"))).toBe("2.0.0");
		expect(git(origin, "tag", "--list")).toBe("a@v2.0.1");
	});

	test("monorepo without --apps bumps every app to one version and tags vX.Y.Z", () => {
		const { repo, origin } = makeRepo({
			...MONO,
			"apps/b/package.json": { name: "@acme/b", version: "2.1.0" },
		});
		expect(cli(repo, "release", "tag", "patch").status).toBe(0);
		expect(readVersion(join(repo, "apps/a/package.json"))).toBe("2.1.1");
		expect(readVersion(join(repo, "apps/b/package.json"))).toBe("2.1.1");
		expect(git(origin, "tag", "--list")).toBe("v2.1.1");
	});

	test("--dry-run changes nothing", () => {
		const { repo, origin } = makeRepo(SINGLE);
		const out = cli(repo, "release", "tag", "major", "--dry-run");
		expect(out.status).toBe(0);
		expect(out.stdout).toContain("solo 1.2.0 → 2.0.0");
		expect(out.stdout).toContain("tag and push v2.0.0");
		expect(readVersion(join(repo, "package.json"))).toBe("1.2.0");
		expect(git(origin, "tag", "--list")).toBe("");
	});

	test("refuses a dirty working tree", () => {
		const { repo } = makeRepo(SINGLE);
		writeJson(join(repo, "package.json"), {
			name: "solo",
			version: "1.2.0",
			x: 1,
		});
		const out = cli(repo, "release", "tag", "patch");
		expect(out.status).toBe(1);
		expect(out.stderr).toContain("uncommitted changes");
	});
});

describe("release apps --dry-run", () => {
	test("one shared version: a single v<version> tag", () => {
		const { repo } = makeRepo(MONO);
		const out = cli(repo, "release", "apps", "--dry-run");
		expect(out.status).toBe(0);
		expect(out.stdout).toContain("would tag HEAD as v2.0.0");
		expect(out.stdout).not.toContain("@acme/a@2.0.0");
	});

	test("--tag-format name keeps <name>@<version>", () => {
		const { repo } = makeRepo(MONO);
		const out = cli(
			repo,
			"release",
			"apps",
			"--dry-run",
			"--tag-format",
			"name",
		);
		expect(out.stdout).toContain("would tag HEAD as @acme/a@2.0.0");
		expect(out.stdout).toContain("would tag HEAD as @acme/b@2.0.0");
	});

	test("different versions: one tag per app; --tag-format version refuses", () => {
		const { repo } = makeRepo({
			...MONO,
			"apps/b/package.json": { name: "@acme/b", version: "1.0.0" },
		});
		const out = cli(repo, "release", "apps", "--dry-run");
		expect(out.stdout).toContain("would tag HEAD as @acme/a@2.0.0");
		expect(out.stdout).toContain("would tag HEAD as @acme/b@1.0.0");
		const strict = cli(
			repo,
			"release",
			"apps",
			"--dry-run",
			"--tag-format",
			"version",
		);
		expect(strict.status).toBe(1);
	});

	test("single-app repo: the root package", () => {
		const { repo } = makeRepo(SINGLE);
		const out = cli(repo, "release", "apps", "--dry-run");
		expect(out.stdout).toContain("would tag HEAD as v1.2.0");
	});
});

describe("from inside an app folder of a monorepo", () => {
	// b is behind on purpose: a plain tag run in apps/a must check only a.
	const AHEAD = {
		...MONO,
		"apps/b/package.json": { name: "@acme/b", version: "1.0.0" },
	};

	test("check-tag from the root still checks every app", () => {
		const { repo } = makeRepo(MONO);
		git(repo, "tag", "v2.0.0");
		const out = cli(repo, "release", "check-tag", "v2.0.0");
		expect(out.stdout).toBe("profile=production\nversion=2.0.0\napps=a,b\n");
	});

	test("check-tag in apps/a: plain tag and a@ tag check a; b@ tag fails", () => {
		const { repo } = makeRepo(AHEAD);
		git(repo, "tag", "v2.0.0");
		git(repo, "tag", "a@v2.0.0");
		git(repo, "tag", "b@v1.0.0");
		const appDir = join(repo, "apps", "a");

		const plain = cli(appDir, "release", "check-tag", "v2.0.0");
		expect(plain.stderr).toBe("");
		expect(plain.stdout).toBe("profile=production\nversion=2.0.0\napps=a\n");

		const own = cli(appDir, "release", "check-tag", "a@v2.0.0");
		expect(own.stdout).toBe("profile=production\nversion=2.0.0\napps=a\n");

		const other = cli(appDir, "release", "check-tag", "b@v1.0.0");
		expect(other.status).toBe(1);
		expect(other.stdout).toBe("");
		expect(other.stderr).toContain(
			'is for app "b", but this runs in the folder of app "a"',
		);
	});

	test("check-tag in a subfolder of apps/a with a custom --apps-dir", () => {
		const { repo } = makeRepo({
			"package.json": { name: "root", private: true },
			"mobile/a/package.json": { name: "@acme/a", version: "2.0.0" },
			"mobile/a/src/.keep": {},
		});
		git(repo, "tag", "v2.0.0");
		const out = cli(
			join(repo, "mobile", "a", "src"),
			"release",
			"check-tag",
			"v2.0.0",
			"--apps-dir",
			"mobile",
		);
		expect(out.stdout).toBe("profile=production\nversion=2.0.0\napps=a\n");
	});

	test("release tag in apps/a bumps and tags only a", () => {
		const { repo, origin } = makeRepo(AHEAD);
		const out = cli(join(repo, "apps", "a"), "release", "tag", "patch");
		expect(out.stderr).toBe("");
		expect(out.status).toBe(0);
		expect(readVersion(join(repo, "apps/a/package.json"))).toBe("2.0.1");
		expect(readVersion(join(repo, "apps/b/package.json"))).toBe("1.0.0");
		expect(git(origin, "tag", "--list")).toBe("a@v2.0.1");
		expect(git(repo, "status", "--porcelain")).toBe("");
	});

	test("release tag --preview in apps/a tags a@…-preview.N", () => {
		const { repo, origin } = makeRepo(AHEAD);
		expect(
			cli(join(repo, "apps", "a"), "release", "tag", "--preview").status,
		).toBe(0);
		expect(git(origin, "tag", "--list")).toBe("a@v2.0.1-preview.1");
	});
});
