// An app's usual augmentation: a `.d.ts` file declaring only Locale and Translation.
import "@padosoft/config/types/i18next";
import type { common } from "../shared";

declare module "@padosoft/config/types/i18next" {
	interface I18nConfig {
		Locale: "en" | "it";
		Translation: { common: typeof common };
	}
}
