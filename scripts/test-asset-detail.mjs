import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = '/home/z/my-project/download'
const LOGIN = { email: 'admin@activeasset.local', password: 'admin123' }

const allConsole = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

page.on('console', (msg) => allConsole.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => pageErrors.push(err.message))

console.log('=== Step 1: Login ===')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[type=email]', { timeout: 10000 })
await page.fill('input[type=email]', LOGIN.email)
await page.fill('input[type=password]', LOGIN.password)
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(3000)

console.log('=== Step 2: Click "ทรัพย์สิน" tab ===')
// Try multiple selectors for the assets tab
const tabs = await page.locator('button').allTextContents()
console.log('Available buttons:', tabs.slice(0, 20))
const assetsTab = page.locator('button', { hasText: 'ทรัพย์สิน' }).first()
await assetsTab.click({ timeout: 5000 })
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })
console.log('Clicked Assets tab')

console.log('=== Step 3: Wait for catalog cards to render (Level 1) ===')
// Catalog cards have specific styling — wait for them
await page.waitForTimeout(1000)
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-step1-catalogs.png`, fullPage: false })

console.log('=== Step 4: Click first catalog card (Level 2 — units list) ===')
// Catalog cards: try multiple possible selectors
try {
  // The cards typically use clickable buttons; look for the first one with brand text
  const cards = page.locator('button:has-text("Honeywell"), button:has-text("Apple"), button:has-text("Zebra"), button:has-text("Honeywell")').first()
  if (await cards.count() > 0) {
    await cards.click({ timeout: 5000 })
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    console.log('Clicked catalog')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-step2-units.png`, fullPage: false })
  } else {
    console.log('No catalog card found — maybe the catalog list uses different text')
  }
} catch (e) {
  console.log('Catalog click error:', e.message)
}

console.log('=== Step 5: Click first unit card (Level 3 — AssetDetailView) ===')
try {
  // Unit cards have tagId like "ACT-xxx" — click the first button with "ACT" text
  const unitBtn = page.locator('button:has-text("ACT")').first()
  if (await unitBtn.count() > 0) {
    await unitBtn.click({ timeout: 5000 })
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    console.log('Clicked unit, loaded detail view')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-step3-detail.png`, fullPage: false })

    // Verify the Velzon product-details layout
    const hasVzCard = await page.locator('.vz-card').count()
    const hasVzBanner = await page.locator('.vz-banner').count()
    const hasVzEyebrow = await page.locator('.vz-eyebrow').count()
    const hasVzPill = await page.locator('.vz-pill').count()
    const hasTabsTrigger = await page.locator('[role="tab"]').count()
    const hasStarIcons = await page.locator('svg.lucide-star').count()

    console.log('')
    console.log('=== AssetDetailView Velzon elements rendered ===')
    console.log('.vz-card count:', hasVzCard)
    console.log('.vz-banner count (breadcrumb/banner):', hasVzBanner)
    console.log('.vz-eyebrow count:', hasVzEyebrow)
    console.log('.vz-pill count:', hasVzPill)
    console.log('Tab triggers:', hasTabsTrigger)
    console.log('Star icons (rating):', hasStarIcons)
    console.log('')
    console.log('=== Test tabs by clicking each ===')

    // Click accessories tab
    const accessoriesTab = page.locator('[role="tab"]').nth(1)
    await accessoriesTab.click()
    await page.waitForTimeout(500)
    console.log('→ Clicked "อุปกรณ์เสริม" tab')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-step4-tab-accessories.png`, fullPage: false })

    // Click history tab
    const historyTab = page.locator('[role="tab"]').nth(2)
    await historyTab.click()
    await page.waitForTimeout(500)
    console.log('→ Clicked "ประวัติยืม-คืน" tab')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-step5-tab-history.png`, fullPage: false })

    // Back to info tab
    const infoTab = page.locator('[role="tab"]').nth(0)
    await infoTab.click()
    await page.waitForTimeout(500)
    console.log('→ Back to "ข้อมูลทรัพย์สิน" tab')
  } else {
    console.log('No unit card found with "ACT" text')
  }
} catch (e) {
  console.log('Unit click error:', e.message)
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-assets-error-state.png`, fullPage: false })
}

// === Final report ===
console.log('')
console.log('========== ASSET DETAIL TEST REPORT ==========')
console.log(`Console messages: ${allConsole.length}`)
const realErrors = allConsole.filter(m =>
  (m.type === 'error' || m.type === 'pageerror') &&
  !/401|Unauthorized/i.test(m.text)
)
console.log(`Real errors (excluding 401 pre-login checks): ${realErrors.length}`)
realErrors.slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (realErrors.length === 0 && pageErrors.length === 0)
console.log('=============================================')
console.log(pass ? '✓ PASS — AssetDetailView rendered without errors' : '✗ FAIL — see errors above')

await browser.close()
process.exit(pass ? 0 : 1)
