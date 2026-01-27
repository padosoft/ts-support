import { tsdown } from "@padosoft/config/tsdown";

export default tsdown({
	entry: ["src/**/*.ts"],
	external: [
		"zod",
		"@opentelemetry/api",
		"@opentelemetry/sdk-logs",
		"@opentelemetry/resources",
		"@opentelemetry/semantic-conventions",
		"@opentelemetry/exporter-logs-otlp-http",
	],
	exports: true,
	unbundle: true,
});
