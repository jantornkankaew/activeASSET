import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await context.newPage()
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)
await page.locator('text=ปฏิทินคืน').first().click()
await page.waitForTimeout(3000)
await page.waitForLoadState('networkidle', { timeout: 15000 })
// Scroll to show calendar grid
await page.evaluate(() => {
  const grids = document.querySelectorAll('.grid.grid-cols-7')
  if (grids.length > 1) grids[1].scrollIntoView({ block: 'center' })
})
await page.waitForTimeout(500)
await page.screenshot({ path: '/home/z/my-project/download/test-calendar-fresh.png', fullPage: false })
console.log('Fresh calendar screenshot saved')
await browser.close()
