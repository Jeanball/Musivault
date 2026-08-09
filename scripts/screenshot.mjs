#!/usr/bin/env node
/**
 * Interactive screenshot capture with a locked viewport.
 *
 * Opens a real Chromium window sized to a fixed profile, then waits for you to
 * navigate the app by hand. Type a name in the terminal and the current
 * viewport is saved to docs/screenshots/<profile>/<name>.png at exactly the
 * profile dimensions, no matter how the OS window has been resized.
 *
 *   node scripts/screenshot.mjs [desktop|mobile] [url]
 */

import { chromium } from '@playwright/test'
import { mkdir, readdir } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_URL = 'http://localhost:5173'

const PROFILES = {
  desktop: {
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1, // -> 1600x1000, twice the 800px the README renders at
    isMobile: false,
    hasTouch: false,
  },
  mobile: {
    // iPhone 14 / 15
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1.5, // -> 585x1266
    isMobile: true,
    hasTouch: true,
  },
}

// Hides transient UI that would otherwise leak into a capture.
const HIDE_CSS = `
  .Toastify, .Toastify__toast-container { display: none !important; }
  *:focus, *:focus-visible { outline: none !important; }
  * { caret-color: transparent !important; }
`

const [profileName = 'desktop', url = DEFAULT_URL] = process.argv.slice(2)
const profile = PROFILES[profileName]

if (!profile) {
  console.error(`Unknown profile "${profileName}". Use: ${Object.keys(PROFILES).join(' | ')}`)
  process.exit(1)
}

const outDir = join(ROOT, 'docs', 'screenshots', profileName)
await mkdir(outDir, { recursive: true })

const { width, height } = profile.viewport
const scale = profile.deviceScaleFactor

console.log(`\nProfile : ${profileName}`)
console.log(`Viewport: ${width}x${height} @${scale}x  ->  PNG ${width * scale}x${height * scale}`)
console.log(`Output  : docs/screenshots/${profileName}/`)
console.log(`URL     : ${url}\n`)

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext(profile)
const page = await context.newPage()

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
} catch {
  console.log(`Could not reach ${url} (is "npm run dev" running?). Navigate manually.\n`)
}

console.log('Commands:')
console.log('  <name>   capture the current viewport as <name>.png')
console.log('  <empty>  re-capture under the previous name')
console.log('  !hide    toggle hiding of toasts and focus rings')
console.log('  !ls      list the files already in the output folder')
console.log('  q        quit\n')

const rl = createInterface({ input: process.stdin, output: process.stdout })
let lastName = null
let hidden = true

const quit = async () => {
  rl.close()
  await context.close()
  await browser.close()
}

// A closed browser window should end the session too.
page.on('close', () => {
  console.log('\nBrowser closed.')
  quit().finally(() => process.exit(0))
})

while (true) {
  let answer
  try {
    answer = (await rl.question(`${profileName}> `)).trim()
  } catch {
    break // readline closed (browser window gone, Ctrl+D)
  }

  if (answer === 'q' || answer === 'quit') break

  if (answer === '!ls') {
    const files = (await readdir(outDir)).filter((f) => f.endsWith('.png')).sort()
    console.log(files.length ? files.map((f) => `  ${f}`).join('\n') : '  (empty)')
    continue
  }

  if (answer === '!hide') {
    hidden = !hidden
    console.log(hidden ? '  hiding on (toasts, focus rings, carets)' : '  hiding off')
    continue
  }

  const name = (answer || lastName || '').replace(/\.png$/i, '')
  if (!name) {
    console.log('  Type a file name first.')
    continue
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) {
    console.log('  Use a simple kebab-case name, e.g. collection-dashboard')
    continue
  }

  const path = join(outDir, `${name}.png`)
  // The style tag is re-added each time: a navigation drops the previous one.
  const hideTag = hidden ? await page.addStyleTag({ content: HIDE_CSS }).catch(() => null) : null
  try {
    await page.screenshot({ path }) // viewport only, never fullPage
    lastName = name
    console.log(`  saved docs/screenshots/${profileName}/${name}.png (${width * scale}x${height * scale})`)
  } catch (err) {
    console.log(`  capture failed: ${err.message}`)
  } finally {
    await hideTag?.evaluate((node) => node.remove()).catch(() => {})
  }
}

await quit()
