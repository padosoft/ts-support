---
"@padosoft/config": minor
---

Make `@padosoft/config/types/i18next` actually augmentable, and configurable.

`I18nConfig` declared `Locale: never; Translation: never`, so augmenting it failed with TS2717. Apps usually keep the augmentation in a `.d.ts` file, where `skipLibCheck: true` hid the error: `resources` stayed `never` and every `t()` call failed with "Type instantiation is excessively deep". Including the file without augmenting it broke `t()` the same way.

- `I18nConfig` is now an empty interface and its members are read with `infer`, so every member is optional. `Locale` falls back to `string`. Without a `Translation`, i18next keeps its default, permissive typing.
- New optional members `DefaultNS`, `EnableSelector` and `StrictKeyChecks` map to i18next's `defaultNS`, `enableSelector` and `strictKeyChecks`. Only declared members reach `CustomTypeOptions`, so other i18next options can still be set there directly.
- `Locale` and `Translation` are exported. `i18n.languages` is now `readonly Locale[]`, matching i18next.
- `CustomI18NTypeOptions` no longer has `lng` and `fallbackLng`, which i18next doesn't read from its type options.
- Fixed the JSDoc example (it augmented `@gescat/i18n/config`) and documented the setup in the README, including how `skipLibCheck` hides augmentation errors.
