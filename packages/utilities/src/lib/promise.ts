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

export const withTimeout = async <T>(
	promise: Promise<T>,
	ms: number,
	message?: string,
): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(
			() => reject(new Error(message ?? `Promise timed out after ${ms}ms`)),
			ms,
		);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeout);
	}
};
