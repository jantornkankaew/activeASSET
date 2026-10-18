import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
const page = await context.newPage()
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)
await page.locator('button', { hasText: 'ทรัพย์สิน' }).first().click()
await page.waitForTimeout(2000)
// Find catalog with ACT-037 (Zebra DS2208-SR likely)
await page.locator('text=Zebra').first().click({ timeout: 5000 })
await page.waitForTimeout(2000)
await page.locator('text=ACT-037').first().click({ timeout: 5000 })
await page.waitForTimeout(3500)

// Check that aggregated rating is 5/5 (from the 1 review we have)
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Has "5.0 / 5":', bodyText.includes('5.0 / 5') || bodyText.includes('5.0 out of 5'))
console.log('Has "1 รีวิว":', bodyText.includes('1 รีวิว'))
console.log('Has comment "ทดสอบรีวิว":', bodyText.includes('ทดสอบรีวิว'))

// Click the Ratings & Reviews tab (3rd tab)
const tabs = page.locator('[role="tab"]')
const tabCount = await tabs.count()
console.log('Tabs available:', tabCount)
if (tabCount >= 3) {
  await tabs.nth(2).click()
  await page.waitForTimeout(1000)
  console.log('→ Clicked 3rd tab (Ratings & Reviews)')
}
// Scroll to the review section
await page.evaluate(() => {
  const all = document.querySelectorAll('*')
  for (const el of all) {
    if (el.children.length === 0 && el.textContent && el.textContent.includes('ทดสอบรีวิว')) {
      el.scrollIntoView({ block: 'center' })
      return
    }
  }
})
await page.waitForTimeout(500)
await page.screenshot({ path: '/home/z/my-project/download/test-sn-ratings-reviews.png', fullPage: false })
console.log('Screenshot saved')
await browser.close()
