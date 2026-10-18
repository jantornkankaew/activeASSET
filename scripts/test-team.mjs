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

console.log('=== Click ทีมงาน sidebar item ===')
// Find the team sidebar item by text "ทีมงาน"
await page.locator('text=ทีมงาน').first().click({ timeout: 5000 })
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Screenshot
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-team-grid.png`, fullPage: false })
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-team-grid-full.png`, fullPage: true })

// Count Velzon elements
const result = await page.evaluate(() => ({
  vzCardCount: document.querySelectorAll('.vz-card').length,
  vzAvatarCount: document.querySelectorAll('.vz-avatar').length,
  vzPillCount: document.querySelectorAll('.vz-pill').length,
  pageTitleH4: document.querySelectorAll('h4').length,
  // Check for cover gradients
  coverGradients: document.querySelectorAll('div[style*="linear-gradient"]').length,
}))
console.log('DOM elements:', JSON.stringify(result, null, 2))

console.log('=== Switch to list view ===')
const listViewBtn = page.locator('button[title="List view"]').first()
if (await listViewBtn.count() > 0) {
  await listViewBtn.click()
  await page.waitForTimeout(800)
  console.log('→ Switched to list view')
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-team-list.png`, fullPage: false })

  // Verify CRM table exists
  const tableCount = await page.locator('.vz-crm-table').count()
  console.log('CRM table count in list view:', tableCount)
}

console.log('\n========== TEAM TAB TEST REPORT ==========')
console.log(`Console errors (excl 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0)
console.log(pass ? '✓ PASS' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
