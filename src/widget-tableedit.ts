import { html, css, LitElement, PropertyValues } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { property, state, customElement, query } from 'lit/decorators.js'
import { InputData, Values } from './definition-schema.js'

import '@material/web/fab/fab.js'
import '@material/web/icon/icon.js'
import '@material/web/dialog/dialog.js'

import type { MdDialog } from '@material/web/dialog/dialog.js'

type Column = Exclude<InputData['columns'], undefined>[number]
type Theme = {
    theme_name: string
    theme_object: any
}
@customElement('widget-tableedit-versionplaceholder')
export class WidgetTableEdit extends LitElement {
    @property({ type: Object })
    inputData?: InputData

    @property({ type: Object })
    theme?: Theme

    @state()
    rows: Values[] = []

    @state() private themeBgColor?: string
    @state() private themeTitleColor?: string
    @state() private themeSubtitleColor?: string

    @state() dialogOpen: boolean = false

    @query('md-dialog') dialog!: MdDialog

    version: string = 'versionplaceholder'

    update(changedProperties: Map<string, any>) {
        if (changedProperties.has('inputData')) {
            this.transformInputData()
        }

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

    transformInputData() {
        if (!this?.inputData?.columns?.length) return

        const rows: any[][] = []
        this.inputData.columns.forEach((col, i) => {
            col.values?.forEach((v, j) => {
                if (rows.length <= j) rows.push([])
                rows[j].push(v)
            })
        })
        this.rows = rows
    }

    renderCell(cell: any, i: number) {
        const colDef = this?.inputData?.columns?.[i]

        switch (colDef?.type) {
            case 'string':
                return this.renderString(cell.value, colDef)
            case 'number':
                return this.renderNumber(cell.value, colDef)
            case 'boolean':
                return this.renderBoolean(cell.value, colDef)
            case 'state':
                return this.renderState(cell.value, colDef)
            case 'button':
                return this.renderButton(cell, colDef)
            case 'image':
                return this.renderImage(cell, colDef)
        }
    }

    renderString(value: string, colDef: Column) {
        return html`${value}`
    }

    renderNumber(value: number, colDef: Column) {
        if (typeof value !== 'number' || isNaN(value)) return ''
        return html`${value?.toFixed(colDef?.styling?.precision)}`
    }

    renderBoolean(value: any, colDef: Column) {
        return value ? '✓' : '-'
    }

    renderState(value: any, colDef: Column) {
        const _stateMap = colDef.styling?.stateMap
            ?.split(',')
            .map((d: string) => d.trim().replaceAll("'", ''))
        const stateMap = _stateMap?.reduce((p: any, c: string, i: number, a: any[]) => {
            if (i % 2 === 0) p[c] = a[i + 1]
            return p
        }, {})
        return html`<div class="statusbox" style="background-color: ${stateMap[value]}"></div>`
    }

    renderButton(cell: Values[number], colDef: Column) {
        return html`<a href="${cell?.link ?? ''}" target="_blank">${cell.value ?? ''}</a>`
    }

    renderImage(cell: Values[number], colDef: Column) {
        return html`<a href="${cell?.link ?? ''}" target="_blank"><img src="${cell.value ?? ''}" /></a>`
    }

    openFormDialog() {
        this.dialogOpen = true

        import('@material/web/button/text-button.js')
        import('@material/web/textfield/filled-text-field.js')
        import('@material/web/checkbox/checkbox.js')
        import('@material/web/select/filled-select.js')
        import('@material/web/select/select-option.js')
    }

    getTextAlign(colDef: Column) {
        switch (colDef.type) {
            case 'number':
                return 'end'
            case 'button':
            case 'string':
                return 'start'
            case 'boolean':
            case 'state':
            case 'image':
                return 'center'
            default:
                return 'start'
        }
    }

    handleFormSubmit(event: Event) {
        event.preventDefault()
        const form = event.target as HTMLFormElement
        const formData = new FormData(form)
        const data = Object.fromEntries((formData as any).entries())
        this.dispatchEvent(
            new CustomEvent('action-submit', {
                detail: data,
                bubbles: false,
                composed: false
            })
        )
        console.log('submitted form', data)
        form.reset()
        this.dialogOpen = false
    }

    static styles = css`
        :host {
            display: block;
            font-family: sans-serif;
            box-sizing: border-box;
            position: relative;
            margin: auto;
        }

        md-fab {
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
            height: 100%;
            width: 100%;
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

        .tableFixHead {
            overflow-y: auto;
            border-radius: 6px;
        }
        .tableFixHead thead {
            position: sticky;
            top: 0px;
            overflow-x: auto;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        th,
        td {
            padding: 0px 16px;
            box-sizing: border-box;
        }

        .statusbox {
            width: 24px;
            height: 12px;
            margin: auto;
            border-radius: 6px;
        }

        img {
            width: 100%; /* Set the width of the container */
            height: 100%;
            object-fit: contain;
        }

        .no-data {
            font-size: 20px;
            display: flex;
            height: 100%;
            width: 100%;
            text-align: center;
            align-items: center;
            justify-content: center;
        }

        /* The dialog classes */
        .contacts {
            min-width: 80%;
        }

        .contacts [slot='header'] {
            display: flex;
            flex-direction: row-reverse;
            align-items: center;
        }

        .contacts .headline {
            flex: 1;
        }

        .contact-content,
        .contact-row {
            display: flex;
            gap: 8px;
        }

        .contact-content {
            flex-direction: column;
            gap: 24px;
        }

        .contact-row > * {
            flex: 1;
        }

        .checkbox-container {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .label {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        md-filled-select {
            flex: 1;
        }
    `

    render() {
        return html`
            <style>
                ${repeat(
                    this.inputData?.columns ?? [],
                    (col, i) => i,
                    (col, i) => {
                        return `
                            .column-${i} {
                                width: ${col.styling?.width};
                                text-align: ${this.getTextAlign(col)};
                                font-size: ${col.styling?.fontSize};
                                font-weight: ${col.styling?.fontWeight};
                                color: ${col.styling?.color || this.themeSubtitleColor};
                                border: ${col.styling?.border};
                                height: ${this?.inputData?.styling?.rowHeight};
                            }
                            .header-${i} {
                                width: ${col.width};
                                text-align: ${this.getTextAlign(col)};
                                border: ${col.border};
                            }
                            thead {
                                font-size: ${this?.inputData?.styling?.headerFontSize};
                                background: ${this?.inputData?.styling?.headerBackground};
                            }
                            tr {
                                height: ${this?.inputData?.styling?.rowHeight};
                                border-bottom: ${this?.inputData?.styling?.rowBorder ?? '1px solid #ddd'};
                            }
                        `
                    }
                )}
            </style>

            <div
                class="wrapper"
                style="color: ${this.themeTitleColor}; 
                background-color: ${this.themeBgColor}; 
                position: relative;"
            >
                <header>
                    <h3 class="paging" ?active=${this.inputData?.title}>${this.inputData?.title}</h3>
                    <p
                        class="paging"
                        ?active=${this.inputData?.subTitle}
                        style="color: ${this.themeSubtitleColor}"
                    >
                        ${this.inputData?.subTitle}
                    </p>
                </header>
                <div class="tableFixHead" style="${this.rows?.length ? 'height: 100%' : ''}">
                    <table>
                        <thead>
                            <tr>
                                ${repeat(
                                    this.inputData?.columns ?? [],
                                    (col, i) => i,
                                    (col, i) => {
                                        return html` <th class="header-${i}">${col.header}</th> `
                                    }
                                )}
                            </tr>
                        </thead>
                        <tbody class="paging" ?active=${this.rows?.length}>
                            ${repeat(
                                this.rows.reverse() ?? [],
                                (row, idx) => idx,
                                (row) => {
                                    return html` <tr>
                                        ${repeat(
                                            row,
                                            (c, idx) => idx,
                                            (cell, i) => html`
                                                <td class="column-${i}">${this.renderCell(cell, i)}</td>
                                            `
                                        )}
                                    </tr>`
                                }
                            )}
                        </tbody>
                    </table>
                </div>
                <div class="paging no-data" ?active=${!this.rows?.length}>No Data</div>
            </div>

            <md-fab
                aria-label="Add"
                style="--md-fab-container-color: ${this.theme?.theme_object?.color[0]}"
                @click=${this.openFormDialog}
            >
                <md-icon slot="icon">add</md-icon>
            </md-fab>

            <md-dialog
                aria-label="${this.inputData?.formTitle ?? 'Data Entry'}"
                class="contacts"
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
                <div slot="headline">${this.inputData?.formTitle ?? 'Data Entry'}</div>
                <form
                    id="form"
                    slot="content"
                    method="dialog"
                    class="contact-content"
                    @submit=${this.handleFormSubmit}
                >
                    ${repeat(
                        this.inputData?.columns?.filter((col) => col.showInForm) ?? [],
                        (col, i) => i,
                        (col, i) => {
                            return col.type === 'boolean'
                                ? html`<div class="checkbox-container">
                                      <md-checkbox
                                          name="${col.header ?? ''}"
                                          aria-label=${col.header ?? ''}
                                      ></md-checkbox>
                                      <label class="label"> ${col.header} </label>
                                  </div>`
                                : col.type === 'state'
                                  ? html` <label class="label">
                                        ${col.header}
                                        <md-filled-select name="${col.header ?? ''}">
                                            ${repeat(
                                                col.styling?.stateMap
                                                    ?.split(',')
                                                    .filter((s, j) => j % 2 === 0) ?? [],
                                                (state) => state,
                                                (state) => {
                                                    return html`<md-select-option
                                                        value="${state.trim().replaceAll("'", '')}"
                                                        >${state.trim().replaceAll("'", '')}
                                                    </md-select-option>`
                                                }
                                            )}
                                        </md-filled-select>
                                    </label>`
                                  : html`<md-filled-text-field
                                        .name="${col.header ?? `column-${i}`}"
                                        autofocus
                                        .label="${col.header ?? ''}"
                                        .type="${col.type === 'number' ? 'number' : 'text'}"
                                    ></md-filled-text-field>`
                        }
                    )}
                </form>
                <div slot="actions">
                    <md-text-button form="form" value="cancel">Cancel</md-text-button>
                    <md-text-button form="form" value="submit" autofocus>Submit</md-text-button>
                </div>
            </md-dialog>
        `
    }
}
