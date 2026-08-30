# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — runs `vite build --watch` together with the Vite dev server on port 8000, auto-opening `/demo/`.
- `npm run build` — production library build via Vite (entry `src/widget-form.ts`, ES format, `dist/widget-form.js`).
- `npm run watch` — incremental library build only.
- `npm run types` — regenerates `src/definition-schema.d.ts` from `src/definition-schema.json` using `json-schema-to-typescript`. Run this whenever `definition-schema.json` changes.
- `npm run analyze` — produces a `custom-elements.json` manifest via `@custom-elements-manifest/analyzer`.
- `npm run release` — `npm version patch`: preflight guards (on `main`, clean tree, not behind `origin/main`, generated files current, build passes), then commit, bare-semver tag, `git push --follow-tags`, then waits on the CI run and fails if the npm publish fails. `npm run release:minor` / `release:major` for other bumps.
- `npm run link` / `unlink` — link the local build into a sibling `../RESWARM/frontend` checkout for in-place testing.

There is no test suite or linter configured; Prettier config lives in `.prettierrc`.

## Architecture

This package ships a single Lit 3 web component, `widget-form`, consumed by the IronFlock/RESWARM dashboard platform. The whole component lives in `src/widget-form.ts`; everything else is configuration or generated.

### Versioned custom element tag

The class is registered as `widget-form-versionplaceholder`. The literal string `versionplaceholder` is rewritten to `pkg.version` at build time by `@rollup/plugin-replace` (configured in `vite.config.ts`). Consumers must therefore use a version-suffixed tag matching the installed package version, e.g. `<widget-form-1.0.16>`. This lets multiple versions of the widget coexist on the same dashboard page. When changing the version, no source edits are needed — the build substitutes it.

### Schema-driven configuration

`src/definition-schema.json` is the source of truth for the widget's configurable inputs. It is consumed two ways:

1. The IronFlock dashboard editor reads it (with custom keywords like `dataDrivenDisabled`, `condition.relativePath/showIfValueIn`, `targetColumn`, `order`, `required`) to render the widget's settings UI.
2. `npm run types` converts it into `src/definition-schema.d.ts`, which `widget-form.ts` imports as `FormConfiguration` / `FormFields`.

Always edit `definition-schema.json` first, then run `npm run types`. The descriptions in the schema are written for AI/LLM consumption (see commit `f2e58ea`).

### Component contract

- Inputs: `inputData: FormConfiguration` (form config + fields), `theme: { theme_name, theme_object }`, `route: string` (current dashboard route, used by `resolveRoute` for `*` segment substitution and `{{label}}` variable interpolation in `deleteNavigationRoute`).
- Outputs: dispatches `data-submit` (non-bubbling) with an array of `{ swarm_app_databackend_key, table_name, column_name, value }` mappings — one entry per `formField` plus an extra entry for `deleteFlagColumn` when present. On delete it additionally dispatches a bubbling/composed `nav-submit` event with the resolved route.
- Each field's `targetColumn` (type `targetColumn` in the schema) is the platform's database column picker; the host wires its value, and submission carries the same identifiers back so the host can persist data.
- Theming: reads `--re-text-color` and `--re-tile-background-color` CSS variables first, then falls back to `theme.theme_object`. Material Web tokens (`--md-sys-color-*`, `--md-menu-*`) are then re-derived from those values inside `render()`.
- Form rendering uses Material Web (`@material/web` is a peer dependency, externalized in the rollup output). Inline mode renders fields directly; `formButton` mode renders a FAB that opens an `md-dialog`. `formKey` is incremented to force a full re-render on reset.
- Hidden fields (`hiddenField: true`) submit via `<input type="hidden">`; checkbox values are normalized to `'on'`/`'off'` then to booleans in `formatValue`.

### Build pipeline notes

- `vite.config.ts` externalizes `@material/web/*` and `lit-flatpickr` so consumers provide them. `tslib` is aliased to its ES module entry.
- `vite-plugin-dts` rolls up declarations into `dist/widget-form.d.ts`.
- The demo (`demo/index.html`) imports `../src/widget-form.js` directly and computes the tag from `package.json` version, mirroring how the platform consumes the published build.

## `aiSelection` in `src/definition-schema.json`

The schema root carries an `aiSelection` block next to `title` and `description`. It is **not** JSON Schema and describes no config field — it exists so the IronFlock AI's Widget Builder can pick the right widget for a given shape of data, using knowledge only the widget author has:

```jsonc
"aiSelection": {
  "dataShape": "…what columns this widget consumes and what each one means…",
  "useWhen":   ["…a situation, naming the properties that express it…"],
  "notFor":    ["…a situation this widget is wrong for, naming the widget to use instead…"]
}
```

It is inert everywhere else, and must stay that way: `json2ts` ignores it (the generated `.d.ts` is byte-identical with and without it), the dashboard config editor renders only `schema.properties`, and the AI service's `validate_widget` validates *configs* against the schema, skipping unknown Draft-7 keywords.

When maintaining it:

- `notFor` is the high-value half and the part plain descriptions always omit. Every entry must name the widget that *should* be used, or it rejects without routing.
- Write for an LLM with no other documentation: describe the visible result and the user's intent, not the implementation.
- Prefer entries that discriminate against a *neighbouring* widget. Generic rejections are cheap; the ones that pay are those an author could plausibly get wrong.
- The `notFor` lists are a set across all `widget-*` repos and are meant to be reciprocal — if this widget routes to another for some case, that widget should usually route back for the converse. Changing one side is a cue to check the other.
- Update it whenever a property changes what this widget can *do*, not just how it looks.
