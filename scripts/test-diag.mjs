#!/usr/bin/env node
/**
 * Deep diagnostic — capture ALL browser console messages + network failures
 * to find what's breaking the page on the user's browser
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/z/my-project/download'

const allConsole = []
const allNetwork = []
const pageErrors = []
const requestFailures = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

page.on('console', (msg) => {
  allConsole.push({ type: msg.type(), text: msg.text() })
})
page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('requestfailed', (req) => {
  requestFailures.push({
    url: req.url(),
    failure: req.failure()?.errorText,
    method: req.method(),
  })
})
page.on('response', (res) => {
  if (res.status() >= 400) {
    allNetwork.push({ url: res.url(), status: res.status() })
  }
})

console.log('=== Step 1: Open / WITHOUT login (what user sees first) ===')
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-01-no-login.png`, fullPage: false })
const title1 = await page.title()
console.log('Page title:', title1)
const body1 = await page.evaluate(() => document.body.innerText.slice(0, 500))
console.log('Body text (first 500 chars):')
console.log(body1)

console.log('\n=== Step 2: Login as admin ===')
try {
  await page.fill('input[type=email]', 'admin@activeasset.local')
  await page.fill('input[type=password]', 'admin123')
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ])
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-02-after-login.png`, fullPage: false })
  const body2 = await page.evaluate(() => document.body.innerText.slice(0, 500))
  console.log('Body after login (first 500 chars):')
  console.log(body2)
} catch (e) {
  console.log('Login step error:', e.message)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-02-login-error.png`, fullPage: false })
}

console.log('\n=== Step 3: Check vz-banner present ===')
const bannerCount = await page.locator('.vz-banner').count()
console.log('.vz-banner count:', bannerCount)
const cardCount = await page.locator('.vz-card').count()
console.log('.vz-card count:', cardCount)

console.log('\n=== Step 4: Screenshot full OverviewTab ===')
await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-03-overview.png`, fullPage: true })

console.log('\n=== Step 5: Click Analytics tab ===')
try {
  // Find analytics button
  const btns = await page.locator('button').allTextContents()
  console.log('All buttons:', btns.slice(0, 15))
  const analyticsBtn = page.locator('button', { hasText: 'Analytic' }).first()
  await analyticsBtn.click({ timeout: 5000 })
  await page.waitForTimeout(2000)
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-04-analytics.png`, fullPage: true })
  const body4 = await page.evaluate(() => document.body.innerText.slice(0, 500))
  console.log('Analytics body (first 500 chars):')
  console.log(body4)
} catch (e) {
  console.log('Analytics step error:', e.message)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/diag-04-analytics-error.png`, fullPage: false })
}

console.log('\n========== DIAGNOSTIC REPORT ==========')
console.log(`Total console messages: ${allConsole.length}`)
const byType = {}
allConsole.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1 })
console.log('By type:', byType)
if (allConsole.length > 0) {
  console.log('\n--- All console messages (last 30) ---')
  allConsole.slice(-30).forEach((c, i) => {
    console.log(`  [${i + 1}] (${c.type}) ${c.text.slice(0, 250)}`)
  })
}

console.log(`\nPage errors (uncaught exceptions): ${pageErrors.length}`)
pageErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 400)}`))

console.log(`\nHTTP 4xx/5xx responses: ${allNetwork.length}`)
allNetwork.slice(0, 20).forEach((n, i) => console.log(`  [${i + 1}] ${n.status} ${n.url.slice(0, 120)}`))

console.log(`\nRequest failures (network errors): ${requestFailures.length}`)
requestFailures.slice(0, 20).forEach((f, i) => console.log(`  [${i + 1}] ${f.method} ${f.url.slice(0, 100)} → ${f.failure}`))
console.log('======================================')

await browser.close()
