#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

// Path to your @material/web folder
const MATERIAL_WEB_DIR = 'node_modules/@material/web'

function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
            walkDir(fullPath)
        } else if (entry.isFile()) {
            // Replace content
            const content = fs.readFileSync(fullPath, 'utf8')
            let newContent = content.replace(/md-focus-ring\.js/g, 'focus-ring.js')
            newContent = newContent.replace(/md-focus-ring\.ts/g, 'focus-ring.ts')
            newContent = newContent.replace(/md-focus-ring\.css/g, 'focus-ring.css')
            newContent = newContent.replace(/md-typescale-styles\.js/g, 'typescale-styles.js')
            newContent = newContent.replace(/md-typescale-styles\.ts/g, 'typescale-styles.ts')
            newContent = newContent.replace(/md-typescale-styles\.css/g, 'typescale-styles.css')
            newContent = newContent.replace(/md-/g, 'mdif1-')
            fs.writeFileSync(fullPath, newContent, 'utf8')

            // Rename file if starts with md-
            if (entry.name.startsWith('md-')) {
                const newName = entry.name.replace(/^md-/, '')
                const newFullPath = path.join(currentPath, newName)
                fs.renameSync(fullPath, newFullPath)
                console.log(`Renamed file: ${fullPath} → ${newFullPath}`)
            }
        }
    }
}

console.log(`Processing ${MATERIAL_WEB_DIR} ...`)
walkDir(MATERIAL_WEB_DIR)
console.log('Done!')
