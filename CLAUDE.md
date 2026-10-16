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
- Outputs: dispatches `data-submit` (non-bubbling) with an array of `{ swarm_app_databackend_key, table_name, column_name, value }` mappings — one entry per `formField` plus an extra entry for `deleteFlagColumn` when present. On delete it additionally dispatches a bubbling/composed `nav-submit` event with the resolved route. A save with a new file dispatches `file-data-submit` instead (see File fields).
- Each field's `targetColumn` (type `targetColumn` in the schema) is the platform's database column picker; the host wires its value, and submission carries the same identifiers back so the host can persist data.
- Theming: reads `--re-text-color` and `--re-tile-background-color` CSS variables first, then falls back to `theme.theme_object`. Material Web tokens (`--md-sys-color-*`, `--md-menu-*`) are then re-derived from those values inside `render()`. These are not snapshotted: `registerTheme()` stores a `var(--re-…, <theme value>)` chain, so a change to the host property repaints the tile live without the widget being told. The dialog and select menus (`--md-dialog-container-color`, `--md-menu-*`, `--md-sys-color-surface-container`) need an opaque surface, and `--re-text-color` is picked to read on the tile as displayed, so `surfaceColor()` composites the tile colour over the dashboard's `--re-background-color` over white (the dashboard view's own colour). With no dashboard background (standalone, the demo) the theme background stands in for it. Studio 3.5.7 and earlier painted `--re-background-color` twice under the tiles (on `<main>` and again on `dashboard-navigator`), so there a translucent dashboard colour stacked up on screen and the surface came out slightly lighter than the tile; later studios paint it once, which is exactly what `surfaceColor()` models. It reads the variables in `render()`, because a `var()` chain cannot be composited in JS, and `opaqueSurface()` caches the `#rrggbb` result by the input strings. The browser parses each colour through a canvas `fillStyle`, and a value it rejects counts as transparent, as it does on the tile (rejection is detected by setting the value after two different placeholders, because a rejected value leaves the previous one in place). The blend itself is plain source-over in JS. Never read canvas pixels for it: under Firefox's `resistFingerprinting`, which Tor Browser turns on, `getImageData()` returns random colours. What floats above the tile is raised on a dark surface: `raisedSurface()` paints white at 16% (`RAISE_ON_DARK`) over a surface whose WCAG luminance is below 0.18 (`DARK_SURFACE`, about mid grey) and that colour fills `--md-dialog-container-color` and the `--md-menu-*` colours, while the scrim deepens from Material's 0.32 to 0.6 (`SCRIM_OPACITY_*`). A dark page barely changes under a 32% scrim, so a dialog in the tile's own colour sank into it (a popup form on a transparent tile over a dark dashboard is that colour exactly); Material 3 shows elevation in dark schemes by lightening a surface, and a shadow does not show on a dark page. Light surfaces keep the tile colour and the 0.32 scrim. `patchDialogScrim()` writes the opacity into the sheet it adopts into md-dialog's shadow root and rewrites it when the surface turns dark or light, because older browsers do not let `::backdrop` inherit custom properties.
- Form rendering uses Material Web (`@material/web` is a peer dependency, externalized in the rollup output). Inline mode renders fields directly; `formButton` mode renders a FAB that opens an `md-dialog`; its icon is the Material icon named by `formButtonStyle.iconName` (a ligature in the Material Symbols font Studio loads, as in widget-sidenav), `add` when that is blank or not a string, and its `aria-label` is the form title, else "Open form". `formKey` is incremented to force a full re-render on reset. A dropdown's caption is a `div`, never a `<label>` wrapping the select: the label would send the select a second click, which in Firefox closes the menu the first click opened. Reset and Cancel (`md-outlined-button`) take the text colour, because Material's fixed purple primary does not read on a dark surface. Both action rows wrap, so a narrow window cannot clip the leftmost buttons.
- Dialog size (`formButton` mode): `.form` gives the dialog `width: min(90vw, 480px); max-height: 80vh` on top of md-dialog's `:host` `min-width: 280px; min-height: 140px; max-width`/`max-height: min(560px, calc(100% - 48px))`, which the native `<dialog>` inherits through the `display: contents` host. `formDialogSize.minWidth`/`minHeight` go through `dialogMinSize()` and land in md-dialog's `style` attribute as `min-*: min(<value>, calc(100% - 48px))`. That replaces md-dialog's 280x140px floor outright (a smaller value, 0 included, lowers it, and below a 328px-wide window any value lets the dialog shrink to the cap) and beats `.form` and md-dialog's `max-*` whenever it is larger; with neither set there is no `style` attribute. `%` is a share of the window because `showModal()` puts the dialog in the top layer. Keep the cap: the dialog swallows Escape and backdrop clicks, so its action bar is the only way out, and an uncapped minimum pushes it off the screen. Keep the grammar strict too (`DIALOG_MIN_SIZE`: a number plus an optional px, %, vw, vh, rem or em; no unit means px; empty or unset keeps the default, while 0 is a real minimum like any other value; anything else warns once and is ignored). `CSS.supports()` is no substitute: it accepts `800px/*`, whose comment swallows the cap and every declaration after it. The schema `pattern` on both leaves spells the same grammar (lowercase units only, and an explicit ASCII whitespace class, because the AI checks it with Python's `re`, whose `\s` also matches U+001C-U+001F and U+0085) so the AI's `validate_widget` rejects what the widget would ignore; change them together.
- Hidden fields (`hiddenField: true`) submit via `<input type="hidden">`; checkbox values are normalized to `'on'`/`'off'` then to booleans in `formatValue`.
- Highlight colour: `render()` sets Material's `--md-sys-color-primary` (the focused field's outline and label, checked checkboxes, the Submit button) and `--md-focus-ring-color` from `accentColors()`, in place of Material's fixed purple, which did not read on every tile. `accentColor` from the config is taken as written; unset, the theme's first palette colour is used when it has at least 3:1 WCAG contrast (`ACCENT_CONTRAST`) against the surface the fields sit on (the raised dialog in `formButton` mode, else the tile); otherwise the text colour. `--md-sys-color-on-primary` is black or white, whichever contrasts more, and the surface itself on the text colour.
- Error colour: `render()` sets `--md-sys-color-error` from the surface, Material's light-scheme `#b3261e` or, on a dark surface (`isDarkSurface()`), its dark-scheme `#f2b8b5`; the light red does not read on a dark tile or dialog. It covers the text fields' own error states too.

