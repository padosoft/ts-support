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
 *
 * @typeParam T - The source object type being proxied.
 * @typeParam TPath - Accumulated property-access path (starts at `readonly []`).
 * @typeParam TBaseKey - The `baseKey` passed to `createQueryProxy`, prepended to
 *   every generated key and to the `all` namespace key.
 */
export type QueryProxy<
	T,
	TBaseKey extends readonly unknown[] = readonly [],
	TPath extends readonly string[] = readonly [],
> = T extends (...args: infer A) => Promise<infer R>
	? QueryLeaf<A, R>
	: T extends (...args: infer A) => infer R
		? (...args: A) => R
		: T extends object
			? {
					readonly [K in keyof T as K extends "$query" | "$key" | "all"
						? never
						: K]: QueryProxy<T[K], TBaseKey, [...TPath, K & string]>;
				} & { readonly all: readonly [...TBaseKey, ...TPath] }
			: T;

// ---- Factory ----

/**
 * Wraps any typed object in a proxy that augments every async method with
 * `.$key(...args)` and `.$query(...args)` helpers, and adds an `all` property
 * to every namespace for bulk cache invalidation.
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
 * // Namespace key for bulk invalidation:
 * queryClient.invalidateQueries({ queryKey: q.v1.auth.all })
 * // → ['v1', 'auth']
 *
 * // Spread into useQuery — params specified exactly once:
 * useQuery({
 *   ...q.v1.auth.getSession.$query(params),
 *   enabled: !!user,
 * });
 *
 * // With a baseKey prefix:
 * const q2 = createQueryProxy(client, { baseKey: ['api'] as const });
 * q2.v1.auth.all // → ['api', 'v1', 'auth']
 * ```
 *
 * @param target - Any typed object with async methods.
 * @param options.baseKey - Optional prefix prepended to every generated key.
 */
export function createQueryProxy<
	T extends object,
	TBaseKey extends readonly string[] = readonly [],
>(target: T, options?: { baseKey?: TBaseKey }): QueryProxy<T, TBaseKey> {
	return buildProxy(target, options?.baseKey, []);
}

// The Proxy implementation cannot be verified structurally by TypeScript —
// the single cast lives at the createQueryProxy return below.
function buildProxy<
	T extends object,
	TBaseKey extends readonly string[] = readonly [],
	TPath extends readonly string[] = readonly [],
>(target: T, baseKey?: TBaseKey, path?: TPath): QueryProxy<T, TBaseKey, TPath> {
	return new Proxy(target, {
		get(obj, prop) {
			// Pass symbols through untouched (used internally by JS runtime).
			if (typeof prop === "symbol") {
				return (obj as Record<symbol, unknown>)[prop];
			}

			const basePath = [...(baseKey ?? []), ...(path ?? [])];

			// Prevent $query / $key from being re-proxied (would cause infinite
			// chaining: .$query.$query.$query…).
			if (prop === "$query" || prop === "$key") {
				console.warn("[QueryProxy] .$query or .$key chaining is not supported");
				console.warn(
					`[QueryProxy] Accessed ${String(prop)} on ${basePath.join(".")}, which is already a query leaf.`,
				);
				return undefined;
			}

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
				return buildProxy(value, [], propPath);
			}

			return value;
		},
	}) as QueryProxy<T, TBaseKey, TPath>;
}
