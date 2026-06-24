import { join, resolve } from "node:path";
import { assertNotExists, kebabCase, writeFileWithDirs } from "../utils/fs";

interface ChangesetOptions {
	pkg?: string;
	type?: string;
	message?: string;
}

const VALID_TYPES = ["major", "minor", "patch"] as const;
type BumpType = (typeof VALID_TYPES)[number];

export const createChangeset = async (opts: ChangesetOptions): Promise<void> => {
	const pkg = opts.pkg;
	const bumpType = (opts.type ?? "minor") as BumpType;
	const message = opts.message;

	if (!pkg) {
		console.error("  error   --pkg is required (e.g. @padosoft/utilities)");
		process.exit(1);
	}
	if (!message) {
		console.error("  error   --message is required");
		process.exit(1);
	}
	if (!VALID_TYPES.includes(bumpType)) {
		console.error(`  error   --type must be one of: ${VALID_TYPES.join(", ")}`);
		process.exit(1);
	}

	// Derive a unique, readable slug from the message
	const slug = kebabCase(message.slice(0, 60).replace(/[^a-zA-Z0-9\s-]/g, ""));
	const cwd = process.cwd();
	const filePath = resolve(join(cwd, ".changeset", `${slug}.md`));

	assertNotExists(filePath);

	const content = `---\n"${pkg}": ${bumpType}\n---\n\n${message}\n`;

	console.log(`\nCreating changeset for ${pkg} (${bumpType})\n`);
	await writeFileWithDirs(filePath, content);
	console.log("\nDone.");
};
