/**
 * Returns the body of the `## <version>` section of a Changesets CHANGELOG,
 * without the heading, or `null` when the version has no (or an empty) section.
 */
export const extractChangelogSection = (
	changelog: string,
	version: string,
): string | null => {
	const lines = changelog.replace(/\r\n/g, "\n").split("\n");
	const start = lines.findIndex((line) => line.trim() === `## ${version}`);
	if (start === -1) return null;

	const rest = lines.slice(start + 1);
	const end = rest.findIndex((line) => line.startsWith("## "));
	const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
	return body.length ? body : null;
};
