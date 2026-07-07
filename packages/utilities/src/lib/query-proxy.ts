import type { QueryDescriptor } from "./query";

// ---- Types ----

/**
 * An async method augmented with `$key` and `$query` helpers.
 * The function itself remains directly callable.
 */
type QueryLeaf<
  TArgs extends unknown[],
  TResult,
  TKey extends readonly unknown[] = readonly unknown[]
> = {
  (...args: TArgs): Promise<TResult>;
  /** Returns the query key array for the given arguments. */
  $key<const TCallArgs extends TArgs>(...args: TCallArgs): readonly [...TKey, ...TCallArgs];
  /** Returns `{ queryKey, queryFn }` — spread directly into `useQuery()`. */
  $query<const TCallArgs extends TArgs>(
    ...args: TCallArgs
  ): QueryDescriptor<TResult, readonly [...TKey, ...TCallArgs]>;
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
 * @typeParam TBaseKey - The `baseKey` passed to `createQueryProxy`, prepended to
 *   every generated key and to the `all` namespace key.
 * @typeParam TPath - Accumulated property-access path (starts at `readonly []`).
 */
export type QueryProxy<
  T,
  TBaseKey extends readonly unknown[] = readonly [],
  TPath extends readonly string[] = readonly []
> = T extends (...args: infer A) => Promise<infer R>
  ? QueryLeaf<A, R, readonly [...TBaseKey, ...TPath]>
  : T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends object
  ? {
      readonly [K in
        | "all"
        | Exclude<keyof T, "$query" | "$key" | "all">]: K extends "all"
        ? readonly [...TBaseKey, ...TPath]
        : K extends keyof T
        ? QueryProxy<T[K], TBaseKey, [...TPath, K & string]>
        : never;
    }
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
  TBaseKey extends readonly string[] = readonly []
>(target: T, options?: { baseKey?: TBaseKey }): QueryProxy<T, TBaseKey> {
  const baseKey = options?.baseKey;

  // The Proxy implementation cannot be verified structurally by TypeScript —
  // the single boundary cast lives at the bottom of this function.
  function build<U extends object>(
    obj: U,
    path: readonly string[]
  ): QueryProxy<U, TBaseKey> {
    return new Proxy(obj, {
      get(inner, prop) {
        if (typeof prop === "symbol")
          return (inner as Record<symbol, unknown>)[prop];

        const fullPath = [...(baseKey ?? []), ...path];

        // Prevent $query / $key from being re-proxied (would cause infinite
        // chaining: .$query.$query.$query…).
        if (prop === "$query" || prop === "$key") return undefined;

        if (prop === "all") return Object.freeze(fullPath);

        const value = (inner as Record<string, unknown>)[prop];
        const propKey = [...fullPath, prop];

        if (typeof value === "function") {
          const fn = (value as (...args: unknown[]) => unknown).bind(inner);
          return Object.assign((...args: unknown[]) => fn(...args), {
            $key: (...args: unknown[]): readonly unknown[] => [
              ...propKey,
              ...args,
            ],
            $query: (...args: unknown[]): QueryDescriptor<unknown> => ({
              queryKey: [...propKey, ...args],
              queryFn: () => fn(...args),
            }),
          });
        }

        if (value !== null && typeof value === "object") {
          return build(value as object, [...path, prop]);
        }

        return value;
      },
    }) as QueryProxy<U, TBaseKey>;
  }

  return build(target, []);
}
