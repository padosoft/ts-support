import i18next, { type TypeOptions } from "i18next";
import type { Equal, Expect } from "../shared";

// Selector API, rooted at the default namespace.
i18next.t(($) => $.theme);
// @ts-expect-error unknown key
i18next.t(($) => $.nope);

// Other namespaces are selected through `ns`.
i18next.t(($) => $.server.title, { ns: "common" });
// @ts-expect-error unknown nested key
i18next.t(($) => $.server.nope, { ns: "common" });

export type Assertions = [
	Expect<Equal<TypeOptions["defaultNS"], "settings">>,
	Expect<Equal<TypeOptions["enableSelector"], "optimize">>,
	Expect<Equal<TypeOptions["strictKeyChecks"], true>>,
	Expect<Equal<TypeOptions["allowObjectInHTMLChildren"], true>>,
];
