import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import replace from '@rollup/plugin-replace'
import dts from 'vite-plugin-dts'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
    server: {
        open: '/demo/',
        port: 8000
    },
    optimizeDeps: {
        include: [
            '@material/web/fab/fab.js',
            '@material/web/icon/icon.js',
            '@material/web/dialog/dialog.js',
            '@material/web/button/text-button.js',
            '@material/web/button/outlined-button.js',
            '@material/web/button/filled-button.js',
            '@material/web/textfield/outlined-text-field.js',
            '@material/web/checkbox/checkbox.js',
            '@material/web/select/outlined-select.js',
            '@material/web/select/select-option.js'
        ]
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify('production')
    },
    resolve: {
        alias: {
            tslib: 'tslib/tslib.es6.js'
        },
        conditions: ['browser']
    },
    plugins: [
        replace({
            versionplaceholder: pkg.version,
            preventAssignment: true
        }),
        dts({
            rollupTypes: true,
            tsconfigPath: './tsconfig.json'
        })
    ],
    build: {
        lib: {
            entry: 'src/widget-form.ts',
            formats: ['es'],
            fileName: 'widget-form'
        },
        sourcemap: true,
        rollupOptions: {
            external: [/^@material\/web/, /^lit-flatpickr/],
            output: {
                banner: '/* @license Copyright (c) 2025 Ironflock GmbH. All rights reserved.*/'
            }
        }
    }
})
