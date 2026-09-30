// A script (no import/export), so these `declare module` blocks are ambient
// declarations. `css.ts` references it: its bundled `.d.mts` is a module, where
// they'd be ignored as augmentations.

declare module "*.module.css" {
	const classes: { readonly [key: string]: string };
	export default classes;
}

declare module "*.css" {
	const content: string;
	export default content;
}
