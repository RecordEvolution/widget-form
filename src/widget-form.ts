import { html, css, LitElement, PropertyValues, nothing } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { keyed } from 'lit/directives/keyed.js'
import { property, state, customElement, query } from 'lit/decorators.js'
import { FormConfiguration } from './definition-schema.js'

import '@material/web/fab/fab.js'
import '@material/web/icon/icon.js'
import '@material/web/dialog/dialog.js'

import '@material/web/button/text-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/checkbox/checkbox.js'
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'

import type { MdDialog } from '@material/web/dialog/dialog.js'

type Column = Exclude<FormConfiguration['formFields'], undefined>[number]
type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-form-versionplaceholder')
export class WidgetForm extends LitElement {
    @property({ type: Object })
    inputData?: FormConfiguration

    @property({ type: Object })
    theme?: Theme

    @property({ type: String })
    route?: string

    @state() private themeBgColor?: string
    @state() private themeTitleColor?: string

    @state() dialogOpen: boolean = false

    @query('md-dialog') dialog!: MdDialog

    @state() private formKey = 0

    // Current value of every field, keyed by field label. Rebuilt on each
    // input/change so conditional-display rules (which reference a controlling
    // field by its label) re-evaluate live as the user fills the form.
    @state() private fieldValues: Record<string, string> = {}

    version: string = 'versionplaceholder'

    update(changedProperties: Map<string, any>) {
        if (changedProperties.has('theme')) {
            this.registerTheme(this.theme)
        }

        super.update(changedProperties)
    }

    protected firstUpdated(_changedProperties: PropertyValues): void {
        this.registerTheme(this.theme)
    }

    protected updated(_changedProperties: PropertyValues): void {
        this.patchDialogScrim()
        this.toggleAttribute('fab-mode', !!this.inputData?.formButton)
    }

    private dialogScrimPatched = false

    /**
     * md-dialog renders its scrim as a `<div class="scrim">` sibling of the
     * native `<dialog>` inside its shadow root, with `position: fixed; z-index: 1`,
     * while disabling the native backdrop (`::backdrop { background: none }`).
     * The `<dialog>` is promoted to the top layer by `showModal()`, but the scrim
     * div stays in the normal layer — confined to this widget's stacking context.
     * As a result it fails to cover sibling dashboard widgets painted in a higher
     * stacking context. We re-enable the native `::backdrop` (which lives in the
     * top layer and spans the whole viewport regardless of ancestor transforms /
     * stacking contexts) and hide the confined internal scrim.
     */
    private patchDialogScrim() {
        if (this.dialogScrimPatched) return
        const root = this.dialog?.shadowRoot
        if (!root) return

        const sheet = new CSSStyleSheet()
        sheet.replaceSync(`
            dialog::backdrop {
                background: var(--md-sys-color-scrim, #000);
                opacity: 0.32;
            }
            .scrim {
                display: none !important;
            }
        `)
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
        this.dialogScrimPatched = true
    }

    registerTheme(theme?: Theme) {
        const cssTextColor = getComputedStyle(this).getPropertyValue('--re-text-color').trim()
        const cssBgColor = getComputedStyle(this).getPropertyValue('--re-tile-background-color').trim()
        this.themeBgColor = cssBgColor || this.theme?.theme_object?.backgroundColor
        this.themeTitleColor = cssTextColor || this.theme?.theme_object?.title?.textStyle?.color
    }

    openFormDialog() {
        this.dialogOpen = true
    }