### File fields

A `file` field uploads one file into a FleetFiles namespace of the target table's app and writes the stored object's key into `targetColumn`. The widget never uploads: Studio does (widget-item `handleFileDataSubmit`, module `fleetfiles-upload.ts`).

- **Its own event.** A save that carries a new file dispatches `file-data-submit`, never `data-submit`: an older Studio would serialize the `File` as `{}` into the column. The detail is `{ items, waitUntil }`; items are data-submit items plus file items `{ swarm_app_databackend_key, table_name, column_name, file, namespace, contentType }`. The host claims the event by calling `waitUntil(promise)` during the dispatch; unclaimed (an older Studio, which ignores unknown events) means no host can upload, and the form says so and saves nothing (`submitWithFiles`). While the promise is pending the actions are disabled and Submit reads "Saving…"; a resolve resets the form and closes the dialog, a reject keeps everything and shows `error.message` in `.form-error` (Studio's messages are localized and say whether anything was saved). Keep `FileDataSubmitDetail` and Studio's `handleFileDataSubmit` in step.
- **The dialog stays open** for it: md-dialog closes on every `method="dialog"` submit that bubbles to it, whatever `preventDefault()` says, so `handleFormSubmit` stops propagation on the file path. The plain `data-submit` path still closes at once, as before.
- **Keep, never null.** `fileFieldItems()`: a new file → the file item plus the name, size and type companion columns (`fileNameColumn`, `fileSizeColumn`, `fileTypeColumn`); no new file → the pre-filled key written back, or, with none, the column left out (fleetdb carries an absent column over on entity tables and leaves it NULL otherwise; an explicit null would clear it). Companions are only written with a new file. Delete never uploads. A field hidden by Conditional Display submits null with its companions, like every other field.
- **The control** is a drop zone with a transparent native `<input type="file">` stretched over it (`.file-input`): the input takes clicks, keyboard focus and drops itself, and its `required` and the browser's message are anchored on the box. It has no `name`, so FormData never carries the file; the chosen `File` lives in `chosenFiles` (by field index), which survives the frequent new `inputData` objects, is cleared by reset, and is pruned in `willUpdate()` when a condition hides the field (its input is gone). A refused file is cleared from the input, or it would satisfy `required`. The clear button is an `md-icon-button type="button"` above the input (`z-index`); its default `type` is submit. Over a disabled input, the box swallows drops, or the browser would open the file in place of the board.
- **Types.** `acceptedFileTypes` entries are MIME types (`type/*` allowed), lowercased; other entries are dropped with a warning. FleetFiles matches content types case-sensitively, without parameters, with only a trailing `/*` as a wildcard, and turns an empty type into `application/octet-stream`, so `fileContentType()` sends the browser's type (lowercased, parameters cut) when it is accepted, else the type the extension stands for (`EXTENSION_TYPES`): Windows with Excel calls a CSV `application/vnd.ms-excel`, and unknown extensions come as `''`. The `accept` attribute lists the matching extensions too, so the system picker offers those files. The schema `pattern` spells the same grammar for the AI.
- **Sizes.** `maxFileSizeMB` counts 1,048,576 bytes per MB, like `formatBytes()`. FleetFiles takes up to 6 MiB in one call; above that Studio needs a presigned URL, which appliances cannot issue, and the namespace's `maxObjectBytes` applies everywhere. Studio checks both and says which limit a file broke.
- **The key** is Studio's choice: `<YYYY-MM-DD>/<random>/<file name>`, whose last segment is the sanitized original name (apps such as LineOps read the name and extension from it, and the form shows it for a pre-filled key).
- `default-data.json` has no file field and must not get one: Studio's editor fills each existing form's fields from the default config's field at the same index (a known Studio bug), and a target column only exists in a running project. The demo adds file fields itself, and has `?oldhost` (no handler for `file-data-submit`), `?dialog` and `?theme=chalk|vintage` switches; its stand-in host refuses files whose name contains "fail".

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
