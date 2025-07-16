import { html, css, LitElement, PropertyValues, nothing } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { property, state, customElement, query } from 'lit/decorators.js'
import { InputData, FormFields } from './definition-schema.js'

import '@material/web/fab/fab.js'
import '@material/web/icon/icon.js'
import '@material/web/dialog/dialog.js'

import '@material/web/button/text-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/filled-button.js'
import '@material/web/textfield/filled-text-field.js'
import '@material/web/checkbox/checkbox.js'
import '@material/web/select/filled-select.js'
import '@material/web/select/select-option.js'
// import 'lit-flatpickr'

import type { MdDialog } from '@material/web/dialog/dialog.js'

type Column = Exclude<InputData['formFields'], undefined>[number]
type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-form-versionplaceholder')
export class WidgetForm extends LitElement {
    @property({ type: Object })
    inputData?: InputData

    @property({ type: Object })
    theme?: Theme

    @state() private themeBgColor?: string
    @state() private themeTitleColor?: string
    @state() private themeSubtitleColor?: string

    @state() dialogOpen: boolean = false

    @query('md-dialog') dialog!: MdDialog

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

    registerTheme(theme?: Theme) {
        const cssTextColor = getComputedStyle(this).getPropertyValue('--re-text-color').trim()
        const cssBgColor = getComputedStyle(this).getPropertyValue('--re-tile-background-color').trim()
        this.themeBgColor = cssBgColor || this.theme?.theme_object?.backgroundColor
        this.themeTitleColor = cssTextColor || this.theme?.theme_object?.title?.textStyle?.color
        this.themeSubtitleColor =
            cssTextColor || this.theme?.theme_object?.title?.subtextStyle?.color || this.themeTitleColor
    }

    openFormDialog() {
        this.dialogOpen = true
    }

    handleFormSubmit(event: Event) {
        event.preventDefault()
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const data = Object.fromEntries((formData as any).entries())

        const submitData = this.inputData?.formFields?.map((field, i) => {
            return {
                swarm_app_databackend_key: field.targetColumn?.swarm_app_databackend_key,
                table_name: field.targetColumn?.tablename,
                column_name: field.targetColumn?.column,
                value: this.formatValue(
                    data[`column-${i}`] || field.defaultValue || '',
                    field.type ?? 'textfield'
                )
            }
        })
        this.dispatchEvent(
            new CustomEvent('data-submit', {
                detail: submitData,
                bubbles: false,
                composed: false
            })
        )
        form.reset()
        this.dialogOpen = false
    }

    formatValue(value: string, type: string): any {
        switch (type) {
            case 'numberfield':
                return parseFloat(value)
            case 'checkbox':
                return value === 'on' ? true : false
            default:
                return value
        }
    }

    renderTextField(field: Column, i: number) {
        return html`
            <md-filled-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                .type="${field.type === 'numberfield' ? 'number' : 'text'}"
                .placeholder="${field.defaultValue ?? ''}"
                .pattern="${field.validation ?? ''}"
                supporting-text=${field.description ?? ''}
                validation-message="${field.validationMessage ?? 'Invalid input'}"
                ?required=${field.required && !field.defaultValue}
            ></md-filled-text-field>
        `
    }

    renderNumberField(field: Column, i: number) {
        return html`
            <md-filled-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                style="width: 200px;"
                type="number"
                .placeholder="${field.defaultValue ?? ''}"
                step="any"
                min=${field.min ?? ''}
                max=${field.max ?? ''}
                supporting-text=${field.description ?? ''}
                ?required=${field.required && !field.defaultValue}
            ></md-filled-text-field>
        `
    }

    renderCheckbox(field: Column, i: number) {
        return html`
            <div class="checkbox-container">
                <md-checkbox
                    name="column-${i}"
                    aria-label=${field.label ?? ''}
                    ?checked=${field.defaultValue === 'true'}
                    supporting-text=${field.description ?? ''}
                    ?required=${field.required && !field.defaultValue}
                ></md-checkbox>
                <label class="label"> ${field.label} </label>
            </div>
        `
    }

