// Augmenting a module doesn't load it: this puts i18next's declarations in the
// program. (Dropped from the build; apps import i18next anyway.)
import type {} from "i18next";

/**
 * Type configuration for i18next. Empty on purpose: augment it in your app and
 * every member you declare is picked up. Members you leave out fall back to the
 * defaults below.
 *
 * | Member            | Meaning                                                        | Default                        |
 * | ----------------- | -------------------------------------------------------------- | ------------------------------ |
 * | `Locale`          | Union of supported locale codes                                | `string`                       |
 * | `Translation`     | Resources of one locale, keyed by namespace                    | not set: any key is accepted   |
 * | `DefaultNS`       | i18next `defaultNS`                                            | `keyof Translation`            |
 * | `EnableSelector`  | i18next `enableSelector` (`false`, `true`, `"optimize"`, ...)  | `false`                        |
 * | `StrictKeyChecks` | i18next `strictKeyChecks`                                      | `false`                        |
 *
 * Declare each member once, with its final type: members can't be redeclared
 * with a different type (TS2717). Import this module next to the augmentation:
 * augmenting it doesn't load it.
 *
 * `skipLibCheck: true` skips every `.d.ts` file, including your own, so an
 * augmentation in a `.d.ts` file that doesn't compile is silently dropped.
 * Check it with `skipLibCheck: false`, or keep it in a `.ts` file.
 *
 * `@padosoft/rn-i18n` has its own, separate `I18nConfig` (lowercase `locale`
 * and `translations`, keyed by locale first). `Translation` here is a single
 * locale's entry of that map.
 *
 * @example
 * ```ts
 * // src/types/i18n.d.ts
 * import "@padosoft/config/types/i18next";
 * import type { common } from "../i18n/locales/en/common";
 *
 * declare module "@padosoft/config/types/i18next" {
 *   interface I18nConfig {
 *     Locale: "en" | "it";
 *     Translation: { common: typeof common };
 *     // Optional:
 *     EnableSelector: "optimize";
 *     StrictKeyChecks: true;
 *   }
 * }
 * ```
 *
 * @see https://www.i18next.com/overview/typescript
 */
// biome-ignore lint/suspicious/noEmptyInterface: consumers augment it; declared members couldn't be redeclared (TS2717)
export interface I18nConfig {}

/** `I18nConfig[K]` when the app declares it, `Fallback` otherwise. */
type Configured<K extends string, Fallback> =
	I18nConfig extends Record<K, infer V> ? V : Fallback;

/** Union of supported locale codes; `string` when `Locale` isn't configured. */
export type Locale = Configured<"Locale", string>;

/** Resources of one locale, keyed by namespace; `never` when `Translation` isn't configured. */
export type Translation = Configured<"Translation", never>;

/** Namespaces of `Translation`. Guarded because `keyof never` is `string`. */
type Namespace = [Translation] extends [never]
	? never
	: keyof Translation & string;

type OmitNever<T> = {
	[K in keyof T as [T[K]] extends [never] ? never : K]: T[K];
};

/**
 * The i18next type options derived from {@link I18nConfig}. Only configured
 * members are set: anything left out keeps i18next's own default, so an
 * unconfigured app keeps i18next's permissive typing. Other i18next type
 * options can still be set by augmenting `CustomTypeOptions` directly.
 */
export type CustomI18NTypeOptions = OmitNever<{
	resources: Translation;
	defaultNS: Configured<"DefaultNS", Namespace>;
	enableSelector: Configured<"EnableSelector", never>;
	strictKeyChecks: Configured<"StrictKeyChecks", never>;
}>;

declare module "i18next" {
	interface CustomTypeOptions extends CustomI18NTypeOptions {}

	// Narrows the inherited `string` members. Valid against i18next's ESM typings
	// (`index.d.mts`), where `i18n` only extends the CJS interface; with the CJS
	// typings (`moduleResolution: node10`) it's a TS2717 error.
	// At runtime `language` is the requested or detected code, which may not be
	// a supported locale (e.g. `en-US`); `resolvedLanguage` is the one in use.
	interface i18n {
		language: Locale;
		languages: readonly Locale[];
		resolvedLanguage?: Locale;
	}
}
