/**
 * A plain object compatible with React Query (and similar libs) without importing them.
 * Spread directly into `useQuery()`, `useSuspenseQuery()`, etc.
 */
export type QueryDescriptor<
	TResult,
	TKey extends readonly unknown[] = readonly unknown[],
> = {
	queryKey: TKey;
	queryFn: () => TResult | Promise<TResult>;
};

/**
 * A typed query definition — holds the key factory and the fn factory together
 * so parameters only need to be specified once at the call site.
 */
export type QueryDefinition<
	TParams,
	TResult,
	TKey extends readonly unknown[] = readonly unknown[],
> = {
	/** Returns the query key array for the given params. Use for cache invalidation / prefetching. */
	key(params: TParams): TKey;
	/** Returns `{ queryKey, queryFn }` — spread directly into `useQuery()`. */
	query(params: TParams): QueryDescriptor<TResult, TKey>;
};

/**
 * Defines a typed query that pairs a key factory with a fn factory sharing the same params.
 *
 * The returned object is framework-agnostic — `query(params)` produces a plain
 * `{ queryKey, queryFn }` object that can be spread into any React Query compatible hook.
 *
 * Annotate the parameter on either callback to drive inference for both:
 * ```ts
 * const q = defineQuery({
 *   queryFn: (p: GetCmsSectionParams) => api.v1.cms.getCmsSection(p.section, p),
 *   queryKey: (p) => ['cms', 'section', p.section] as const,
 * });
 * ```
 *
 * @example
 * ```ts
 * // In component — params specified once:
 * useQuery({
 *   ...q.query({ section, nazioni_ID, listini_ID, lang, device }),
 *   enabled: !!section,
 * });
 *
 * // For cache invalidation:
 * queryClient.invalidateQueries({ queryKey: q.key({ section, ... }) });
 * ```
 */
// Zero-params overload — for queries that take no arguments.
export function defineQuery<TResult, TKey extends readonly unknown[]>(config: {
	queryFn: () => TResult | Promise<TResult>;
	queryKey: () => TKey;
}): QueryDefinition<void, Awaited<TResult>, TKey>;

// With-params overload — annotate `p` on either callback to anchor inference.
export function defineQuery<TParams, TResult, TKey extends readonly unknown[]>(config: {
	queryFn: (params: TParams) => TResult | Promise<TResult>;
	queryKey: (params: NoInfer<TParams>) => TKey;
}): QueryDefinition<TParams, Awaited<TResult>, TKey>;

export function defineQuery(config: {
	queryFn: (params: unknown) => unknown;
	queryKey: (params: unknown) => readonly unknown[];
}): QueryDefinition<unknown, unknown> {
	return {
		key: config.queryKey,
		query: (params) => ({
			queryKey: config.queryKey(params),
			queryFn: () => config.queryFn(params),
		}),
	};
}

/**
 * Groups related query definitions under a shared base key.
 *
 * Each member query's key is automatically prefixed with `baseKey`,
 * so individual queries only define their tail segment.
 * `group.base()` returns the raw base key for blanket invalidation.
 *
 * @example
 * ```ts
 * const pagesQueries = defineQueryGroup({
 *   baseKey: ['pages'],
 *   queries: {
 *     single: defineQuery({
 *       queryKey: ({ id, nazioni_ID }) => ['single', { id, nazioni_ID }],
 *       queryFn: ({ id, nazioni_ID }: PageParams) => api.v1.cms.getPage(id, { nazioni_ID }),
 *     }),
 *     list: defineQuery({
 *       queryKey: ({ ids, nazioni_ID }) => ['list', { ids, nazioni_ID }],
 *       queryFn: (params: PageListParams) => api.v1.cms.getPages(params),
 *     }),
 *   },
 * });
 *
 * pagesQueries.base()                      // → ['pages']
 * pagesQueries.single.key({ id: 1, ... })  // → ['pages', 'single', { id: 1, ... }]
 * pagesQueries.single.query({ id: 1, ... }) // → { queryKey, queryFn }
 *
 * // Invalidate all pages at once:
 * queryClient.invalidateQueries({ queryKey: pagesQueries.base() });
 * ```
 */
export function defineQueryGroup<
	TBase extends readonly unknown[],
	TDefs extends Record<string, QueryDefinition<unknown, unknown>>,
>(config: { baseKey: TBase; queries: TDefs }): { base(): TBase } & TDefs {
	function wrapDef<TParams, TResult, TKey extends readonly unknown[]>(
		def: QueryDefinition<TParams, TResult, TKey>,
	): QueryDefinition<TParams, TResult, readonly unknown[]> {
		return {
			key: (params) => [...config.baseKey, ...def.key(params)],
			query: (params) => {
				const inner = def.query(params);
				return {
					queryKey: [...config.baseKey, ...inner.queryKey],
					queryFn: inner.queryFn,
				};
			},
		};
	}

	// Object.fromEntries loses the per-key generics — single boundary cast here.
	const wrapped = Object.fromEntries(
		Object.entries(config.queries).map(([k, v]) => [k, wrapDef(v)]),
	) as TDefs;

	return { base: () => config.baseKey, ...wrapped };
}
