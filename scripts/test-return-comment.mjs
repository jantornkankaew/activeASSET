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

console.log('=== Click ใบยืม tab + loan LOAN-202610-008 (Delivered) ===')
await page.locator('button', { hasText: 'ใบยืม' }).first().click()
await page.waitForTimeout(2000)
await page.waitForLoadState('networkidle', { timeout: 15000 })
await page.locator('text=LOAN-202610-008').first().click({ timeout: 5000 })
await page.waitForTimeout(3000)

console.log('=== Click รับคืน button ===')
await page.locator('button:has-text("รับคืน"), button:has-text("รับคืน (")').first().click({ timeout: 5000 })
await page.waitForTimeout(2500)
await page.waitForLoadState('networkidle', { timeout: 15000 })

console.log('=== Select first item checkbox ===')
await page.locator('[role="checkbox"]').first().click()
await page.waitForTimeout(1000)

console.log('=== Fill comment textarea ===')
// Find the comment textarea (placeholder includes "สภาพดี")
const commentTextarea = page.locator('textarea[placeholder*="สภาพดี"]').first()
if (await commentTextarea.count() > 0) {
  await commentTextarea.fill('ทดสอบรีวิว: เครื่องสภาพดี ใช้งานได้ปกติ มีรอยขีดเล็กน้อยที่มุมขวาบน')
  console.log('→ Filled comment: "ทดสอบรีวิว: เครื่องสภาพดี ใช้งานได้ปกติ..."')
} else {
  console.log('Comment textarea not found — trying all textareas')
  const textareas = await page.locator('textarea').all()
  console.log(`Found ${textareas.length} textareas`)
}
await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-comment.png`, fullPage: false })

console.log('=== Sign signature pad ===')
// Sign on the canvas — find canvas in signature pad
const sigCanvas = page.locator('canvas').first()
if (await sigCanvas.count() > 0) {
  const box = await sigCanvas.boundingBox()
  if (box) {
    // Simulate a scribble by dragging mouse across canvas
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 0; i < 100; i++) {
      await page.mouse.move(box.x + 20 + i * 3, box.y + box.height / 2 + Math.sin(i / 5) * 10)
    }
    await page.mouse.up()
    console.log('→ Signed on canvas')
    await page.waitForTimeout(500)
  }
}

console.log('=== Submit return ===')
// Scroll to bottom first to make submit button visible
await page.evaluate(() => {
  const scrollAreas = document.querySelectorAll('[class*="ScrollArea"] > div, [data-radix-scroll-area-viewport]')
  scrollAreas.forEach(s => s.scrollTop = s.scrollHeight)
})
await page.waitForTimeout(500)
// Also scroll the page
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(300)

const submitBtn = page.locator('button:has-text("ยืนยันรับคืน")').first()
if (await submitBtn.count() > 0) {
  const isDisabled = await submitBtn.isDisabled()
  console.log('Submit button disabled?', isDisabled)
  if (!isDisabled) {
    // Direct DOM click via evaluate (bypass Playwright viewport check)
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button')
      for (const b of btns) {
        if (b.textContent.includes('ยืนยันรับคืน')) {
          b.click()
          return
        }
      }
    })
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    console.log('→ Submitted return (via DOM click)')
  } else {
    console.log('Submit button is disabled — signature or inspector name missing')
  }
}

console.log('=== Re-open loan detail to verify comment is saved ===')
// Click the loan again
await page.locator('text=LOAN-202610-008').first().click({ timeout: 5000 })
await page.waitForTimeout(3000)
await page.waitForLoadState('networkidle', { timeout: 15000 })

// Look for the comment in the past return events
const bodyText = await page.evaluate(() => document.body.innerText)
const hasComment = bodyText.includes('ทดสอบรีวิว')
console.log(`Comment "ทดสอบรีวิว" found in loan detail: ${hasComment}`)

if (hasComment) {
  // Take screenshot of the past return events showing comment
  await page.screenshot({ path: `${SCREENSHOT_DIR}/test-return-comment-saved.png`, fullPage: true })
  console.log('✓ Comment is saved and displayed in past return events!')
}

console.log('\n========== COMMENT FEATURE TEST REPORT ==========')
console.log(`Console errors (excl 401): ${allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).length}`)
allMsgs.filter(m => (m.type === 'error' || m.type === 'pageerror') && !/401|Unauthorized/i.test(m.text)).slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 250)}`))
console.log(`Page errors (uncaught): ${pageErrors.length}`)
pageErrors.slice(0, 3).forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 250)}`))

const pass = (pageErrors.length === 0 && hasComment)
console.log(pass ? '✓ PASS — comment field works end-to-end' : '✗ FAIL')

await browser.close()
process.exit(pass ? 0 : 1)
