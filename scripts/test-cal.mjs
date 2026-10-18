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
await page.screenshot({ path: '/home/z/my-project/download/test-cal-current.png', fullPage: false })
// Also get the actual HTML structure of the calendar grid
const html = await page.evaluate(() => {
  const main = document.querySelector('main') || document.body
  // Find the calendar grid div
  const grids = main.querySelectorAll('.grid.grid-cols-7')
  return {
    gridCount: grids.length,
    firstGridHTML: grids.length > 0 ? grids[0].innerHTML.slice(0, 300) : 'no grid',
    secondGridHTML: grids.length > 1 ? grids[1].innerHTML.slice(0, 500) : 'no second grid',
    // Check for table-like layout
    tableCount: main.querySelectorAll('table').length,
    // Check for calendar specific classes
    calClasses: Array.from(main.querySelectorAll('[class*="calendar"], [class*="month"], [class*="fc-"]')).map(e => e.className).slice(0, 5),
  }
})
console.log('Calendar DOM:', JSON.stringify(html, null, 2))
await browser.close()
