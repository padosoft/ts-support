export const fillArray = <T>(obj: T, n = 8): T[] =>
	Array.from({ length: n }, () => ({ ...obj }));

export const toPascalCase = (string: string): string => {
	"worklet";
	return `${string}`
		.toLowerCase()
		.replace(new RegExp(/[-_]+/, "g"), " ")
		.replace(new RegExp(/[^\w\s]/, "g"), "")
		.replace(
			new RegExp(/\s+(.)(\w*)/, "g"),
			(_, $2, $3) => `${$2.toUpperCase() + $3}`,
		)
		.replace(new RegExp(/\w/), (s) => s.toUpperCase());
};

export const isColor = (str: string): boolean =>
	/^#([0-9A-Fa-f]{3}){1,2}$|^rgb/.test(str);

export const sleep = (ms = 5000): Promise<void> =>
	new Promise<void>((r) => setTimeout(() => r(), ms));
