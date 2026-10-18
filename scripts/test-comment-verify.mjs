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
await page.screenshot({ path: '/home/z/my-project/download/test-loan-with-comment.png', fullPage: true })
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Has comment in body:', bodyText.includes('ทดสอบรีวิว'))
console.log('Has ACT-037 in body:', bodyText.includes('ACT-037'))
console.log('Has รีวิวการรับคืนย้อนหลัง:', bodyText.includes('รีวิวการรับคืนย้อนหลัง'))
await browser.close()
