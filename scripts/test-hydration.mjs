import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const allMsgs = []
page.on('console', (msg) => allMsgs.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => allMsgs.push({ type: 'pageerror', text: err.message }))

console.log('=== Step 1: First load (no token, no SSR/CSR mismatch expected) ===')
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2000)

console.log('=== Step 2: Login ===')
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(3000)

console.log('=== Step 3: Reload WITH token in localStorage (the scenario that used to trigger hydration mismatch) ===')
const beforeCount = allMsgs.length
await page.reload({ waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(3000)
const afterCount = allMsgs.length

const html = await page.content()
const hasVzBanner = html.includes('vz-banner')
const hasVzCard = html.includes('vz-card')
console.log('After reload — vz-banner present:', hasVzBanner)
console.log('After reload — vz-card present:', hasVzCard)

const newMsgs = allMsgs.slice(beforeCount)
console.log('\nMessages during/after reload:', newMsgs.length)
const hydrationIssues = newMsgs.filter(m => /hydrat|did not match|mismatch/i.test(m.text))
console.log('Hydration-related messages:', hydrationIssues.length)
if (hydrationIssues.length > 0) {
  hydrationIssues.forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 300)}`))
}
// Filter out expected 401s from pre-login session checks (they happen during the brief auth bootstrap)
const realErrors = newMsgs.filter(m =>
  (m.type === 'error' || m.type === 'pageerror') &&
  !/401|Unauthorized/i.test(m.text)
)
console.log('Real errors (excluding expected 401 pre-login checks):', realErrors.length)
realErrors.slice(0, 5).forEach((m, i) => console.log(`  [${i + 1}] (${m.type}) ${m.text.slice(0, 300)}`))

await page.screenshot({ path: '/home/z/my-project/download/test-hydration-after-reload.png', fullPage: false })

const finalResult = (hydrationIssues.length === 0 && realErrors.length === 0)
console.log('\n=== RESULT:', finalResult ? '✓ PASS — no hydration mismatch, no real errors' : '✗ FAIL — see issues above', '===')

await browser.close()
process.exit(finalResult ? 0 : 1)
