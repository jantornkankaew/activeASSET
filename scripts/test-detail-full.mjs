import { chromium } from 'playwright'

const BASE = ' ' + 'http://localhost:3000'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()

const allMsgs = []
page.on('console', (m) => allMsgs.push({ type: m.type(), text: m.text() }))
page.on('pageerror', (e) => allMsgs.push({ type: 'pageerror', text: e.message }))

await page.goto(BASE.trim(), { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)

// Click ทรัพย์สิน
await page.locator('button', { hasText: 'ทรัพย์สิน' }).first().click()
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Click first catalog
const cat = page.locator('button:has-text("iPad")').first()
await cat.click()
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Click first unit
const unit = page.locator('button:has-text("ACT")').first()
await unit.click()
await page.waitForTimeout(3500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Wait extra for full render
await page.waitForTimeout(2000)

// Take fullPage screenshot
await page.screenshot({
  path: '/home/z/my-project/download/test-detail-full.png',
  fullPage: true,
})

// Also capture just the main content area
const main = page.locator('main, [role="main"]').first()
if (await main.count() > 0) {
  await main.screenshot({ path: '/home/z/my-project/download/test-detail-main.png' })
} else {
  // fallback: just clip the right portion
  await page.screenshot({
    path: '/home/z/my-project/download/test-detail-main.png',
    clip: { x: 240, y: 60, width: 1200, height: 1040 },
  })
}

// Print errors
console.log('Console messages:', allMsgs.length)
const errors = allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text))
console.log('Real errors:', errors.length)
errors.slice(0, 5).forEach((e, i) => console.log(`  [${i + 1}] (${e.type}) ${e.text.slice(0, 250)}`))

// Print page dimensions
const dims = await page.evaluate(() => ({
  scrollHeight: document.body.scrollHeight,
  innerHeight: window.innerHeight,
  innerWidth: window.innerWidth,
}))
console.log('Page dimensions:', dims)

// Print the HTML structure of main content for debugging
const html = await page.evaluate(() => {
  const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body
  return main.innerHTML.slice(0, 3000)
})
console.log('\n=== Main HTML (first 3000 chars) ===')
console.log(html)

await browser.close()
