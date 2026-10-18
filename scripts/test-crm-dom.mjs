import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' })
await page.fill('input[type=email]', 'admin@activeasset.local')
await page.fill('input[type=password]', 'admin123')
await Promise.all([
  page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
  page.click('button[type=submit]'),
])
await page.waitForTimeout(2500)

// Check Overview tab DOM
const overviewResult = await page.evaluate(() => {
  const widgets = document.querySelectorAll('.vz-crm-widget')
  const stats = document.querySelectorAll('.vz-crm-stat')
  const sortBtns = document.querySelectorAll('.vz-crm-sort-btn')
  const crmTables = document.querySelectorAll('.vz-crm-table')
  const crmTasks = document.querySelectorAll('.vz-crm-tasks')
  return {
    widgetCount: widgets.length,
    statCount: stats.length,
    sortBtnCount: sortBtns.length,
    tableCount: crmTables.length,
    tasksCount: crmTasks.length,
  }
})
console.log('=== Overview tab CRM elements ===')
console.log(JSON.stringify(overviewResult, null, 2))

// Click Analytics tab
await page.locator('button', { hasText: 'Analytic' }).first().click()
await page.waitForTimeout(2500)

const analyticsResult = await page.evaluate(() => {
  const widgets = document.querySelectorAll('.vz-crm-widget')
  const stats = document.querySelectorAll('.vz-crm-stat')
  const sortBtns = document.querySelectorAll('.vz-crm-sort-btn')
  const crmTables = document.querySelectorAll('.vz-crm-table')
  const crmTasks = document.querySelectorAll('.vz-crm-tasks')
  return {
    widgetCount: widgets.length,
    statCount: stats.length,
    sortBtnCount: sortBtns.length,
    tableCount: crmTables.length,
    tasksCount: crmTasks.length,
  }
})
console.log('=== Analytics tab CRM elements ===')
console.log(JSON.stringify(analyticsResult, null, 2))

await browser.close()
