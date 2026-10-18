import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/z/my-project/download'

const allMsgs = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await context.newPage()

page.on('console', (m) => allMsgs.push({ type: m.type(), text: m.text() }))
page.on('pageerror', (err) => pageErrors.push(err.message))

console.log('=== Login ===')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)

console.log('=== Click ใบยืม tab ===')
await page.locator('button', { hasText: 'ใบยืม' }).first().click()
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-loan-tab-list.png`, fullPage: false })

console.log('=== Click first loan in list ===')
// Loan cards might be divs with onClick, not buttons — try multiple selectors
const loanBtn = page.locator('text=LOAN-202610-').first()
if (await loanBtn.count() > 0) {
  await loanBtn.click({ timeout: 5000 })
  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  console.log('Clicked loan, sheet should be open')

  // Wait extra for sheet animation + content load
  await page.waitForTimeout(2500)

  // Screenshot the sheet (whole viewport)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-loan-detail-viewport.png`, fullPage: false })

  // Screenshot full page (sheet might extend below fold)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-loan-detail-full.png`, fullPage: true })

  // Count Velzon elements
  const vzCardCount = await page.locator('.vz-card').count()
  const vzPillCount = await page.locator('.vz-pill').count()
  const vzTableCount = await page.locator('.vz-table').count()
  const avatarCount = await page.locator('.vz-avatar').count()
  const tableRowCounts = await page.locator('.vz-table tbody tr').count()
  console.log('vz-card count:', vzCardCount)
  console.log('vz-pill count:', vzPillCount)
  console.log('vz-table count:', vzTableCount)
  console.log('vz-avatar count:', avatarCount)
  console.log('Table rows:', tableRowCounts)
} else {
  console.log('No LOAN- button found in list')
}

console.log('\n========== LOAN DETAIL TEST REPORT ==========')
console.log(`Console errors (excl 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0)
console.log(pass ? '✓ PASS' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
