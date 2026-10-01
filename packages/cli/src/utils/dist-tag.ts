import { type Choice, input, isInteractive, select } from "./prompt";

export const DEFAULT_DIST_TAG = "latest";

export const DIST_TAG_CHOICES: Choice[] = [
	{ value: "latest", hint: "stable release (default)" },
	{ value: "next", hint: "upcoming release / release candidate" },
	{ value: "canary", hint: "nightly builds" },
	{ value: "custom", label: "custom…", hint: "any other dist-tag, e.g. beta" },
];

/**
 * `tag` when given; otherwise asks on an interactive terminal (latest / next /
 * canary / custom), and falls back to `latest` in CI or when piped.
 */
export async function resolveDistTag(
	tag: string | undefined,
	message = "Which npm dist-tag?",
	choices: Choice[] = DIST_TAG_CHOICES,
): Promise<string> {
	if (tag) return tag;
	if (!isInteractive()) return DEFAULT_DIST_TAG;

	const picked = await select(message, choices);
	return picked === "custom" ? input("Custom dist-tag:") : picked;
}
