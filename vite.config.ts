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
        include: ['@material/web/**/*']
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
