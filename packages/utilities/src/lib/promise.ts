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

export const withTimeout = <T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> =>
	new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);

		promise.then(
			(value) => {
				clearTimeout(timeout);
				resolve(value);
			},
			(error) => {
				clearTimeout(timeout);
				reject(error);
			},
		);
	});
