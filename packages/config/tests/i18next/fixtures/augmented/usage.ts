import type { Locale } from "@padosoft/config/types/i18next";
import i18next, { type TypeOptions } from "i18next";
import type { Equal, Expect } from "../shared";

// Valid keys, nested included.
i18next.t("hello");
i18next.t("server.title");
i18next.t("common:server.title");

// Invalid keys.
// @ts-expect-error unknown key
i18next.t("nope");
// @ts-expect-error unknown nested key
i18next.t("server.nope");
// @ts-expect-error a branch, not a leaf
i18next.t("server");
// @ts-expect-error unknown namespace
i18next.t("other:hello");

// Interpolation values.
i18next.t("greeting", { name: "Ada" });
// @ts-expect-error `name` is required
i18next.t("greeting", {});
// @ts-expect-error `name` is a string or a number
i18next.t("greeting", { name: true });
i18next.t("server.status.online", { since: new Date() });
// @ts-expect-error `since` is formatted as a datetime, so a Date
i18next.t("server.status.online", { since: "today" });

// Returned values are the literal translations.
const title = i18next.t("server.title");

export type Assertions = [
	Expect<Equal<typeof title, "Server">>,
	Expect<Equal<Locale, "en" | "it">>,
	Expect<Equal<typeof i18next.language, "en" | "it">>,
	Expect<Equal<typeof i18next.languages, readonly ("en" | "it")[]>>,
	Expect<Equal<typeof i18next.resolvedLanguage, "en" | "it" | undefined>>,
	Expect<Equal<TypeOptions["defaultNS"], "common">>,
	Expect<Equal<TypeOptions["enableSelector"], false>>,
	Expect<Equal<TypeOptions["strictKeyChecks"], false>>,
];
