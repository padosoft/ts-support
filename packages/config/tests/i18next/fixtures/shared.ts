export type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;

export type Expect<T extends true> = T;

export const common = {
	hello: "Hello",
	greeting: "Hello, {{name}}!",
	server: {
		title: "Server",
		status: {
			online: "Online since {{since, datetime}}",
		},
	},
} as const;

export const settings = {
	theme: "Theme",
} as const;
