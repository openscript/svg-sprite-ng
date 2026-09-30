# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [3.9.2](https://github.com/openscript/svg-sprite-ng/compare/v3.9.1...v3.9.2) (2026-09-30)

### 3.9.1 (2026-09-30)


### Features

* add tests for defs mode ([#613](https://github.com/openscript/svg-sprite-ng/issues/613)) ([e966811](https://github.com/openscript/svg-sprite-ng/commit/e96681132e2022e52b937617477600883733a860))
* adding async compile method (returns Promise) ([#607](https://github.com/openscript/svg-sprite-ng/issues/607)) ([84d31f2](https://github.com/openscript/svg-sprite-ng/commit/84d31f2e529efbcbf29ca78da0c7cb83356ef015))
* adding jsdoc linting ([#595](https://github.com/openscript/svg-sprite-ng/issues/595)) ([24d81aa](https://github.com/openscript/svg-sprite-ng/commit/24d81aa3e6285348a722bbd565d9eb48c179d32d))
* adding reference screenshot of sprite of svgs without dimensions ([#555](https://github.com/openscript/svg-sprite-ng/issues/555)) ([afd0006](https://github.com/openscript/svg-sprite-ng/commit/afd00062c84620a0481ae4763866b9071989cec8))
* adding tests for SVGSpriter.add ([#569](https://github.com/openscript/svg-sprite-ng/issues/569)) ([5a5d1dc](https://github.com/openscript/svg-sprite-ng/commit/5a5d1dc9eedec403b81d8ad9cc76662a4f28bc0f))
* adding tests to cover up svg without dimensions ([#556](https://github.com/openscript/svg-sprite-ng/issues/556)) ([59d7c3e](https://github.com/openscript/svg-sprite-ng/commit/59d7c3e676e83dd6285dc944f7774d8716268aa5))
* adding tests with different svg ([90ff67d](https://github.com/openscript/svg-sprite-ng/commit/90ff67d1ae2b65c59bb8d5b9a6e40860daa22ba6))
* changing svg dimension calculation from puppeteer to resvg ([#554](https://github.com/openscript/svg-sprite-ng/issues/554)) ([73a48a8](https://github.com/openscript/svg-sprite-ng/commit/73a48a890eb23d844bd9d409fd686b903b9a8df2))
* changing test name because of naming convention ([81d3364](https://github.com/openscript/svg-sprite-ng/commit/81d3364df7d749852af387238b95187de2e5b577))
* decrease Lodash usage ([#590](https://github.com/openscript/svg-sprite-ng/issues/590)) ([d5473e5](https://github.com/openscript/svg-sprite-ng/commit/d5473e5a49dcecef7db42a1176080ec11d2038b1))
* disable loadSystemFonts in resvg-js to improve first-time loading speed ([#576](https://github.com/openscript/svg-sprite-ng/issues/576)) ([c368ee1](https://github.com/openscript/svg-sprite-ng/commit/c368ee1ed59689755ff3e6d665e47e085c9b010d))
* download puppeteer when necessary ([dab7073](https://github.com/openscript/svg-sprite-ng/commit/dab707306d2ca19953fdbbf78bfb3fa128d413a2))
* final tests refactoring ([#605](https://github.com/openscript/svg-sprite-ng/issues/605)) ([2b373c8](https://github.com/openscript/svg-sprite-ng/commit/2b373c8afa7c8d68eeec852fad262110d5da285a))
* moving from mocha to jest ([#572](https://github.com/openscript/svg-sprite-ng/issues/572)) ([10fa340](https://github.com/openscript/svg-sprite-ng/commit/10fa34041f534043141998f6108f0a5869ea5bbc))
* Phase 2 core TypeScript rewrite in src/ ([f9f75a1](https://github.com/openscript/svg-sprite-ng/commit/f9f75a1fe34dda80fa69f36863f02f45b6996abe))
* Phase 3 CLI on yargs 18 and tinyglobby ([556a070](https://github.com/openscript/svg-sprite-ng/commit/556a070db6e78b2cf7aada055c0095369dba8c06))
* split css.packed.aligned.png into two files for more clear tests ([#612](https://github.com/openscript/svg-sprite-ng/issues/612)) ([3891501](https://github.com/openscript/svg-sprite-ng/commit/389150131cf0b3acd4758ea078e39a5762955a03))
* test refactoring ([#575](https://github.com/openscript/svg-sprite-ng/issues/575)) ([2d14a2a](https://github.com/openscript/svg-sprite-ng/commit/2d14a2a2f6202c34b01fa4ddd1404dbc8f036733))
* test refactoring ([#582](https://github.com/openscript/svg-sprite-ng/issues/582)) ([ad94788](https://github.com/openscript/svg-sprite-ng/commit/ad94788f58df074e757cc6b027fc613b261f5571))
* test refactoring ([#583](https://github.com/openscript/svg-sprite-ng/issues/583)) ([be238bb](https://github.com/openscript/svg-sprite-ng/commit/be238bbb996b7af5f8769931d6d1d02066364cd4))
* test refactoring ([#586](https://github.com/openscript/svg-sprite-ng/issues/586)) ([dbefc02](https://github.com/openscript/svg-sprite-ng/commit/dbefc0256db3339a58ca15a5a8b0170e042a0f90))
* test refactoring ([#601](https://github.com/openscript/svg-sprite-ng/issues/601)) ([c8f61b4](https://github.com/openscript/svg-sprite-ng/commit/c8f61b47ab177f32739ed0d94a81ff273ffa53dd))


### Bug Fixes

* checking passed config.log to be instance of winston.Logger ([#627](https://github.com/openscript/svg-sprite-ng/issues/627)) ([3ae69d7](https://github.com/openscript/svg-sprite-ng/commit/3ae69d7b1be65448a04c3e3db9aa0ef6635beeb6))
* **docs:** fix example config for inline symbols ([3b58817](https://github.com/openscript/svg-sprite-ng/commit/3b5881781fb7d6e16e0eabc82fcae5f0efccb36a))
* **docs:** fix incorrect type annotation ([1812642](https://github.com/openscript/svg-sprite-ng/commit/18126429fdc16f0076100c4c946356def8f684ca))
* **docs:** fix incorrect type annotation ([3baa895](https://github.com/openscript/svg-sprite-ng/commit/3baa895318bcc94f526401f222750165d8cfab6b))
* **docs:** fix typo ([7cb7679](https://github.com/openscript/svg-sprite-ng/commit/7cb767952a8512f1ea3c599af3ebb0037a78e897))
* fix crash with spriter.add(..., null, ...) ([85294f3](https://github.com/openscript/svg-sprite-ng/commit/85294f319880c1c3eb62de214d82d595c05b42ac))
* fixing valid svg checking ([#564](https://github.com/openscript/svg-sprite-ng/issues/564)) ([df2f9c6](https://github.com/openscript/svg-sprite-ng/commit/df2f9c6daf8baacbc74c585440a6538eef4c650f))
* improve error if svg.transforms is invalid ([028387b](https://github.com/openscript/svg-sprite-ng/commit/028387b368870c2224addf4b2c8c2fb02e5c2737))
* **logger:** use Winston v3 format configuration ([895f4f0](https://github.com/openscript/svg-sprite-ng/commit/895f4f0288442508e8d0d667aa137b0977b6c690))
* move puppeteer to peer dependencies ([9926062](https://github.com/openscript/svg-sprite-ng/commit/99260628621085ce384733fe828076eb2543359b))
* test snapshots ([5681bee](https://github.com/openscript/svg-sprite-ng/commit/5681beebeb1ee55d15b2d8778dfcd6fd3c77a6a6))
* use the mocha binary from node_modules ([8363b34](https://github.com/openscript/svg-sprite-ng/commit/8363b34e6c3c1f638f610248cfe86809e11e4e83))
