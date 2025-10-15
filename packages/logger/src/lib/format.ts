import type { TimestampType } from "@/types/format";

export const makeTimestamp = (
	type: TimestampType,
): ((date: Date) => string) => {
	if (typeof type === "function") {
		return type;
	}

	const fn =
		type === "local"
			? (date: Date) => date.toLocaleString()
			: (date: Date) => date.toISOString();

	return (date: Date) => fn(date);
};
