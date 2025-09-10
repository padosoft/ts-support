export type ConsoleMethods = keyof Pick<
	Console,
	"log" | "warn" | "error" | "info" | "debug"
>;
