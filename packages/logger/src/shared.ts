import { Logger } from "./core/logger";
import { rateLimiterPlugin } from "./plugins/rate-limiter";
import { consoleTransport } from "./transports/console";

export const logger: Logger = new Logger({
	transports: [consoleTransport()],
});

logger.setBatching({
	maxBatchSize: 10,
});

//logger.addPlugin(rateLimiterPlugin(1000));
logger.info("booting...");
console.log("hey");
logger.debug("debug info");
logger.error("oops");
console.log("hey2");
logger.error("oops2");

logger.flush();