    handleFormSubmit(event: Event) {
        event.preventDefault()
        const submitter = (event as SubmitEvent).submitter as HTMLElement
        const action = submitter?.getAttribute('value') ?? 'submit'

        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const submitData = this.inputData?.formFields?.map((field, i) => {
            const targetColumn = {
                swarm_app_databackend_key: field.targetColumn?.swarm_app_databackend_key,
                table_name: field.targetColumn?.tablename,
                column_name: field.targetColumn?.column
            }

            // A field hidden by an unmet conditional-display rule is "not
            // applicable": submit null and skip value/default resolution. Its
            // required rule never fired because the element was absent from the DOM.
            if (!field.hiddenField && !this.isFieldVisible(field)) {
                return { ...targetColumn, value: null }
            }

            const rawValue = this.currentRawValue(field, i, formData)
            return { ...targetColumn, value: this.formatValue(rawValue, field.type ?? 'textfield') }
        })

        if (this.inputData?.deleteFlagColumn)
            submitData?.push({
                swarm_app_databackend_key: this.inputData?.deleteFlagColumn?.swarm_app_databackend_key,
                table_name: this.inputData?.deleteFlagColumn?.tablename,
                column_name: this.inputData?.deleteFlagColumn?.column,
                value: action === 'delete'
            })

        this.dispatchEvent(
            new CustomEvent('data-submit', {
                detail: submitData,
                bubbles: false,
                composed: false
            })
        )

        if (action === 'delete') {
            const deleteRoute = this.resolveRoute({
                route: this.inputData?.deleteNavigationRoute,
                variables: this.inputData?.variables
            })
            if (deleteRoute) {
                this.dispatchEvent(
                    new CustomEvent('nav-submit', {
                        detail: { path: String(deleteRoute) },
                        bubbles: true,
                        composed: true
                    })
                )
            }
        }

        this.resetForm()
        this.dialogOpen = false
    }

    // preFilledValue/defaultValue and their *Multiline/*Boolean twins are separate
    // config keys (the editor shows a single-line, multi-line or checkbox input
    // depending on the field type). Resolve by the current type — normalizing the
    // boolean keys to 'true'/'false' strings for the existing downstream logic —
    // and fall back to the single-line key so fields configured before the split
    // keep their values. A value lingering in a hidden twin key after a type
    // switch is ignored.
    effectivePreFilledValue(field: Column): string | undefined {
        if (field.type === 'textarea')
            return (field.preFilledValueMultiline as string | undefined) ?? field.preFilledValue
        if (field.type === 'checkbox')
            return field.preFilledValueBoolean != null
                ? String(field.preFilledValueBoolean)
                : field.preFilledValue
        return field.preFilledValue
    }

    effectiveDefaultValue(field: Column): string | undefined {
        if (field.type === 'textarea')
            return (field.defaultValueMultiline as string | undefined) ?? field.defaultValue
        if (field.type === 'checkbox')
            return field.defaultValueBoolean != null ? String(field.defaultValueBoolean) : field.defaultValue
        return field.defaultValue
    }

    formatValue(value: string, type: string): any {
        switch (type) {
            case 'numberfield': {
                if (value === '' || value === null || value === undefined) return null
                const n = parseFloat(value)
                return Number.isNaN(n) ? null : n
            }
            case 'checkbox':
                return value === 'on' || value === 'true' ? true : false
            default:
                return value
        }
    }

    // Resolve a field's current raw (string) value, applying the same
    // empty-falls-back-to-default rule used at submit so condition evaluation and
    // submission agree. Checkbox is normalized to 'true'/'false' (matching the
    // literals designers use in a condition list); a field absent from the DOM
    // (hidden by its own condition) yields its effective default value.
    currentRawValue(field: Column, i: number, formData: FormData): string {
        const name = `column-${i}`
        if (field.hiddenField)
            return this.effectivePreFilledValue(field) ?? this.effectiveDefaultValue(field) ?? ''
        if (field.type === 'checkbox') return formData.has(name) ? 'true' : 'false'
        const entry = formData.get(name)
        return entry === null || entry === '' ? (this.effectiveDefaultValue(field) ?? '') : String(entry)
    }

    // Rebuild the label→value map on every input/change so conditional-display
    // rules re-evaluate live. A single delegated listener on the <form> catches
    // all field types (Material components bubble input/change within this root).
    handleFieldChange(event: Event) {
        const form = event.currentTarget as HTMLFormElement
        if (!form) return
        const formData = new FormData(form)
        const values: Record<string, string> = {}
        this.inputData?.formFields?.forEach((field, i) => {
            if (field.label) values[field.label] = this.currentRawValue(field, i, formData)
        })
        this.fieldValues = values
    }

    // A field is visible unless it declares a conditional-display rule whose
    // controlling field (referenced by label) does not currently hold one of the
    // listed values. Fail-open on misconfiguration (unknown field / empty list)
    // so a half-configured rule never silently hides a field and its data.
    isFieldVisible(field: Column): boolean {
        const ref = field.conditionalDisplay?.conditionField?.trim()
        if (!ref) return true
        const allowed = (field.conditionalDisplay?.conditionValues ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v !== '')
        if (allowed.length === 0) return true
        const controller = this.inputData?.formFields?.find((f) => f.label === ref)
        if (!controller) return true
        const current =
            this.fieldValues[ref] ??
            this.effectivePreFilledValue(controller) ??
            this.effectiveDefaultValue(controller) ??
            ''
        return allowed.includes(String(current))
    }

