import type { Logger } from "..";

export const createDrizzleAdapter = (logger: Logger) => {
	return {
		logQuery(query: string, params: unknown[]): void {
			logger.debug("drizzle-orm DB query", { query, params });
		},
	};
};
