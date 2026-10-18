// activeASSET — Import Demo Assets from Excel
// อ่าน /home/z/my-project/upload/Fixed Asset_A5.xlsx แล้ว import เข้า Prisma DB
// - สร้าง ProductCatalog อัตโนมัติ (group by model+brand+category)
// - สร้าง AssetUnit สำหรับทุกแถว
// - parse Remark เพื่อ set status (Available/On_Loan/Lost/Disposed)
// - แยกหมวดหมู่อัตโนมัติจาก Details

import { PrismaClient } from '@prisma/client'
import openpyxl from 'xlsx'
import path from 'path'
import fs from 'fs'

const db = new PrismaClient()

const EXCEL_PATH = '/home/z/my-project/upload/Fixed Asset_A5.xlsx'
const TENANT_CODE = 'AIS'

// === Categorize function ===
function categorize(details: string, model: string): { category: string; specs: string } {
  const d = (details || '').toLowerCase()
  const m = (model || '').toLowerCase()

  // Order matters: more specific first
  if (d.includes('fixed reader rfid') || d.includes('rfid')) {
    return { category: 'RFID Reader', specs: details }
  }
  if (d.includes('mobile computer') || d.includes('mobile phone') || m.includes('rk26')) {
    return { category: 'Mobile Computer', specs: details }
  }
  if (d.includes('tablet')) {
    return { category: 'Tablet', specs: details }
  }
  if (d.includes('industrial barcode printer') || d.includes('industrial printer')) {
    return { category: 'Industrial Printer', specs: details }
  }
  if (d.includes('mobile barcode printer') || d.includes('mobile printer') || d.includes('mobile receipt printer')) {
    return { category: 'Mobile Printer', specs: details }
  }
  if (d.includes('receipt printer')) {
    return { category: 'Receipt Printer', specs: details }
  }
  if (d.includes('desktop barcode printer') || d.includes('desktop printer')) {
    return { category: 'Desktop Printer', specs: details }
  }
  if (d.includes('desktop barcode scanner')) {
    return { category: 'Desktop Scanner', specs: details }
  }
  if (d.includes('industrial handheld')) {
    return { category: 'Industrial Scanner', specs: details }
  }
  if (d.includes('handheld barcode scanner') || d.includes('handheld scanner') || d.includes('1d handheld') || d.includes('2d handheld')) {
    return { category: 'Handheld Scanner', specs: details }
  }
  if (d.includes('barcode scanner')) {
    return { category: 'Handheld Scanner', specs: details }
  }
  return { category: 'Other', specs: details }
}

// === Parse remark to determine status ===
function parseStatus(remark: string, tagId: string): {
  status: string
  notes: string | null
  isOnLoan: boolean
  loanNote: string | null
} {
  const r = (remark || '').trim()
  if (!r || r === '*' || r === '') {
    return { status: 'Available', notes: null, isOnLoan: false, loanNote: null }
  }

  const lower = r.toLowerCase()

  // Lost — หาย
  if (lower.includes('หาย') || lower.includes('lost') || lower.includes('สูญ')) {
    return { status: 'Lost', notes: r, isOnLoan: false, loanNote: null }
  }

  // Disposed — ตัด/ตัดให้
  if (lower.includes('ตัดให้') || lower.includes('ตัดขาย') || lower.includes('disposed')) {
    return { status: 'Disposed', notes: r, isOnLoan: false, loanNote: null }
  }

  // On loan — พี่/น้อง/บ. ... ยืม/ให้... หรือ "ใช้ระหว่างรอ..."
  if (
    lower.includes('ยืม') ||
    lower.includes('ให้บ.') ||
    lower.includes('ให้พี่') ||
    lower.includes('ใช้ระหว่าง') ||
    lower.includes('ทดแทนงานซ่อม')
  ) {
    return { status: 'On_Loan', notes: r, isOnLoan: true, loanNote: r }
  }

  // Default — keep as Available with notes
  return { status: 'Available', notes: r, isOnLoan: false, loanNote: null }
}

