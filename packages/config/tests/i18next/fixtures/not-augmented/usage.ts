// Including the helpers without augmenting I18nConfig keeps i18next's defaults.
import type {
	CustomI18NTypeOptions,
	Locale,
} from "@padosoft/config/types/i18next";
import i18next, { type TypeOptions } from "i18next";
import type { Equal, Expect } from "../shared";

// Any key is accepted, with any options.
i18next.t("anything");
i18next.t("some.nested.key", { count: 1 });
i18next.t("ns:key", { name: "Ada" });
const value = i18next.t("anything");

export type Assertions = [
	Expect<Equal<typeof value, string>>,
	Expect<Equal<keyof CustomI18NTypeOptions, never>>,
	Expect<Equal<TypeOptions["resources"], object>>,
	Expect<Equal<TypeOptions["defaultNS"], "translation">>,
	Expect<Equal<TypeOptions["enableSelector"], false>>,
	Expect<Equal<TypeOptions["strictKeyChecks"], false>>,
	Expect<Equal<Locale, string>>,
	Expect<Equal<typeof i18next.language, string>>,
	Expect<Equal<typeof i18next.languages, readonly string[]>>,
];
