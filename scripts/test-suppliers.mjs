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

console.log('=== Click ทรัพย์สิน tab ===')
await page.locator('button', { hasText: 'ทรัพย์สิน' }).first().click()
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })

console.log('=== Click Suppliers button (top-right) ===')
const supBtn = page.locator('button', { hasText: 'Suppliers' }).first()
await supBtn.click({ timeout: 5000 })
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-suppliers-list.png`, fullPage: false })
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-suppliers-full.png`, fullPage: true })

// Count Velzon elements
const vzCardCount = await page.locator('.vz-card').count()
const supplierCardGrid = await page.locator('.grid > .vz-card').count()
console.log('vz-card count (total):', vzCardCount)
console.log('Supplier cards in grid:', supplierCardGrid)

console.log('=== Test "Add Supplier" form ===')
const addBtn = page.locator('button', { hasText: 'เพิ่ม Supplier' }).first()
if (await addBtn.count() > 0) {
  await addBtn.click()
  await page.waitForTimeout(500)
  console.log('→ Clicked เพิ่ม Supplier button')
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-suppliers-form.png`, fullPage: false })
}

console.log('=== Test search ===')
const searchInput = page.locator('input[placeholder*="ค้นหา"]').first()
if (await searchInput.count() > 0) {
  await searchInput.fill('Honey')
  await page.waitForTimeout(500)
  console.log('→ Typed "Honey" in search')
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-suppliers-search.png`, fullPage: false })
}

console.log('\n========== SUPPLIERS TEST REPORT ==========')
console.log(`Console errors (excl 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0)
console.log(pass ? '✓ PASS' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
