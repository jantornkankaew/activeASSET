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

console.log('=== Click loan card that has status allowing return ===')
// LOAN-202610-008 is "Delivered" — allows return
const loanBtn = page.locator('text=LOAN-202610-008').first()
if (await loanBtn.count() > 0) {
  await loanBtn.click({ timeout: 5000 })
  await page.waitForTimeout(3000)
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  console.log('Clicked loan, sheet should be open')

  // Look for "รับคืน" button in the open loan detail sheet
  const returnBtn = page.locator('button:has-text("รับคืน"), button:has-text("รับคืน (")').first()
  if (await returnBtn.count() > 0) {
    await returnBtn.click({ timeout: 5000 })
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    console.log('→ Clicked รับคืn button, ReturnLoanSheet should open')
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-sheet-viewport.png`, fullPage: false })
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-sheet-full.png`, fullPage: true })

    // Count Velzon elements
    const vzCardCount = await page.locator('.vz-card').count()
    const starIconCount = await page.locator('svg.lucide-star').count()
    const radioCount = await page.locator('[role="radio"]').count()
    const checkboxCount = await page.locator('[role="checkbox"]').count()
    console.log('vz-card count:', vzCardCount)
    console.log('Star icons:', starIconCount)
    console.log('Radio buttons (grade):', radioCount)
    console.log('Checkboxes:', checkboxCount)

    // Click first item checkbox to expand the form (grade radios + accessories)
    const firstCheckbox = page.locator('[role="checkbox"]').first()
    if (await firstCheckbox.count() > 0) {
      await firstCheckbox.click()
      await page.waitForTimeout(800)
      console.log('→ Clicked first item checkbox, form should expand')
      await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-sheet-expanded.png`, fullPage: false })
      const radioCount2 = await page.locator('[role="radio"]').count()
      const checkboxCount2 = await page.locator('[role="checkbox"]').count()
      console.log('After expand → Radio buttons:', radioCount2, '/ Checkboxes:', checkboxCount2)
    }
  } else {
    console.log('No รับคืน button visible (loan may not be in Delivered status)')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-no-button.png`, fullPage: false })
  }
} else {
  console.log('No LOAN- button found')
}

console.log('\n========== RETURN SHEET TEST REPORT ==========')
console.log(`Console errors (excl 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0)
console.log(pass ? '✓ PASS' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
