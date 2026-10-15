# widget-form

A Lit 3.x web component for creating dynamic forms with configurable fields. Part of the IronFlock widget ecosystem.

![screenshot](thumbnail.png)

## Installation

```bash
npm i @ironflock/widget-form
```

## Usage

```html
<script type="module">
    import '@ironflock/widget-form'
</script>

<widget-form-1.0.9></widget-form-1.0.9>
```

> **Note:** The version number is part of the custom element tag name.

## Properties

| Property    | Type        | Description                   |
| ----------- | ----------- | ----------------------------- |
| `inputData` | `FormConfiguration` | Form configuration and fields |
| `theme`     | `Theme`     | Theme object for styling      |

## Events

| Event         | Detail                        | Description                      |
| ------------- | ----------------------------- | -------------------------------- |
| `data-submit` | Array of field/value mappings | Fired when the form is submitted |

## Configuration

The form is configured via the `inputData` property:

```ts
interface FormConfiguration {
    title?: string
    subTitle?: string
    formButton?: boolean // Show button to open form dialog
    formDialogSize?: FormDialogSize // Minimum size of that dialog
    formFields?: FormField[]
}
```

### Dialog Size

With `formButton: true` the form opens in a dialog that is 480px wide (narrower on small screens) and as tall as its fields, up to 80% of the window height. `formDialogSize` sets the dialog's minimum width and height:

```ts
interface FormDialogSize {
    minWidth?: string // e.g. '800px', '60%', '50vw'
    minHeight?: string // e.g. '600px', '70%', '90vh'
}
```

Each value is a number with an optional unit: `px` (assumed when there is none), `%` or `vw`/`vh` for a share of the window, `rem` or `em`. Empty keeps the default. A value replaces Material's own 280×140px minimum and is capped at the window less 24px on each side, so the dialog and its Submit button always stay on screen; a form taller than that scrolls inside the dialog. On an ordinary window a value below the default size therefore changes nothing, while on a window narrower than 328px (or a very short one) any value, even a large one, lets the dialog shrink a little below Material's minimum to keep those margins. Anything else, such as `auto`, `calc()` or a negative number, is ignored with a console warning.

### Field Types

Each form field supports the following types:

| Type          | Description                    |
| ------------- | ------------------------------ |
| `textfield`   | Single-line text input         |
| `numberfield` | Numeric input with min/max     |
| `checkbox`    | Boolean checkbox               |
| `textarea`    | Multi-line text input          |
| `dropdown`    | Select from predefined options |
| `datetime`    | Date/time picker               |

### Field Configuration

```ts
interface FormField {
    label: string
    type: 'dropdown' | 'textfield' | 'numberfield' | 'checkbox' | 'textarea' | 'datetime'
    hiddenField?: boolean // Hide field but still submit value
    required?: boolean // Field must be filled
    description?: string // Hint text shown below field
    targetColumn?: TargetColumn // Database column mapping
    defaultValue?: string
    min?: number // For numberfield
    max?: number // For numberfield
    validation?: string // Regex for textfield
    values?: DropdownValue[] // For dropdown type
}
```

## Development

```bash
# Start dev server
npm run start

# Build for production
npm run build

# Generate types from schema
npm run types

# Build, bump version, and publish
npm run release
```

## License

MIT
