/**
 * A plain object compatible with React Query (and similar libs) without importing them.
 * Spread directly into `useQuery()`, `useSuspenseQuery()`, etc.
 */
export type QueryDescriptor<TResult> = {
	queryKey: readonly unknown[];
	queryFn: () => Promise<TResult>;
};

/**
 * A typed query definition — holds the key factory and the fn factory together
 * so parameters only need to be specified once at the call site.
 */
export type QueryDefinition<TParams, TResult> = {
	/** Returns the query key array for the given params. Use for cache invalidation / prefetching. */
	key(params: TParams): readonly unknown[];
	/** Returns `{ queryKey, queryFn }` — spread directly into `useQuery()`. */
	query(params: TParams): QueryDescriptor<TResult>;
};

/**
 * Defines a typed query that pairs a key factory with a fn factory sharing the same params.
 *
 * The returned object is framework-agnostic — `query(params)` produces a plain
 * `{ queryKey, queryFn }` object that can be spread into any React Query compatible hook.
 *
 * @example
 * ```ts
 * const cmsSectionQuery = defineQuery({
 *   queryKey: (p) => ['cms', 'section', p],
 *   queryFn: (p) => api.v1.cms.getCmsSection(p.section, p),
 * });
 *
 * // In component — params specified once:
 * useQuery({
 *   ...cmsSectionQuery.query({ section, nazioni_ID, listini_ID, lang, device }),
 *   enabled: !!section,
 * });
 *
 * // For cache invalidation:
 * queryClient.invalidateQueries({ queryKey: cmsSectionQuery.key({ section, ... }) });
 * ```
 */
export function defineQuery<TParams, TResult>(config: {
	queryKey: (params: TParams) => readonly unknown[];
	queryFn: (params: TParams) => Promise<TResult>;
}): QueryDefinition<TParams, TResult> {
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
 *       queryFn: ({ id, nazioni_ID }) => api.v1.cms.getPage(id, { nazioni_ID }),
 *     }),
 *     list: defineQuery({
 *       queryKey: ({ ids, nazioni_ID }) => ['list', { ids, nazioni_ID }],
 *       queryFn: (params) => api.v1.cms.getPages(params),
 *     }),
 *   },
 * });
 *
 * pagesQueries.base()                    // → ['pages']
 * pagesQueries.single.key({ id: 1, ... }) // → ['pages', 'single', { id: 1, ... }]
 * pagesQueries.single.query({ id: 1, ... }) // → { queryKey, queryFn }
 *
 * // Invalidate all pages at once:
 * queryClient.invalidateQueries({ queryKey: pagesQueries.base() });
 * ```
 */
export function defineQueryGroup<
	TBase extends readonly unknown[],
	TDefs extends Record<string, QueryDefinition<unknown, unknown>>,
>(config: {
	baseKey: TBase;
	queries: TDefs;
}): { base(): TBase } & TDefs {
	const result: Record<string, unknown> = {
		base: () => config.baseKey,
	};

	for (const [name, def] of Object.entries(config.queries)) {
		result[name] = {
			key: (params: unknown) => [...config.baseKey, ...def.key(params)],
			query: (params: unknown) => {
				const inner = def.query(params);
				return {
					queryKey: [...config.baseKey, ...inner.queryKey],
					queryFn: inner.queryFn,
				};
			},
		} satisfies QueryDefinition<unknown, unknown>;
	}

	// Single boundary cast: Record<string,unknown> → { base() } & TDefs.
	// The runtime shape matches exactly — each entry is a QueryDefinition with the base key prepended.
	return result as { base(): TBase } & TDefs;
}
