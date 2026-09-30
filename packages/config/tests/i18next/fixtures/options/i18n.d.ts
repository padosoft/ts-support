// gescat-mobile-app's setup: selector API, strict key checks, several namespaces.
import "@padosoft/config/types/i18next";
import type { common, settings } from "../shared";

declare module "@padosoft/config/types/i18next" {
	interface I18nConfig {
		Locale: "en" | "it";
		Translation: { common: typeof common; settings: typeof settings };
		DefaultNS: "settings";
		EnableSelector: "optimize";
		StrictKeyChecks: true;
	}
}

// Options I18nConfig doesn't cover still go on CustomTypeOptions.
declare module "i18next" {
	interface CustomTypeOptions {
		allowObjectInHTMLChildren: true;
	}
}
