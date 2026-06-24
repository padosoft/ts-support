export const inspectSettledPromiseResults = <T>(
	results: PromiseSettledResult<T>[],
): { fulfilled: T[]; rejected: unknown[] } => {
	const fulfilled = results
		.filter((r): r is PromiseFulfilledResult<T> => r.status === "fulfilled")
		.map((r) => r.value);

	const rejected = results
		.filter((r): r is PromiseRejectedResult => r.status === "rejected")
		.map((r) => r.reason);

	return { fulfilled, rejected };
};
