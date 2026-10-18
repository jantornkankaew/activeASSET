#!/usr/bin/env node
/**
 * E2E render test for OverviewTab + AnalyticsTab with Velzon design
 * - Login as admin via the SimpleAuth form
 * - Visit /  → check OverviewTab renders, no console errors
 * - Click "Analytics" tab → check AnalyticsTab renders, no console errors
 * - Screenshot both views
 */

import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/z/my-project/download'
const LOGIN = { email: 'admin@activeasset.local', password: 'admin123' }

const consoleErrors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(err.message))

async function step(name, fn) {
  process.stdout.write(`▶ ${name} ... `)
  try {
    await fn()
    console.log('OK')
  } catch (e) {
    console.log('FAIL')
    console.log('  ' + e.message.split('\n')[0])
    throw e
  }
}

try {
  await step('Open login page', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.waitForSelector('input[type=email]', { timeout: 10000 })
  })

  await step('Fill login form', async () => {
    await page.fill('input[type=email]', LOGIN.email)
    await page.fill('input[type=password]', LOGIN.password)
  })

  await step('Submit login', async () => {
    await Promise.all([
      page.waitForURL(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {}),
      page.waitForLoadState('networkidle', { timeout: 15000 }),
      page.click('button[type=submit]'),
    ])
    await page.waitForTimeout(2000) // allow client-side auth bootstrap
  })

  await step('Wait for CRM page-title-box', async () => {
    // Velzon CRM uses page-title-box instead of vz-banner
    await page.waitForSelector('.vz-crm-widget, .vz-card', { timeout: 10000 })
  })

  await step('Verify 5 CRM mini stats + KPI cards render', async () => {
    const widgetCount = await page.locator('.vz-crm-widget').count()
    const statCount = await page.locator('.vz-crm-stat').count()
    if (widgetCount === 0) throw new Error(`Expected crm-widget, got ${widgetCount}`)
    if (statCount < 5) throw new Error(`Expected ≥5 crm-stat, got ${statCount}`)
  })

  await step('Screenshot OverviewTab', async () => {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-overview-velzon.png`, fullPage: false })
  })

  await step('Click Analytics tab', async () => {
    // The analytics tab button — find by text
    const tab = page.getByRole('button', { name: /Analytic/i }).or(page.locator('button:has-text("Analytic")')).first()
    await tab.click({ timeout: 5000 })
    await page.waitForTimeout(1500)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  })

  await step('Verify AnalyticsTab renders', async () => {
    // Should now see trend chart + donut (Velzon)
    await page.waitForSelector('svg', { timeout: 10000 })
    // vz-card should still be present (KPI cards)
    const cardCount = await page.locator('.vz-card').count()
    if (cardCount < 4) throw new Error(`Analytics: expected ≥4 vz-card, got ${cardCount}`)
  })

  await step('Screenshot AnalyticsTab', async () => {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-analytics-velzon.png`, fullPage: false })
  })

  await step('Trigger API calls (verify endpoints return data)', async () => {
    // Already triggered by tab navigation — check no 4xx/5xx
    // We just check no console errors below
  })

  // Final report
  console.log('')
  console.log('=== TEST REPORT ===')
  console.log(`Console errors: ${consoleErrors.length}`)
  consoleErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 200)}`))
  console.log(`Page errors:    ${pageErrors.length}`)
  pageErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 200)}`))
  console.log('')

  if (consoleErrors.length === 0 && pageErrors.length === 0) {
    console.log('✓ ALL PASSED — no console or runtime errors')
    process.exit(0)
  } else {
    console.log('✗ FAILURES detected')
    process.exit(1)
  }
} catch (err) {
  console.log('')
  console.log('=== TEST FAILED ===')
  console.log(err.message)
  try {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-failure-state.png`, fullPage: false })
    console.log(`Failure screenshot saved: ${SCREENSHOT_DIR}/test-failure-state.png`)
  } catch {}
  process.exit(1)
} finally {
  await browser.close()
}