    renderTextField(field: Column, i: number) {
        return html`
            <md-outlined-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                .type="${field.type === 'numberfield' ? 'number' : 'text'}"
                .value="${field.preFilledValue ?? ''}"
                .placeholder="${field.defaultValue ?? ''}"
                .pattern="${field.validation ?? ''}"
                supporting-text=${field.description ?? ''}
                validation-message="${field.validationMessage ?? 'Invalid input'}"
                ?required=${field.required && !field.defaultValue && !field.preFilledValue}
            ></md-outlined-text-field>
        `
    }

    renderNumberField(field: Column, i: number) {
        return html`
            <md-outlined-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                style="width: 200px;"
                type="number"
                .value="${field.preFilledValue ?? ''}"
                .placeholder="${field.defaultValue ?? ''}"
                step="any"
                min=${field.min ?? ''}
                max=${field.max ?? ''}
                supporting-text=${field.description ?? ''}
                ?required=${field.required && !field.defaultValue && !field.preFilledValue}
            ></md-outlined-text-field>
        `
    }

    renderCheckbox(field: Column, i: number) {
        const preFilledValue = this.effectivePreFilledValue(field)
        const defaultValue = this.effectiveDefaultValue(field)
        return html`
            <div class="checkbox-container">
                <md-checkbox
                    name="column-${i}"
                    aria-label=${field.label ?? ''}
                    ?checked=${String(preFilledValue ?? defaultValue) === 'true'}
                    supporting-text=${field.description ?? ''}
                    ?required=${field.required && !defaultValue && !preFilledValue}
                ></md-checkbox>
                <label class="label"> ${field.label} </label>
            </div>
        `
    }

    renderTextArea(field: Column, i: number) {
        const preFilledValue = this.effectivePreFilledValue(field)
        const defaultValue = this.effectiveDefaultValue(field)
        return html`
            <md-outlined-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                type="textarea"
                .value="${preFilledValue ?? ''}"
                .placeholder="${defaultValue ?? ''}"
                rows="3"
                ?required=${field.required && !defaultValue && !preFilledValue}
                supporting-text=${field.description ?? ''}
            ></md-outlined-text-field>
        `
    }

    renderDropdown(field: Column, i: number) {
        // Bind the value on the select itself (not just `selected` on the option):
        // md-outlined-select only reports its `value` to the form via ElementInternals,
        // and the declarative `selected` attribute does not reliably sync into it — so
        // a prefilled option would display but submit empty.
        return html`
            <label class="label">
                ${field.label}
                <md-outlined-select
                    name="column-${i}"
                    .value=${field.preFilledValue ?? field.defaultValue ?? ''}
                    supporting-text=${field.description ?? ''}
                    ?required=${field.required && !field.defaultValue && !field.preFilledValue}
                >
                    ${repeat(
                        field.values ?? [],
                        (val) => val.value,
                        (val) => {
                            return html`
                                <md-select-option .value="${val.value ?? ''}">
                                    ${val.displayLabel}
                                </md-select-option>
                            `
                        }
                    )}
                </md-outlined-select>
            </label>
        `
    }

    renderDateTimeField(field: Column, i: number) {
        return html`
            <md-outlined-text-field
                .name="column-${i}"
                style="width: 200px;"
                .label="${field.label ?? ''}"
                type="datetime-local"
                .value="${field.preFilledValue ?? field.defaultValue ?? ''}"
                supporting-text=${field.description ?? ''}
                ?required=${field.required && !field.defaultValue && !field.preFilledValue}
            ></md-outlined-text-field>
        `
    }

    resetForm() {
        this.formKey++
        this.fieldValues = {}
    }

    resolveRoute(item?: any): string | undefined {
        let route: string = item?.route ?? ''
        if (!route) return undefined
        if (item?.variables) {
            for (const variable of item.variables) {
                if (variable.label) {
                    route = route
                        .split(`{{${variable.label}}}`)
                        .join(encodeURIComponent(String(variable.value ?? '')))
                }
            }
        }
        if (route.includes('*')) {
            const currentSegments = (this.route || '').split('/').filter(Boolean)
            const routeSegments = route.split('/').filter(Boolean)
            for (let i = 0; i < routeSegments.length; i++) {
                if (routeSegments[i] === '*') {
                    routeSegments[i] = currentSegments[i] ?? ''
                }
            }
            route = (route.startsWith('/') ? '/' : '') + routeSegments.filter(Boolean).join('/')
        }
        return route
    }

