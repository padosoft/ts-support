# @padosoft/logger

## 1.4.0

### Minor Changes

- [#32](https://github.com/padosoft/ts-support/pull/32) [`b8068c4`](https://github.com/padosoft/ts-support/commit/b8068c410a773cf4c732d9f812be6d347c81de49) Thanks [@47PADO47](https://github.com/47PADO47)! - Add `chalk` utility built on `node:util` `styleText`.

  - `@padosoft/utilities`: new `./lib/chalk` subpath export — a chainable, proxy-based `chalk` instance backed by Node's native `styleText` (auto-respects `NO_COLOR`/`FORCE_COLOR`)
  - `@padosoft/logger`: console transport colors now use `chalk` instead of raw ANSI escape codes
  - `@padosoft/cli`: CLI output (skip/write/create/error) is now colorized via `chalk`

### Patch Changes

- Updated dependencies [[`b8068c4`](https://github.com/padosoft/ts-support/commit/b8068c410a773cf4c732d9f812be6d347c81de49)]:
  - @padosoft/utilities@1.5.0

## 1.3.2

### Patch Changes

- [`b017a2c`](https://github.com/padosoft/ts-support/commit/b017a2cd9669260f2dd28eec06579a902175aece) Thanks [@47PADO47](https://github.com/47PADO47)! - bump deps

## 1.3.1

### Patch Changes

- [`d01b29f`](https://github.com/padosoft/ts-support/commit/d01b29fb568b4b513a89c806c7f19f056fd7797f) Thanks [@47PADO47](https://github.com/47PADO47)! - update deps

## 1.3.0

### Minor Changes

- [`ab3d36e`](https://github.com/padosoft/ts-support/commit/ab3d36e1cd5002925e63f59683fc66e7c8f8c1f7) Thanks [@47PADO47](https://github.com/47PADO47)! - update tsdown

### Patch Changes

- [`ab3d36e`](https://github.com/padosoft/ts-support/commit/ab3d36e1cd5002925e63f59683fc66e7c8f8c1f7) Thanks [@47PADO47](https://github.com/47PADO47)! - add LOG_FILE_SEPARATOR constant

- [`ab3d36e`](https://github.com/padosoft/ts-support/commit/ab3d36e1cd5002925e63f59683fc66e7c8f8c1f7) Thanks [@47PADO47](https://github.com/47PADO47)! - update deps

## 1.2.2

### Patch Changes

- [`e4f1ba8`](https://github.com/padosoft/ts-support/commit/e4f1ba8acf343670ebfd5251774af6c3c98a08ff) Thanks [@47PADO47](https://github.com/47PADO47)! - add cleanOnStart option to expo-fs transport

- [`e4f1ba8`](https://github.com/padosoft/ts-support/commit/e4f1ba8acf343670ebfd5251774af6c3c98a08ff) Thanks [@47PADO47](https://github.com/47PADO47)! - update deps

## 1.2.1

### Patch Changes

- [`873297d`](https://github.com/padosoft/ts-support/commit/873297d85c8088ec344d8380e88cbc069da489d6) Thanks [@47PADO47](https://github.com/47PADO47)! - fix types exports

## 1.2.0

### Minor Changes

- [`0d30160`](https://github.com/padosoft/ts-support/commit/0d30160126b4aa882cf03c9133cb78e7e8de30ec) Thanks [@47PADO47](https://github.com/47PADO47)! - feat: add support for raw logs

## 1.1.1

### Patch Changes

- [`2ebe2f2`](https://github.com/padosoft/ts-support/commit/2ebe2f2d2d4ab90c408ef8348a2b64fa85905fa9) Thanks [@47PADO47](https://github.com/47PADO47)! - fix expo-ts transport

## 1.1.0

### Minor Changes

- [`4847b53`](https://github.com/padosoft/ts-support/commit/4847b53d306e735c0efb375f697c99ee2b198e67) Thanks [@47PADO47](https://github.com/47PADO47)! - feat: expo-fs and discord transports

## 1.0.2

### Patch Changes

- [`4b0c7c8`](https://github.com/padosoft/ts-support/commit/4b0c7c8af8167a30e5eb58e4b6ed65c762756583) Thanks [@47PADO47](https://github.com/47PADO47)! - console plugin fixes

- [`76927c6`](https://github.com/padosoft/ts-support/commit/76927c6c92a530198a21da15bff0b27068fd3f64) Thanks [@47PADO47](https://github.com/47PADO47)! - add expo-fs transport

## 1.0.1

### Patch Changes

- [`a102554`](https://github.com/padosoft/ts-support/commit/a1025540fbeae0d5b2fd89b8dad2d8554cbbee26) Thanks [@47PADO47](https://github.com/47PADO47)! - add missing console methods

## 1.0.0

### Major Changes

- [`5024beb`](https://github.com/padosoft/ts-support/commit/5024beb3dba163f0499d404caecbcc8fe96537cd) Thanks [@47PADO47](https://github.com/47PADO47)! - introduce logger package