    renderTextArea(field: Column, i: number) {
        return html`
            <md-filled-text-field
                .name="column-${i}"
                .label="${field.label ?? ''}"
                type="textarea"
                .placeholder="${field.defaultValue ?? ''}"
                rows="3"
                ?required=${field.required && !field.defaultValue}
                supporting-text=${field.description ?? ''}
            ></md-filled-text-field>
        `
    }

    renderDropdown(field: Column, i: number) {
        return html`
            <label class="label">
                ${field.label}
                <md-filled-select
                    name="column-${i}"
                    supporting-text=${field.description ?? ''}
                    ?required=${field.required && !field.defaultValue}
                >
                    ${repeat(
                        field.values ?? [],
                        (val) => val.value,
                        (val) => {
                            return html`
                                <md-select-option
                                    .value="${val.value ?? ''}"
                                    ?selected="${val.value === field.defaultValue}"
                                >
                                    ${val.displayLabel}
                                </md-select-option>
                            `
                        }
                    )}
                </md-filled-select>
            </label>
        `
    }

    renderDateTimeField(field: Column, i: number) {
        // return html`
        //     <label id="x" class="label"> ${field.label} </label>
        //     <lit-flatpickr
        //         .name="column-${i}"
        //         .label="${field.label ?? ''}"
        //         allowInput
        //         enableTime
        //         mode="single"
        //         dateFormat="Y-m-d H:i:S"
        //         altFormat="Y-m-d H:i:S"
        //         time_24hr
        //         .defaultDate="${field.defaultValue}"
        //         showMonths="1"
        //         weekNumbers
        //     >
        //         <input />
        //     </lit-flatpickr>
        // `

        return html`
            <md-filled-text-field
                .name="column-${i}"
                style="width: 200px;"
                .label="${field.label ?? ''}"
                type="datetime-local"
                .value="${field.defaultValue ?? ''}"
                supporting-text=${field.description ?? ''}
                ?required=${field.required && !field.defaultValue}
            ></md-filled-text-field>
        `
    }

    cancelEdit(event: Event) {
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

        .edit-fab {
            --md-fab-icon-color: white;
            --md-fab-container-color: #007bff;
            --md-fab-label-text-color: white;
            position: absolute;
            bottom: 24px;
            right: 24px;
            z-index: 10;
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
            min-width: 80%;
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

        md-filled-select {
            flex: 1;
        }

        md-dialog {
            overflow: visible;
        }

        lit-flatpickr {
            z-index: 1000;
        }

        .header {
            display: flex;
            align-items: center;
            --md-fab-icon-color: white;
            --md-fab-container-color: #007bff;
            --md-fab-label-text-color: white;
        }
    `

    render() {
        return html`
            <div class="header">
                ${this.inputData?.formButton
                    ? html`
                          <md-fab
                              aria-label="Add"
                              style="margin-left: 16px; --md-fab-container-color: ${this.theme?.theme_object
                                  ?.color[0] ?? '#9064f7'}"
                              @click=${this.openFormDialog}
                          >
                              <md-icon slot="icon">add</md-icon>
                          </md-fab>
                      `
                    : nothing}
                <header>
                    <h3 class="paging" ?active=${this.inputData?.title}>${this.inputData?.title}</h3>
                    <p class="paging" ?active=${this.inputData?.subTitle}>${this.inputData?.subTitle}</p>
                </header>
            </div>
            ${!this.inputData?.formButton
                ? html`
                      <div class="wrapper">
                          ${this.renderForm()}
                          <div class="form-actions">
                              <md-outlined-button form="form" value="cancel" type="reset"
                                  >Reset</md-outlined-button
                              >
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
                              <md-outlined-button form="form" value="cancel" type="reset"
                                  >Cancel</md-outlined-button
                              >
                              <md-filled-button form="form" value="submit" type="submit" autofocus
                                  >Submit</md-filled-button
                              >
                          </div>
                      </md-dialog>
                  `}
        `
    }

    renderForm() {
        return html`
            <form
                id="form"
                slot="content"
                method="dialog"
                class="form-content"
                @submit=${this.handleFormSubmit}
                @reset=${this.cancelEdit}
            >
                ${repeat(
                    this.inputData?.formFields?.filter((field) => !field.hiddenField) ?? [],
                    (field, i) => i,
                    (field, i) => {
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
    }
}
