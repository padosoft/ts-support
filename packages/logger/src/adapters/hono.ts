import type { Logger } from "..";

export const createHonoAdapter = (logger: Logger) => {
	return (message: string, ...rest: string[]): void => {
		logger.info(message, ...rest);
	};
};
