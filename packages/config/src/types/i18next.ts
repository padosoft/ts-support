export interface I18nConfig {
	Locale: never;
	Translation: never;
}

type Locale = I18nConfig["Locale"];
type Translation = I18nConfig["Translation"];

/**
 * Custom type configuration used to enable fully type-safe i18next translations.
 *
 * Consumers should augment the configuration interface exposed by this package
 * to provide their application's `Locale` and `Translation` types.
 *
 * Ensure this declaration is included by the TypeScript compiler (typically via
 * a `.d.ts` file in your project).
 *
 * @example
 * ```ts
 * import type { resources } from "./i18n";
 *
 * declare module "@gescat/i18n/config" {
 *   interface I18nConfig {
 *     Locale: "it" | "en";
 *     Translation: typeof resources;
 *   }
 * }
 * ```
 *
 * @see https://www.i18next.com/overview/typescript
 */
export interface CustomI18NTypeOptions {
	enableSelector: false;
	defaultNS: keyof Translation;
	resources: Translation;
	lng: Locale | undefined;
	fallbackLng: Locale | undefined;
}

/**
 * Sovrascrizione interfaccia del pacchetto i18next
 */
declare module "i18next" {
	interface CustomTypeOptions extends CustomI18NTypeOptions {}
	interface i18n {
		language: Locale;
		languages: Locale[];
		resolvedLanguage?: Locale;
	}
}
