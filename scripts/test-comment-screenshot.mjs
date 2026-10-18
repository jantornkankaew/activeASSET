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
await page.locator('button', { hasText: 'ใบยืม' }).first().click()
await page.waitForTimeout(2000)
await page.locator('text=LOAN-202610-008').first().click({ timeout: 5000 })
await page.waitForTimeout(3500)

// Scroll to the comment element via DOM
await page.evaluate(() => {
  const allElements = document.querySelectorAll('*')
  for (const el of allElements) {
    if (el.children.length === 0 && el.textContent && el.textContent.includes('ทดสอบรีวิว')) {
      el.scrollIntoView({ block: 'center' })
      return
    }
  }
})
await page.waitForTimeout(500)
await page.screenshot({ path: '/home/z/my-project/download/test-comment-visible.png', fullPage: false })
console.log('Screenshot saved with comment visible')
await browser.close()
