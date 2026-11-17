import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	buildDefaults,
	type CallSite,
	type ContractOptions,
	canonicalPath,
	collectCalls,
	listSourceFiles,
	renderContract,
} from "../src/utils/call-contract";

const options: ContractOptions = {
	fn: "useStyleOverride",
	namespaces: ["components", "screens"],
	variantProp: "variant",
	variantsKey: "variants",
	opaque: ["Platform.select", "StyleSheet"],
	name: "StyleContract",
	variantTypeName: "StyleVariantPath",
};

let root: string;

const write = (rel: string, content: string) => {
	const file = join(root, rel);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, content);
};

const extract = (opts: Partial<ContractOptions> = {}) => {
	const files = listSourceFiles([join(root, "src")]);
	return collectCalls(files, root.replaceAll("\\", "/"), {
		...options,
		...opts,
	});
};

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "padosoft-contract-"));
	write(
		"src/styles.ts",
		`export const sharedStyles = { container: "flex-1", size: 4 * 2 };`,
	);
	write(
		"src/button.tsx",
		`import { sharedStyles } from "./styles";
const defaultStyles = {
	...sharedStyles,
	label: "text-base",
	shadow: Platform.select({ ios: { x: 1 }, android: { y: 2 } }),
	hairline: StyleSheet.hairlineWidth,
	offset: -3,
	flags: [true, null],
	variants: { primary: { label: "text-white" } },
} as const;

export function Button({ variant }: { variant?: string }) {
	const s = useStyleOverride("button", defaultStyles, { variant });
	return null;
}
`,
	);
	write(
		"src/screen.tsx",
		`type Tab = "home" | "cart";
interface Props { tab: Tab }

export function Screen({ tab }: Props) {
	useStyleOverride(\`screens.\${tab}\`, { title: "text-xl" });
	return null;
}
`,
	);
	write(
		"src/components/ignored.d.ts",
		"export declare function useStyleOverride(): void;",
	);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("canonicalPath", () => {
	test("prefixes bare paths with the first namespace only", () => {
		const ns = ["components", "screens"];
		expect(canonicalPath("button", ns)).toBe("components.button");
		expect(canonicalPath("components.button", ns)).toBe("components.button");
		expect(canonicalPath("screens.home", ns)).toBe("screens.home");
	});

	test("without namespaces paths are kept as they are", () => {
		expect(canonicalPath("button", [])).toBe("button");
	});
});

describe("collectCalls", () => {
	test("resolves literal, template-over-union paths and defaults across imports", () => {
		const { calls, errors } = extract();
		expect(errors).toEqual([]);
		expect(calls.map((c) => c.path).sort()).toEqual([
			"components.button",
			"screens.cart",
			"screens.home",
		]);

		const button = calls.find((c) => c.path === "components.button");
		expect(button?.file).toBe("src/button.tsx");
		expect(button?.hasVariant).toBe(true);
		expect(button?.defaults).toEqual({
			container: "flex-1",
			size: 8,
			label: "text-base",
			shadow: { $expr: "Platform.select" },
			hairline: { $expr: "StyleSheet.hairlineWidth" },
			offset: -3,
			flags: [true, null],
			variants: { primary: { label: "text-white" } },
		});

		const home = calls.find((c) => c.path === "screens.home");
		expect(home?.hasVariant).toBe(false);
		expect(home?.defaults).toEqual({ title: "text-xl" });
	});

	test("reports every call that cannot be resolved with file and line", () => {
		write(
			"src/broken.tsx",
			`const dynamic = getStyles();
useStyleOverride("x", dynamic);
useStyleOverride(somePath, {});
`,
		);
		const { errors } = extract();
		rmSync(join(root, "src/broken.tsx"));
		expect(errors).toHaveLength(2);
		expect(errors[0]).toContain("src/broken.tsx:1");
		expect(errors[0]).toContain("getStyles()");
		expect(errors[1]).toContain("src/broken.tsx:3");
		expect(errors[1]).toContain("union alias");
	});

	test("only matches the configured function", () => {
		const { calls } = extract({ fn: "somethingElse" });
		expect(calls).toEqual([]);
	});
});

describe("renderContract", () => {
	let calls: CallSite[];
	let output: string;
	beforeAll(() => {
		calls = extract().calls;
		output = renderContract(buildDefaults(calls, "variants"), options);
	});

	test("lists paths sorted with slot types, without the variants key", () => {
		expect(output).toContain('"components.button": {');
		expect(output).toContain("\t\tlabel: string;");
		expect(output).toContain("\t\tsize: number;");
		expect(output).toContain("\t\tshadow: StyleContractJson;");
		expect(output).not.toContain("variants:");
		expect(output.indexOf("components.button")).toBeLessThan(
			output.indexOf("screens.cart"),
		);
	});

	test("only paths whose calls take a variant are in the variant union", () => {
		expect(output).toContain(
			'export type StyleVariantPath =\n\t| "components.button";',
		);
	});

	test("minify drops comments, indentation and line breaks", () => {
		const min = renderContract(buildDefaults(calls, "variants"), {
			...options,
			minify: true,
		});
		expect(min.split("\n")).toHaveLength(6); // header + 4 declarations + trailing newline
		expect(min).not.toContain("/**");
		expect(min).not.toContain("\t");
		expect(min).toContain(
			'"components.button":{container:string;flags:readonly StyleContractJson[];hairline:StyleContractJson;',
		);
		expect(min).toContain('export type StyleVariantPath="components.button";');
	});

	test("is `never` when no path takes a variant", () => {
		const noVariants = buildDefaults(
			calls.filter((c) => c.path.startsWith("screens.")),
			"variants",
		);
		expect(renderContract(noVariants, options)).toContain(
			"export type StyleVariantPath = never;",
		);
	});

	test("merges the shapes of several call sites of the same path", () => {
		const merged = buildDefaults(
			[
				{
					file: "a.ts",
					line: 1,
					path: "p",
					defaults: { a: "x" },
					hasVariant: false,
				},
				{
					file: "b.ts",
					line: 1,
					path: "p",
					defaults: { a: 1, b: true },
					hasVariant: false,
				},
			],
			"variants",
		);
		const rendered = renderContract(merged, options);
		expect(rendered).toContain("\t\ta: StyleContractJson;");
		expect(rendered).toContain("\t\tb: boolean;");
	});
});
