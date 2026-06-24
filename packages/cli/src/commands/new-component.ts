import { join, resolve } from "node:path";
import { assertNotExists, kebabCase, pascalCase, writeFileWithDirs } from "../utils/fs";

interface NewComponentOptions {
	name?: string;
	pkg?: string;
	variants?: boolean;
}

const COMPONENT_TEMPLATE = (name: string) => `import { forwardRef, memo } from "react";
import { Text, View } from "react-native";
import { cn } from "../lib/utils";

interface ${name}Props extends React.ComponentPropsWithoutRef<typeof View> {}

export const ${name} = memo(
	forwardRef<React.ComponentRef<typeof View>, ${name}Props>(
		({ className, ...props }, ref) => {
			return (
				<View className={cn(styles.container, className)} ref={ref} {...props}>
					<Text className={styles.text}>${name}</Text>
				</View>
			);
		},
	),
);

${name}.displayName = "${name}";

const styles = {
	container:
		"group flex items-center justify-center rounded-md bg-primary h-12 px-5 py-3 active:opacity-90",
	text: "text-white text-lg font-semibold text-center",
} as const;
`;

const COMPONENT_VARIANTS_TEMPLATE = (name: string) => {
	const camel = name.charAt(0).toLowerCase() + name.slice(1);
	return `import { type VariantProps, cva } from "class-variance-authority";
import { forwardRef, memo } from "react";
import { Text, View } from "react-native";
import { cn } from "../lib/utils";

const ${camel}Variants = cva(
	"group flex items-center justify-center rounded-md",
	{
		variants: {
			variant: {
				default: "bg-primary active:opacity-90",
			},
			size: {
				default: "h-12 px-5 py-3",
				sm: "h-9 rounded-md px-3",
				lg: "rounded-md px-8 h-14",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

interface ${name}Props
	extends React.ComponentPropsWithoutRef<typeof View>,
		VariantProps<typeof ${camel}Variants> {}

export const ${name} = memo(
	forwardRef<React.ComponentRef<typeof View>, ${name}Props>(
		({ className, variant, size, ...props }, ref) => {
			return (
				<View
					className={cn(${camel}Variants({ variant, size, className }))}
					ref={ref}
					{...props}
				>
					<Text className={styles.text}>${name}</Text>
				</View>
			);
		},
	),
);

${name}.displayName = "${name}";

const styles = {
	text: "text-white text-lg font-semibold text-center",
} as const;
`;
};

export const newComponent = async (opts: NewComponentOptions): Promise<void> => {
	const rawName = opts.name;
	const pkg = opts.pkg;
	const variants = opts.variants ?? false;

	if (!rawName) {
		console.error("  error   --name is required");
		process.exit(1);
	}
	if (!pkg) {
		console.error("  error   --pkg is required");
		process.exit(1);
	}

	const name = pascalCase(rawName);
	const fileName = kebabCase(rawName);
	const cwd = process.cwd();
	const filePath = resolve(join(cwd, "packages", pkg, "src/components", `${fileName}.tsx`));

	assertNotExists(filePath);

	const content = variants ? COMPONENT_VARIANTS_TEMPLATE(name) : COMPONENT_TEMPLATE(name);

	console.log(`\nCreating component ${name}\n`);
	await writeFileWithDirs(filePath, content);
	console.log("\nDone.");
};
