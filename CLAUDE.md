# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run start` — runs `vite build --watch` together with the Vite dev server on port 8000, auto-opening `/demo/`.
- `npm run build` — production library build via Vite (entry `src/widget-form.ts`, ES format, `dist/widget-form.js`).
- `npm run watch` — incremental library build only.
- `npm run types` — regenerates `src/definition-schema.d.ts` from `src/definition-schema.json` using `json-schema-to-typescript`. Run this whenever `definition-schema.json` changes.
- `npm run release` — `npm version patch`: preflight guards (on `main`, clean tree, not behind `origin/main`, generated files current, build passes), then the bump and a `dist/` rebuild (the `version` hook, so the local build registers the new tag), then commit, bare-semver tag, `git push --follow-tags`, then waits on the CI run and fails if the npm publish fails. `npm run release:minor` / `release:major` for other bumps.
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
- Theming: reads `--re-text-color` and `--re-tile-background-color` CSS variables first, then falls back to `theme.theme_object`. Material Web tokens (`--md-sys-color-*`, `--md-menu-*`) are then re-derived from those values inside `render()`. These are not snapshotted: `registerTheme()` stores a `var(--re-…, <theme value>)` chain, so a change to the host property repaints the tile live without the widget being told. The dialog and select menus (`--md-dialog-container-color`, `--md-menu-*`, `--md-sys-color-surface-container`) need an opaque surface, and `--re-text-color` is picked to read on the tile as displayed, so `surfaceColor()` composites the tile colour over the dashboard's `--re-background-color` over white (the dashboard view's own colour). With no dashboard background (standalone, the demo) the theme background stands in for it. Studio 3.5.7 and earlier painted `--re-background-color` twice under the tiles (on `<main>` and again on `dashboard-navigator`), so there a translucent dashboard colour stacked up on screen and the surface came out slightly lighter than the tile; later studios paint it once, which is exactly what `surfaceColor()` models. It reads the variables in `render()`, because a `var()` chain cannot be composited in JS, and `opaqueSurface()` caches the `#rrggbb` result by the input strings. The browser parses each colour through a canvas `fillStyle`, and a value it rejects counts as transparent, as it does on the tile (rejection is detected by setting the value after two different placeholders, because a rejected value leaves the previous one in place). The blend itself is plain source-over in JS. Never read canvas pixels for it: under Firefox's `resistFingerprinting`, which Tor Browser turns on, `getImageData()` returns random colours. What floats above the tile is raised on a dark surface: `raisedSurface()` paints white at 16% (`RAISE_ON_DARK`) over a surface whose WCAG luminance is below 0.18 (`DARK_SURFACE`, about mid grey) and that colour fills `--md-dialog-container-color` and the `--md-menu-*` colours, while the scrim deepens from Material's 0.32 to 0.6 (`SCRIM_OPACITY_*`). A dark page barely changes under a 32% scrim, so a dialog in the tile's own colour sank into it (a popup form on a transparent tile over a dark dashboard is that colour exactly); Material 3 shows elevation in dark schemes by lightening a surface, and a shadow does not show on a dark page. Light surfaces keep the tile colour and the 0.32 scrim. `patchDialogScrim()` writes the opacity into the sheet it adopts into md-dialog's shadow root and rewrites it when the surface turns dark or light, because older browsers do not let `::backdrop` inherit custom properties.
- Form rendering uses Material Web (`@material/web` is a peer dependency, externalized in the rollup output). Inline mode renders fields directly; `formButton` mode renders a FAB that opens an `md-dialog`. `formKey` is incremented to force a full re-render on reset. A dropdown's caption is a `div`, never a `<label>` wrapping the select: the label would send the select a second click, which in Firefox closes the menu the first click opened. Reset and Cancel (`md-outlined-button`) take the text colour, because Material's fixed purple primary does not read on a dark surface. Both action rows wrap, so a narrow window cannot clip the leftmost buttons.
- Dialog size (`formButton` mode): `.form` gives the dialog `width: min(90vw, 480px); max-height: 80vh` on top of md-dialog's `:host` `min-width: 280px; min-height: 140px; max-width`/`max-height: min(560px, calc(100% - 48px))`, which the native `<dialog>` inherits through the `display: contents` host. `formDialogSize.minWidth`/`minHeight` go through `dialogMinSize()` and land in md-dialog's `style` attribute as `min-*: min(<value>, calc(100% - 48px))`. That replaces md-dialog's 280x140px floor outright (a smaller value, 0 included, lowers it, and below a 328px-wide window any value lets the dialog shrink to the cap) and beats `.form` and md-dialog's `max-*` whenever it is larger; with neither set there is no `style` attribute. `%` is a share of the window because `showModal()` puts the dialog in the top layer. Keep the cap: the dialog swallows Escape and backdrop clicks, so its action bar is the only way out, and an uncapped minimum pushes it off the screen. Keep the grammar strict too (`DIALOG_MIN_SIZE`: a number plus an optional px, %, vw, vh, rem or em; no unit means px; empty or unset keeps the default, while 0 is a real minimum like any other value; anything else warns once and is ignored). `CSS.supports()` is no substitute: it accepts `800px/*`, whose comment swallows the cap and every declaration after it. The schema `pattern` on both leaves spells the same grammar (lowercase units only, and an explicit ASCII whitespace class, because the AI checks it with Python's `re`, whose `\s` also matches U+001C-U+001F and U+0085) so the AI's `validate_widget` rejects what the widget would ignore; change them together.
- Hidden fields (`hiddenField: true`) submit via `<input type="hidden">`; checkbox values are normalized to `'on'`/`'off'` then to booleans in `formatValue`.

### Build pipeline notes

- `vite.config.ts` externalizes `@material/web/*` and `lit-flatpickr` so consumers provide them. `tslib` is aliased to its ES module entry.
- `vite-plugin-dts` emits one declaration per source file (`dist/widget-form.d.ts`, plus `dist/definition-schema.d.ts` copied from `src`). It does not roll them up: bundling needs `@microsoft/api-extractor`, whose `argparse` -> `sprintf-js` chain has no patched release.
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
