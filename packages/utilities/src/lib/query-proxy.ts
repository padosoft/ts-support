import type { QueryDescriptor } from "./query";

// ---- Types ----

/**
 * An async method augmented with `$key` and `$query` helpers.
 * The function itself remains directly callable.
 */
type QueryLeaf<TArgs extends unknown[], TResult> = {
	(...args: TArgs): Promise<TResult>;
	/** Returns the query key array for the given arguments. */
	$key(...args: TArgs): readonly unknown[];
	/** Returns `{ queryKey, queryFn }` — spread directly into `useQuery()`. */
	$query(...args: TArgs): QueryDescriptor<TResult>;
};

/**
 * Recursively transforms a typed object:
 * - Promise-returning methods → `QueryLeaf` (augmented with `$key` + `$query`)
 * - Synchronous functions → passed through unchanged
 * - Nested objects → recursively transformed, with an added `all` key that
 *   returns the query-key prefix for the current namespace (useful for bulk
 *   invalidation: `queryClient.invalidateQueries({ queryKey: q.v1.loyalty.all })`)
 * - Primitives → passed through unchanged
 *
 * The proxy meta-properties `$query` and `$key` are excluded from nested
 * objects to prevent infinite `.$query.$query.$query` chaining.
 */

export type QueryProxy<
	T,
	TPath extends readonly string[] = readonly [],
> = T extends (...args: infer A) => Promise<infer R>
	? QueryLeaf<A, R>
	: T extends (...args: infer A) => infer R
		? (...args: A) => R
		: T extends object
			? {
					readonly [K in keyof T as K extends "$query" | "$key" | "all"
						? never
						: K]: QueryProxy<T[K], [...TPath, K & string]>;
				} & { readonly all: TPath }
			: T;

// ---- Factory ----

/**
 * Wraps any typed object in a proxy that augments every async method with
 * `.$key(...args)` and `.$query(...args)` helpers.
 *
 * The query key is derived automatically from the property-access path through
 * the object plus the call arguments — no separate key definitions needed.
 *
 * Works with any typed object: REST clients, tRPC, service classes, etc.
 *
 * @example
 * ```ts
 * const q = createQueryProxy(apiClient);
 *
 * // Key — path through the object + args, no manual definition:
 * q.v1.auth.getSession.$key(params)
 * // → ['v1', 'auth', 'getSession', params]
 *
 * // Spread into useQuery — params specified exactly once:
 * useQuery({
 *   ...q.v1.auth.getSession.$query(params),
 *   enabled: !!user,
 * });
 *
 * // Direct call still works identically:
 * await q.v1.auth.getSession(params);
 *
 * // For hook-based clients, wrap in useMemo:
 * function useQ() {
 *   const client = useApiClient();
 *   return useMemo(() => createQueryProxy(client), [client]);
 * }
 * ```
 *
 * @param target - Any typed object with async methods.
 * @param options.baseKey - Optional prefix prepended to every generated key.
 */
export function createQueryProxy<T extends object>(
	target: T,
	options?: { baseKey?: readonly unknown[] },
): QueryProxy<T, readonly []> {
	return buildProxy(target, [] as const, options?.baseKey ?? []);
}

// ---- Internal ----

function buildProxy<T extends object, TPath extends readonly string[]>(
	target: T,
	path: TPath,
	baseKey: readonly unknown[],
): QueryProxy<T, TPath> {
	return new Proxy(target, {
		get(obj, prop) {
			// Pass symbols through untouched (used internally by JS runtime).
			if (typeof prop === "symbol") {
				return (obj as Record<symbol, unknown>)[prop];
			}

			// Prevent $query / $key from being re-proxied (would cause infinite
			// chaining: .$query.$query.$query…). These are meta-entry-points on
			// the source object and must not be visible through the proxy itself.
			if (prop === "$query" || prop === "$key") return undefined;

			// Namespace prefix key — use for bulk invalidation:
			//   queryClient.invalidateQueries({ queryKey: q.v1.loyalty.all })
			if (prop === "all") return Object.freeze([...baseKey, ...path]);

			const value = (obj as Record<string, unknown>)[prop];
			const propPath = [...path, prop];

			if (typeof value === "function") {
				// Bind to the current target so `this` is correct inside the method.
				const fn = (value as (...args: unknown[]) => unknown).bind(obj);
				return Object.assign((...args: unknown[]) => fn(...args), {
					$key: (...args: unknown[]): readonly unknown[] => [
						...baseKey,
						...propPath,
						...args,
					],
					$query: (...args: unknown[]): QueryDescriptor<unknown> => ({
						queryKey: [...baseKey, ...propPath, ...args],
						queryFn: () => fn(...args) as Promise<unknown>,
					}),
				});
			}

			if (value !== null && typeof value === "object") {
				return buildProxy(value, propPath, baseKey);
			}

			return value;
		},
	}) as QueryProxy<T, TPath>;
}
