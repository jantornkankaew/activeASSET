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
await page.waitForLoadState('networkidle', { timeout: 15000 })
await page.locator('text=LOAN-202610-008').first().click({ timeout: 5000 })
await page.waitForTimeout(3500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Find the comment element via DOM
const result = await page.evaluate(() => {
  // Look for the comment text "ทดสอบรีวิว"
  const allElements = document.querySelectorAll('*')
  for (const el of allElements) {
    if (el.children.length === 0 && el.textContent && el.textContent.includes('ทดสอบรีวิว')) {
      // Get the parent context
      const parent = el.closest('div[class*="bg-muted"]') || el.parentElement
      const rect = el.getBoundingClientRect()
      return {
        found: true,
        text: el.textContent.slice(0, 200),
        tag: el.tagName,
        className: el.className,
        parentText: parent ? parent.textContent.slice(0, 200) : null,
        location: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      }
    }
  }
  return { found: false }
})
console.log('Comment element:', JSON.stringify(result, null, 2))
await browser.close()
