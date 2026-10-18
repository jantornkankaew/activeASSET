import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/z/my-project/download'

const allMsgs = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
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

console.log('=== Click ทรัพย์สิน tab ===')
await page.locator('button', { hasText: 'ทรัพย์สิน' }).first().click()
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })

console.log('=== Click ลงทะเบียนใหม่ button ===')
// Find the register button (the catalog view has it in top-right area)
const registerBtn = page.locator('button', { hasText: /ลงทะเบียนใหม่|ลงทะเบียน/ }).first()
await registerBtn.click({ timeout: 5000 })
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

console.log('=== Screenshot full page ===')
await page.screenshot({
  path: `${SCREENSHOT_DIR}/test-register-full.png`,
  fullPage: true,
})

console.log('=== Screenshot just viewport ===')
await page.screenshot({
  path: `${SCREENSHOT_DIR}/test-register-viewport.png`,
  fullPage: false,
})

// Count Velzon elements
const vzCardCount = await page.locator('.vz-card').count()
const vzTabsCount = await page.locator('.vz-tabs-custom-trigger').count()
const inputCount = await page.locator('input, textarea, select, [role="combobox"], [role="textbox"]').count()
console.log('vz-card count:', vzCardCount)
console.log('vz-tabs-custom-trigger count:', vzTabsCount)
console.log('Form controls (input/textarea/select):', inputCount)

// Click tabs to test
console.log('\n=== Test tabs ===')
const tab2 = page.locator('[role="tab"]').nth(1)
if (await tab2.count() > 0) {
  await tab2.click()
  await page.waitForTimeout(500)
  console.log('→ Clicked tab 2')
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-register-tab-dates.png`, fullPage: false })
}

const tab3 = page.locator('[role="tab"]').nth(2)
if (await tab3.count() > 0) {
  await tab3.click()
  await page.waitForTimeout(500)
  console.log('→ Clicked tab 3')
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-register-tab-supplier.png`, fullPage: false })
}

console.log('\n========== REGISTER FORM TEST REPORT ==========')
console.log(`Console errors (excluding 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0)
console.log(pass ? '✓ PASS' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
