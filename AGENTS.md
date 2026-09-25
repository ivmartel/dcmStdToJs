# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project

`dcmstdtojs` parses the DICOM standard DocBook XML (parts 3, 5, 6 and 7)
into JS objects and JSON strings. It is a browser-first ES module library
(no runtime dependencies) that takes DOM `Document`s as input; in Node.js
and tests the DOM comes from jsdom.

## Layout

- `src/`: library sources (plain JS with JSDoc types, no TypeScript files).
  - `index.js`: public exports (`DicomXMLParser`, `DicomParseResult`,
    `DicomTag`, `DicomUID`, `DicomModule`, `DicomModuleAttribute`).
  - `parser.js`: `DicomXMLParser`, dispatches on the book label
    (`PS3.3`, `PS3.5`, `PS3.6`, `PS3.7`).
  - `genericParser.js`: shared DocBook helpers (book info, version,
    tables, variable lists...).
  - `moduleParser.js` (PS3.3), `vrParser.js` (PS3.5),
    `tagParser.js` (PS3.6 tags + PS3.7), `uidParser.js` (PS3.6 UIDs),
    `conditionParser.js` (module attribute conditions).
  - `nema.js`: list of bundled standard versions/parts and their URLs
    (used by the dev GUI).
- `tests/`: Vitest tests (`*.test.js`, jsdom environment). `utils.js`
  builds small XML fixtures; prefer it over loading full standard files.
- `dev/`: demo/dev GUI served by `yarn start`, deployed to gh-pages by CI.
- `resources/standard/YYYYa/partNN.xml`: copies of the NEMA standard
  (NEMA does not allow CORS, so they are served from the repo).
- `resources/api/`: TypeScript declaration and api-extractor config;
  `dcmstdtojs.api.md` is the committed API report.
- `assets/YYYYa/dicom_tags.json`: generated tag dictionaries, shipped in
  the package.
- `config/`: webpack and full eslint configs.
- `build/`, `dist/`, `coverage/`: generated, git-ignored. Do not edit.

## Commands

Uses yarn v4 via Corepack (`corepack enable`), Node.js >= 18
(CI uses Node 24).

- `yarn install --immutable`: install dependencies.
- `yarn lint`: eslint with JSDoc rules (`config/eslint.config-full.js`).
- `yarn test --run`: run tests once (`yarn test` alone watches).
- `yarn test-ci`: tests with coverage (80% thresholds on all metrics).
- `yarn build`: webpack bundle to `dist/`, types, and api report.
- `yarn start`: dev server at http://localhost:8080.

CI (`.github/workflows/nodejs-ci.yml`) runs lint, `test-ci` and `build`;
all three must pass before a change is done.

## Conventions

- Code style is enforced by eslint: 2-space indent, single quotes,
  semicolons, `===`, curly braces always, `const`/`let` (no `var`),
  max line length 80, 1tbs braces, no space before named function parens.
- Every function/class/member needs a JSDoc comment with types; descriptions
  must be complete sentences (end with a period). Use `@import` in JSDoc
  for type-only imports. Type definitions are generated from JSDoc, so
  keep types accurate.
- Local imports use explicit `.js` extensions.
- Unused args are prefixed with `_`.
- Code must work in the browser: do not use Node-only APIs in `src/`.
  Avoid relying on globals like `Element` (use DOM-node-based checks).
- Tests: one `tests/<file>.test.js` per `src/<file>.js`, using
  `describe`/`test`/`expect` from `vitest` and fixtures built with
  `tests/utils.js`. Keep coverage above the thresholds.

## Public API changes

If a change touches exported types or signatures, run `yarn build` and
commit the updated `resources/api/dcmstdtojs.api.md`. Add a line to
`changelog.md` for user-facing changes.

## Adding a new standard version

1. Download `partNN.xml` for parts 03, 05, 06 and 07 from
   `https://dicom.nema.org/medical/dicom/YYYYx/source/docbook/partNN/partNN.xml`
   into `resources/standard/YYYYx/`.
2. Add the version to `dicomVersions` in `src/nema.js`.
3. Generate `assets/YYYYx/dicom_tags.json` with the dev GUI
   (`yarn start`, parse tags from parts 6 and 7, download).

## Notes

- The standard XML files are large; do not read them whole. Search them
  with `grep` or inspect a small excerpt.
- Do not run `git stash` to try things out; use a scratch copy instead.