    cancelEdit(event: Event) {
        this.resetForm()
        this.dialogOpen = false
    }

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            font-family: sans-serif;
            box-sizing: border-box;
            position: relative;
            margin: auto;
        }

        /* In fab mode only the floating button is shown, so the widget tile
           itself should never paint a background. !important beats an outer
           tile-background rule (shadow !important wins over the outer tree). */
        :host([fab-mode]) {
            background: transparent !important;
        }

        .paging:not([active]) {
            display: none !important;
        }

        .wrapper {
            display: flex;
            flex-direction: column;
            padding: 16px;
            box-sizing: border-box;
            overflow: auto;
            /* Derive scrollbar colors from the (inherited) text color so they
               follow custom styles and themes — e.g. light thumb on dark bg. */
            scrollbar-width: thin;
            scrollbar-color: color-mix(in srgb, currentColor 35%, transparent) transparent;
        }

        /* WebKit/Blink fallback for browsers without scrollbar-color support. */
        .wrapper::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        .wrapper::-webkit-scrollbar-track {
            background: transparent;
        }

        .wrapper::-webkit-scrollbar-thumb {
            background-color: color-mix(in srgb, currentColor 35%, transparent);
            border-radius: 4px;
        }

        .wrapper::-webkit-scrollbar-thumb:hover {
            background-color: color-mix(in srgb, currentColor 55%, transparent);
        }

        .form-actions {
            display: flex;
            flex-direction: row;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 16px;
        }

        h3 {
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding: 16px 0px 0px 16px;
            box-sizing: border-box;
        }
        p {
            margin: 10px 0 16px 0;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-left: 16px;
            box-sizing: border-box;
        }

        /* The dialog classes */
        .form {
            /* Fields are stacked in a single column, so a wide dialog just
               stretches them unreadably. Cap at a comfortable form width but
               shrink to fit narrow viewports. Height stays content-driven
               (Material's fit-content), capped at 80% of the viewport. */
            width: min(90vw, 480px);
            max-height: 80vh;
        }

        .form [slot='header'] {
            display: flex;
            flex-direction: row-reverse;
            align-items: center;
        }

        .form .headline {
            flex: 1;
        }

        .form-content,
        .form-row {
            display: flex;
            gap: 8px;
        }

        .form-content {
            flex-direction: column;
            gap: 24px;
        }

        .form-row > * {
            flex: 1;
        }

        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .label {
            display: flex;
            flex-direction: column;
        }

        md-outlined-select {
            flex: 1;
        }

        md-dialog {
            overflow: visible;
        }

        .header {
            display: flex;
            align-items: center;
            --md-fab-icon-color: white;
            --md-fab-container-color: #007bff;
            --md-fab-label-text-color: white;
        }

        .delete-btn {
            --md-filled-button-container-color: #d32f2f;
            --md-filled-button-label-text-color: #fff;
            --md-filled-button-hover-label-text-color: #fff;
            --md-filled-button-focus-label-text-color: #fff;
            --md-filled-button-pressed-label-text-color: #fff;
        }
    `

    render() {
        const fontColor = this.themeTitleColor
        const bgColor = this.themeBgColor
        const bgColorOpaque = bgColor?.startsWith('rgba')
            ? bgColor.replace(/rgba\(([^)]+),\s*[\d.]+\)/, 'rgb($1)')
            : bgColor?.startsWith('#') && bgColor.length === 9
              ? bgColor.substring(0, 7) // #RRGGBBAA -> #RRGGBB
              : bgColor?.startsWith('#') && bgColor.length === 5
                ? bgColor.substring(0, 4) // #RGBA -> #RGB
                : bgColor
        return html`
            <style>
                :host {
                    --md-sys-color-on-surface: ${fontColor};
                    --md-sys-color-on-surface-variant: ${fontColor};
                    --md-sys-color-outline: ${fontColor};
                    --md-sys-color-surface-container: ${bgColorOpaque};
                    /* Dialog container and select dropdown panel always use the
                       alpha-stripped color so they stay fully opaque regardless of
                       the theme's (possibly translucent) background. */
                    --md-dialog-container-color: ${bgColorOpaque};
                    --md-menu-container-color: ${bgColorOpaque};
                    --md-menu-item-selected-container-color: ${bgColorOpaque};
                    --md-menu-item-selected-label-text-color: ${fontColor};
                    color: ${fontColor};
                }
            </style>
            <div class="header">
                ${this.inputData?.formButton
                    ? html`
                          <md-fab
                              aria-label="Add"
                              .size=${this.inputData.formButtonStyle?.size || 'medium'}
                              style="margin: 8px; --md-fab-container-color: ${(this.inputData.formButtonStyle
                                  ?.bgColor ||
                                  this.theme?.theme_object?.color?.[0]) ??
                              '#9064f7'}; --md-fab-icon-color: ${(this.inputData.formButtonStyle?.color ||
                                  this.theme?.theme_object?.color?.[1]) ??
                              '#fff'}"
                              @click=${this.openFormDialog}
                          >
                              <md-icon slot="icon">add</md-icon>
                          </md-fab>
                      `
                    : nothing}
                ${!this.inputData?.formButton
                    ? html`
                          <header>
                              <h3 class="paging" ?active=${this.inputData?.title}>
                                  ${this.inputData?.title}
                              </h3>
                              <p class="paging" ?active=${this.inputData?.subTitle}>
                                  ${this.inputData?.subTitle}
                              </p>
                          </header>
                      `
                    : nothing}
            </div>
            ${!this.inputData?.formButton
                ? html`
                      <div class="wrapper">
                          ${this.renderForm()}
                          <div class="form-actions">
                              ${this.inputData?.deleteButton
                                  ? html`<md-filled-button
                                        class="delete-btn"
                                        form="form"
                                        value="delete"
                                        type="submit"
                                        >Delete</md-filled-button
                                    >`
                                  : nothing}
                              <md-outlined-button @click=${this.resetForm}>Reset</md-outlined-button>
                              <md-filled-button form="form" value="submit" type="submit" autofocus
                                  >Submit</md-filled-button
                              >
                          </div>
                      </div>
                  `
                : html`
                      <md-dialog
                          aria-label="${this.inputData?.title ?? 'Data Entry'}"
                          class="form"
                          quick
                          ?open=${this.dialogOpen}
                          @cancel=${(event: any) => {
                              event.preventDefault()
                          }}
                          @keydown=${(event: any) => {
                              if (event.key === 'Escape') event.preventDefault()
                          }}
                          @closed=${() => (this.dialogOpen = false)}
                      >
                          <div slot="headline">${this.inputData?.title ?? 'Data Entry'}</div>
                          ${this.renderForm()}
                          <div slot="actions">
                              ${this.inputData?.deleteButton
                                  ? html`<md-filled-button
                                        class="delete-btn"
                                        form="form"
                                        value="delete"
                                        type="submit"
                                        >Delete</md-filled-button
                                    >`
                                  : nothing}
                              <md-outlined-button @click=${this.resetForm}>Reset</md-outlined-button>
                              <md-outlined-button @click=${this.cancelEdit}>Cancel</md-outlined-button>
                              <md-filled-button form="form" value="submit" type="submit" autofocus
                                  >Submit</md-filled-button
                              >
                          </div>
                      </md-dialog>
                  `}
        `
    }

    renderForm() {
        return keyed(
            this.formKey,
            html`
                <form
                    id="form"
                    slot="content"
                    method="dialog"
                    class="form-content"
                    @submit=${this.handleFormSubmit}
                    @input=${this.handleFieldChange}
                    @change=${this.handleFieldChange}
                >
                    ${repeat(
                        this.inputData?.formFields ?? [],
                        (field, i) => i,
                        (field, i) => {
                            if (field.hiddenField) return nothing
                            if (!this.isFieldVisible(field)) return nothing
                            switch (field.type) {
                                case 'textfield':
                                    return this.renderTextField(field, i)
                                case 'numberfield':
                                    return this.renderNumberField(field, i)
                                case 'datetime':
                                    return this.renderDateTimeField(field, i)
                                case 'textarea':
                                    return this.renderTextArea(field, i)
                                case 'dropdown':
                                    return this.renderDropdown(field, i)
                                case 'checkbox':
                                    return this.renderCheckbox(field, i)
                            }
                        }
                    )}
                </form>
            `
        )
    }
}