// === Generate default accessories by category ===
function defaultAccessories(category: string, brand: string, model: string): string {
  const base = [`เครื่อง ${model}`]
  switch (category) {
    case 'Mobile Computer':
      return JSON.stringify([...base, 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable', 'Cradle'])
    case 'Tablet':
      return JSON.stringify([...base, 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable'])
    case 'Handheld Scanner':
    case 'Desktop Scanner':
    case 'Industrial Scanner':
      return JSON.stringify([...base, 'USB Cable', 'Stand'])
    case 'Desktop Printer':
    case 'Industrial Printer':
      return JSON.stringify([...base, 'Power Adapter', 'Power Cord', 'USB Cable', 'Ribbon Core 1"'])
    case 'Mobile Printer':
    case 'Receipt Printer':
      return JSON.stringify([...base, 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable'])
    case 'RFID Reader':
      return JSON.stringify([...base, 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable'])
    default:
      return JSON.stringify([...base, 'Power Adapter', 'Power Cord', 'USB Cable'])
  }
}

// === Main ===
async function main() {
  console.log('📂 Reading Excel:', EXCEL_PATH)
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('❌ Excel file not found:', EXCEL_PATH)
    process.exit(1)
  }

  const wb = openpyxl.readFile(EXCEL_PATH)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: any[][] = openpyxl.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  console.log(`📊 Total rows: ${rows.length}`)

  // Find or create tenant
  let tenant = await db.tenant.findUnique({ where: { code: TENANT_CODE } })
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: 'Active ID Solutions', code: TENANT_CODE, plan: 'enterprise' },
    })
    console.log(`✅ Created tenant: ${tenant.code}`)
  } else {
    console.log(`✅ Using existing tenant: ${tenant.code}`)
  }

  // Find or create default location "HQ"
  let location = await db.location.findFirst({ where: { tenantId: tenant.id, name: 'HQ — คลังเดโม' } })
  if (!location) {
    location = await db.location.create({
      data: { tenantId: tenant.id, name: 'HQ — คลังเดโม', zone: 'A' },
    })
    console.log(`✅ Created location: ${location.name}`)
  }

  // Parse rows (skip header at row 1)
  interface ParsedRow {
    tagId: string
    details: string
    model: string
    serialNo: string
    brand: string
    remark: string
  }

  const parsedRows: ParsedRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const tagId = String(row[0] || '').trim()
    const details = String(row[1] || '').trim()
    const model = String(row[2] || '').trim()
    const serialNo = String(row[3] || '').trim()
    const brand = String(row[4] || '').trim()
    const remark = String(row[5] || '').trim()

    // Skip empty rows
    if (!tagId && !details && !model && !serialNo) continue
    // Skip rows without tagId but with details (e.g. "TBC RT10A")
    if (!tagId && details) {
      console.log(`⚠️  Row ${i + 1}: missing Tag ID, skipping (details: ${details})`)
      continue
    }
    if (!tagId) continue

    // Clean serial number — remove ".0" suffix from numeric values
    const cleanSerial = serialNo.replace(/\.0$/, '')

    parsedRows.push({ tagId, details, model, serialNo: cleanSerial, brand, remark })
  }

  console.log(`📋 Parsed ${parsedRows.length} valid rows`)

  // Group by model+brand to create catalogs
  const catalogMap = new Map<string, { model: string; brand: string; category: string; specs: string }>()
  for (const row of parsedRows) {
    const key = `${row.model}|${row.brand}`
    if (!catalogMap.has(key)) {
      const { category, specs } = categorize(row.details, row.model)
      catalogMap.set(key, { model: row.model, brand: row.brand, category, specs })
    }
  }

  console.log(`📦 Unique catalog entries: ${catalogMap.size}`)

  // Create catalogs
  const catalogIds = new Map<string, string>()
  for (const [key, cat] of catalogMap.entries()) {
    const existing = await db.productCatalog.findFirst({
      where: { tenantId: tenant.id, model: cat.model },
    })
    if (existing) {
      catalogIds.set(key, existing.id)
      console.log(`   ↳ Existing catalog: ${cat.brand} ${cat.model} [${cat.category}]`)
    } else {
      const created = await db.productCatalog.create({
        data: {
          tenantId: tenant.id,
          model: cat.model,
          brand: cat.brand,
          category: cat.category,
          defaultSpecs: cat.specs,
          defaultAccessories: defaultAccessories(cat.category, cat.brand, cat.model),
        },
      })
      catalogIds.set(key, created.id)
      console.log(`   ✨ Created catalog: ${cat.brand} ${cat.model} [${cat.category}]`)
    }
  }

  // Create asset units
  let created = 0
  let skipped = 0
  let onLoan = 0
  let lost = 0
  let disposed = 0
  let available = 0

  for (const row of parsedRows) {
    const key = `${row.model}|${row.brand}`
    const catalogId = catalogIds.get(key)
    if (!catalogId) {
      console.log(`⚠️  No catalog for ${row.tagId} (${row.brand} ${row.model}), skipping`)
      skipped++
      continue
    }

    // Check if asset already exists (by tagId or serialNo within tenant)
    const existing = await db.assetUnit.findFirst({
      where: {
        OR: [
          { tagId: row.tagId },
          { tenantId: tenant.id, serialNo: row.serialNo },
        ],
      },
    })
    if (existing) {
      console.log(`   ↳ Existing asset: ${row.tagId} (${row.brand} ${row.model})`)
      skipped++
      continue
    }

    const { status, notes, isOnLoan, loanNote } = parseStatus(row.remark, row.tagId)

    await db.assetUnit.create({
      data: {
        tagId: row.tagId,
        tenantId: tenant.id,
        serialNo: row.serialNo || row.tagId,
        catalogId,
        source: 'Demo_Stock',
        status,
        locationId: location.id,
        conditionGrade: 'A',
        registeredAccessories: defaultAccessories(catalogMap.get(key)!.category, row.brand, row.model),
        notes: notes || row.details,
      },
    })

    created++
    if (status === 'Available') available++
    else if (status === 'On_Loan') onLoan++
    else if (status === 'Lost') lost++
    else if (status === 'Disposed') disposed++
  }

  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('🎉 Import Summary')
  console.log('═══════════════════════════════════════════════')
  console.log(`Total parsed:    ${parsedRows.length}`)
  console.log(`Created assets:  ${created}`)
  console.log(`Skipped:         ${skipped}`)
  console.log(`  • Available:   ${available}`)
  console.log(`  • On_Loan:     ${onLoan}  (จาก Remark: พี่.../บ... ยืม/ให้...)`)
  console.log(`  • Lost:        ${lost}  (Remark: หาย)`)
  console.log(`  • Disposed:    ${disposed}  (Remark: ตัดให้...)`)
  console.log(`Catalogs:        ${catalogIds.size}`)
  console.log(`Tenant:          ${tenant.code} (${tenant.id})`)
  console.log(`Location:        ${location.name}`)
  console.log('═══════════════════════════════════════════════')
}

main()
  .catch((err) => {
    console.error('❌ Error:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
