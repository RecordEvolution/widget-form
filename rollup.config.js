import replace from '@rollup/plugin-replace'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import babel from '@rollup/plugin-babel'
import { readFileSync } from 'fs'
const npmPackage = JSON.parse(readFileSync('./package.json'))

export default {
    // if you use createSpaConfig, you can use your index.html as entrypoint,
    // any <script type="module"> inside will be bundled by rollup
    input: './src/widget-tableedit.ts',
    output: {
        dir: './dist',
        sourcemap: true,
        name: 'widget_tableedit_bundle',
        banner: `/* @license Copyright (c) 2025 Ironflock GmbH. All rights reserved.*/`,
        format: 'esm'
    },
    external: (id) => id.startsWith('@material/web/'),
    plugins: [
        replace({
            versionplaceholder: npmPackage.version,
            preventAssignment: true
        }),
        typescript({ sourceMap: true }),
        nodeResolve({ browser: true }),
        commonjs({}),
        babel({ babelHelpers: 'bundled' })
    ]

    // alternatively, you can use your JS as entrypoint for rollup and
    // optionally set a HTML template manually
    // input: './app.js',
}
