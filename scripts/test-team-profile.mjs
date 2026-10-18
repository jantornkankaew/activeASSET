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
await page.locator('text=ทีมงาน').first().click()
await page.waitForTimeout(2500)

console.log('=== Click ดูโปรไฟล์ button ===')
const profileBtn = page.locator('button:has-text("ดูโปรไฟล์")').first()
if (await profileBtn.count() > 0) {
  await profileBtn.click({ force: true, timeout: 5000 })
  await page.waitForTimeout(2500)
  console.log('→ Clicked ดูโปรไฟล์')
  await page.screenshot({ path: '/home/z/my-project/download/test-team-profile.png', fullPage: false })

  // Verify profile elements
  const result = await page.evaluate(() => ({
    hasCoverGradient: document.querySelectorAll('div[style*="linear-gradient"]').length,
    hasAvatar: document.querySelectorAll('.vz-avatar').length,
    hasTabs: document.querySelectorAll('[role="tab"]').length,
    hasInfoTable: document.querySelectorAll('table').length,
    hasActivityFeed: document.querySelectorAll('.scroll-area, [data-radix-scroll-area-viewport]').length > 0,
  }))
  console.log('Profile DOM elements:', JSON.stringify(result, null, 2))
} else {
  console.log('No ดูโปรไฟล์ button found')
}

console.log('\n=== TEST REPORT ===')
console.log(`Page errors: ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 200)}`))
const pass = pageErrors.length === 0
console.log(pass ? '✓ PASS' : '✗ FAIL')
await browser.close()
process.exit(pass ? 0 : 1)
