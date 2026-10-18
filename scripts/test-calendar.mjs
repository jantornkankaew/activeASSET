import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await context.newPage()
const allMsgs = []
const pageErrors = []
page.on('console', (m) => allMsgs.push({ type: m.type(), text: m.text() }))
page.on('pageerror', (err) => pageErrors.push(err.message))

await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)
await page.locator('text=ปฏิทินคืน').first().click()
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })
await page.screenshot({ path: '/home/z/my-project/download/test-return-calendar.png', fullPage: false })

const result = await page.evaluate(() => ({
  vzCardCount: document.querySelectorAll('.vz-card').length,
  hasCalendarGrid: document.querySelectorAll('.grid.grid-cols-7').length,
  hasMonthHeader: document.querySelectorAll('h5').length,
  hasUpcomingList: document.querySelectorAll('button').length,
  hasPillCount: document.querySelectorAll('.vz-pill').length,
}))
console.log('DOM elements:', JSON.stringify(result, null, 2))

console.log(`\nPage errors: ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 200)}`))
const pass = pageErrors.length === 0
console.log(pass ? '✓ PASS' : '✗ FAIL')
await browser.close()
process.exit(pass ? 0 : 1)
