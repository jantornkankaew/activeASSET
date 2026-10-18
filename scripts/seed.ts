// activeASSET v2 — Seed Script
// 3-phase loan: Request → Dispatch → Deliver
// + Waiting List + Source tracking + Customer.industry + Photos

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'

const db = new PrismaClient()

const catalogs = [
  { model: 'EDA52-1', brand: 'Honeywell', category: 'Mobile Computer', defaultSpecs: 'Android 11, 2D Imager, Wi-Fi 6, 4GB/64GB', defaultAccessories: JSON.stringify(['เครื่อง EDA52-1', 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable', 'Cradle']) },
  { model: 'EDA51', brand: 'Honeywell', category: 'Mobile Computer', defaultSpecs: 'Android 10, 2D Imager, Wi-Fi 5, 4GB/64GB', defaultAccessories: JSON.stringify(['เครื่อง EDA51', 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable']) },
  { model: 'TC53', brand: 'Zebra', category: 'Mobile Computer', defaultSpecs: 'Android 13, SE4750, Wi-Fi 6E, 8GB/128GB', defaultAccessories: JSON.stringify(['เครื่อง TC53', 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable', 'Cradle']) },
  { model: 'DS2208-SR', brand: 'Zebra', category: 'Barcode Scanner', defaultSpecs: '1D/2D Corded, USB HID', defaultAccessories: JSON.stringify(['สแกนเนอร์ DS2208', 'USB Cable', 'Stand']) },
  { model: 'Voyager XP 1470g', brand: 'Honeywell', category: 'Barcode Scanner', defaultSpecs: '1D/2D Corded', defaultAccessories: JSON.stringify(['สแกนเนอร์ Voyager XP', 'USB Cable', 'Stand']) },
  { model: 'TH240T', brand: 'TSC', category: 'Barcode Printer', defaultSpecs: '4-inch Thermal Transfer, 203 DPI', defaultAccessories: JSON.stringify(['เครื่องพิมพ์ TH240T', 'Power Adapter', 'Power Cord', 'USB Cable', 'Ribbon Core 1"']) },
  { model: 'ZD420', brand: 'Zebra', category: 'Barcode Printer', defaultSpecs: '4-inch Direct Thermal, 203 DPI', defaultAccessories: JSON.stringify(['เครื่องพิมพ์ ZD420', 'Power Adapter', 'Power Cord', 'USB Cable']) },
  { model: 'RFD40', brand: 'Zebra', category: 'RFID Reader', defaultSpecs: 'UHF RFID Sled, Bluetooth', defaultAccessories: JSON.stringify(['เครื่อง RFD40', 'แบตเตอรี่', 'Power Adapter', 'Power Cord', 'USB Cable']) },
  { model: 'iPad 10th', brand: 'Apple', category: 'Tablet', defaultSpecs: '10.9 inch, Wi-Fi, 64GB', defaultAccessories: JSON.stringify(['iPad 10th', 'Power Adapter', 'USB-C Cable']) },
  { model: 'Galaxy Tab A9', brand: 'Samsung', category: 'Tablet', defaultSpecs: '8.7 inch, Wi-Fi, 64GB', defaultAccessories: JSON.stringify(['Galaxy Tab A9', 'Power Adapter', 'USB-C Cable']) },
]

const locations = [
  { name: 'Mobile Computer ตู้ A1', zone: 'คลังเดโม' },
  { name: 'Barcode Scanner ลังที่ 1', zone: 'คลังเดโม' },
  { name: 'Barcode Scanner ลังที่ 2', zone: 'คลังเดโม' },
  { name: 'Barcode Printer ชั้น B1', zone: 'คลังเดโม' },
  { name: 'RFID Reader ตู้ C1', zone: 'คลังเดโม' },
  { name: 'Tablet ตู้ D1', zone: 'คลังเดโม' },
  { name: 'คลังขาย (Sales Stock)', zone: 'คลังขาย' },
  { name: 'ห้องเดโม ชั้น 2', zone: 'ห้องเดโม' },
  { name: 'ซ่อม-RMA ชั้น 1', zone: 'ศูนย์ซ่อม' },
]

// Suppliers สำหรับยืมเครื่องเดโมเพิ่ม
const suppliers = [
  { name: 'Honeywell Thailand', contactName: 'คุณสมศักดิ์', phone: '02-123-4567', email: 'sales@honeywell.co.th' },
  { name: 'Zebra Technologies Thailand', contactName: 'คุณมาลี', phone: '02-234-5678', email: 'sales@zebra.com' },
  { name: 'TSC Auto ID Thailand', contactName: 'คุณวิชัย', phone: '02-345-6789', email: 'info@tsc-autoid.tw' },
]

// Customers พร้อม industry
const customers = [
  { name: 'คุณสมชาย ใจดี', company: 'บจก. ฮิโนะ มอเตอร์ เซลส์', industry: 'Logistics', phone: '081-111-1111' },
  { name: 'คุณมานี รักงาน', company: 'บริษัท Bigbox จำกัด', industry: 'Logistics', phone: '081-222-2222' },
  { name: 'คุณวิภา ส่งของ', company: 'บจก. เอมิโปร โซลูชั่น', industry: 'Retail', phone: '081-333-3333' },
  { name: 'คุณกิตติ พาณิชย์', company: 'ห้างหุ้นส่วนจำกัด กิตติการ์เมนต์', industry: 'Garment', phone: '081-444-4444' },
  { name: 'คุณนภา โลจิสติกส์', company: 'บริษัท นภา ลอจิสติกส์ จำกัด', industry: 'Logistics', phone: '081-555-5555' },
  { name: 'คุณประเสริฐ ค้าวัสดุ', company: 'ร้าน ประเสริฐ วัสดุก่อสร้าง', industry: 'Retail', phone: '081-666-6666' },
  { name: 'คุณอำนาจ โรงพยาบาล', company: 'โรงพยาบาลอินซ์', industry: 'Healthcare', phone: '081-777-7777' },
  { name: 'คุณสมศักดิ์ โรงงาน', company: 'บจก. ไทยแมนูแฟกเจอริ่ง', industry: 'Manufacturing', phone: '081-888-8888' },
]

const salesReps = ['สมหญิง (Sales)', 'วีระ (Sales)', 'ปิยะ (Sales)', 'นันทิดา (Sales)']

const catalogQuantities = [
  { model: 'EDA52-1', qty: 12 },
  { model: 'EDA51', qty: 8 },
  { model: 'TC53', qty: 10 },
  { model: 'DS2208-SR', qty: 15 },
  { model: 'Voyager XP 1470g', qty: 10 },
  { model: 'TH240T', qty: 10 },
  { model: 'ZD420', qty: 8 },
  { model: 'RFD40', qty: 10 },
  { model: 'iPad 10th', qty: 5 },
  { model: 'Galaxy Tab A9', qty: 10 },
]
// Total: 98

const grades = ['A', 'A', 'A', 'A', 'B', 'B', 'C']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function genSerial(brand: string, model: string, idx: number): string {
  const prefix = brand.substring(0, 2).toUpperCase()
  const modelCode = model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()
  const num = String(idx).padStart(6, '0')
  const random = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')
  return `${prefix}${modelCode}-${num}-${random}`
}
function genTagId(idx: number, source: string): string {
  const prefix = source === 'Supplier' ? 'SUP' : source === 'Sales_Stock' ? 'SAL' : 'ACT'
  return `${prefix}-${String(idx).padStart(3, '0')}`
}
function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  console.log('ล้างข้อมูลเดิม...')
  // ลบไฟล์รูปเก่า
  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true })
  }
  fs.mkdirSync(uploadDir, { recursive: true })

  await db.auditItem.deleteMany()
  await db.auditSession.deleteMany()
  await db.returnEventItem.deleteMany()
  await db.returnEvent.deleteMany()
  await db.assetPhoto.deleteMany()
  await db.loanLineItem.deleteMany()
  await db.loanRequestLine.deleteMany()
  await db.waitingList.deleteMany()
  await db.loanTransaction.deleteMany()
  await db.maintenanceTicket.deleteMany()
  await db.assetUnit.deleteMany()
  await db.supplier.deleteMany()
  await db.customer.deleteMany()
  await db.location.deleteMany()
  await db.productCatalog.deleteMany()
  await db.user.deleteMany()

  // === สร้าง Users สำหรับ Auth (4 roles) ===
  console.log('สร้าง Users...')
  const users = [
    { email: 'admin@activeasset.local', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin' },
    { email: 'sales@activeasset.local', password: 'sales123', name: 'สมหญิง (Sales)', role: 'sales' },
    { email: 'store@activeasset.local', password: 'store123', name: 'เจ้าหน้าที่คลัง (Store)', role: 'store' },
    { email: 'manager@activeasset.local', password: 'manager123', name: 'ผจก. คลัง (Manager)', role: 'manager' },
  ]
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10)
    await db.user.create({
      data: {
        email: u.email,
        password: hashed,
        name: u.name,
        role: u.role,
      },
    })
    console.log(`  + ${u.email} / ${u.password} (${u.role})`)
  }

  console.log('สร้าง ProductCatalog...')
  const catalogMap = new Map<string, string>()
  for (const c of catalogs) {
    const created = await db.productCatalog.create({ data: c })
    catalogMap.set(c.model, created.id)
  }

  console.log('สร้าง Location...')
  const locationMap = new Map<string, string>()
  for (const loc of locations) {
    const created = await db.location.create({ data: loc })
    locationMap.set(loc.name, created.id)
  }
  const salesLocId = locationMap.get('คลังขาย (Sales Stock)')!

  console.log('สร้าง Suppliers...')
  const supplierMap = new Map<string, string>()
  for (const s of suppliers) {
    const created = await db.supplier.create({ data: s })
    supplierMap.set(s.name, created.id)
    console.log(`  + ${s.name}`)
  }

  console.log('สร้าง Customers...')
  const customerMap = new Map<string, string>()
  for (const c of customers) {
    const created = await db.customer.create({ data: c })
    customerMap.set(c.company, created.id)
  }

  const defaultLocationByCategory: Record<string, string> = {
    'Mobile Computer': 'Mobile Computer ตู้ A1',
    'Barcode Scanner': 'Barcode Scanner ลังที่ 1',
    'Barcode Printer': 'Barcode Printer ชั้น B1',
    'RFID Reader': 'RFID Reader ตู้ C1',
    'Tablet': 'Tablet ตู้ D1',
  }

  console.log('สร้าง AssetUnit 98 รายการ + source distribution...')
  let counter = 0
  const assetList: { tagId: string; serialNo: string; catalogModel: string; status: string; locationId?: string; source: string }[] = []

  for (const cq of catalogQuantities) {
    const catalogId = catalogMap.get(cq.model)!
    const catalog = catalogs.find(c => c.model === cq.model)!
    const defaultLocName = defaultLocationByCategory[catalog.category]
    const defaultLocId = locationMap.get(defaultLocName)!

    for (let i = 0; i < cq.qty; i++) {
      counter++
      const r = (counter * 7 + 13) % 100
      let status: string
      if (r < 65) status = 'Available'
      else if (r < 83) status = 'On_Loan'
      else if (r < 89) status = 'In_Repair'
      else if (r < 92) status = 'In_Inspection'
      else if (r < 97) status = 'Disposed'
      else status = 'Lost'

      // source: ~85% Demo, ~10% Sales, ~5% Supplier
      const sr = (counter * 11) % 100
      const source = sr < 85 ? 'Demo_Stock' : sr < 95 ? 'Sales_Stock' : 'Supplier'

      const tagId = genTagId(counter, source)
      const serialNo = genSerial(catalog.brand, catalog.model, counter)
      const grade = pick(grades)
      const purchaseDate = daysFromNow(-Math.floor(Math.random() * 800) - 60)
      const warrantyExpireDate = daysFromNow(Math.floor(Math.random() * 600) - 100)

      let locationId: string | undefined = defaultLocId
      if (status === 'On_Loan') locationId = undefined
      else if (status === 'In_Repair' || status === 'In_Inspection') locationId = locationMap.get('ซ่อม-RMA ชั้น 1')!
      else if (status === 'Disposed' || status === 'Lost') locationId = undefined
      else if (source === 'Sales_Stock') locationId = salesLocId
      // Supplier source: ถ้า Available อยู่ที่ "ห้องเดโม ชั้น 2" (รอส่งต่อ), ถ้า On_Loan ไม่มี location

      // Supplier details
      const supplierId = source === 'Supplier'
        ? pick(['Honeywell Thailand', 'Zebra Technologies Thailand', 'TSC Auto ID Thailand'])
        : null
      const supplierIdResolved = supplierId ? supplierMap.get(supplierId) : null
      const supplierLoanStart = source === 'Supplier' ? daysFromNow(-Math.floor(Math.random() * 30)) : null
      const supplierLoanDue = source === 'Supplier' ? daysFromNow(Math.floor(Math.random() * 30) + 7) : null
      // Supplier เครื่องยืมได้สูงสุด 3 ครั้ง
      const maxLoanCount = source === 'Supplier' ? 3 : null
      const loanCount = source === 'Supplier' ? Math.floor(Math.random() * 3) : 0
      const depositPrice = source === 'Supplier' ? Math.floor(Math.random() * 5000) + 1000 : null

      await db.assetUnit.create({
        data: {
          tagId,
          serialNo,
          catalogId,
          source,
          supplierId: supplierIdResolved,
          supplierLoanStart,
          supplierLoanDue,
          depositPrice,
          maxLoanCount,
          loanCount,
          status,
          locationId: locationId ?? null,
          conditionGrade: grade,
          registeredAccessories: catalog.defaultAccessories,
          purchaseDate,
          warrantyExpireDate,
        },
      })
      assetList.push({ tagId, serialNo, catalogModel: cq.model, status, locationId, source })
    }
  }
  console.log(`สร้างทรัพย์สิน ${counter} รายการ (Demo ${assetList.filter(a=>a.source==='Demo_Stock').length}, Sales ${assetList.filter(a=>a.source==='Sales_Stock').length}, Supplier ${assetList.filter(a=>a.source==='Supplier').length})`)

  // === สร้าง Loan Requests + lines ตาม phase ต่างๆ ===
  console.log('สร้าง Loan Transactions หลาย phase...')

  // Phase 1: คำขอใหม่ (Requested) — 2 ใบ
  await createLoanRequest({
    docNoSeed: 1,
    customer: customers[0],
    customerId: customerMap.get(customers[0].company)!,
    salesRep: salesReps[0],
    purpose: 'Demo',
    expectedReturnDate: daysFromNow(14),
    requests: [
      { model: 'EDA52-1', qty: 2 },
      { model: 'DS2208-SR', qty: 1 },
    ],
    status: 'Requested',
  })

  await createLoanRequest({
    docNoSeed: 2,
    customer: customers[1],
    customerId: customerMap.get(customers[1].company)!,
    salesRep: salesReps[1],
    purpose: 'POC',
    expectedReturnDate: daysFromNow(21),
    requests: [
      { model: 'TC53', qty: 2 },
    ],
    status: 'Requested',
  })

  // Phase 2: Dispatching (Store กำลังจัด) — 1 ใบ
  const dispatchingLoan = await createLoanRequest({
    docNoSeed: 3,
    customer: customers[2],
    customerId: customerMap.get(customers[2].company)!,
    salesRep: salesReps[2],
    purpose: 'Demo',
    expectedReturnDate: daysFromNow(10),
    requests: [
      { model: 'TH240T', qty: 1 },
      { model: 'ZD420', qty: 1 },
    ],
    status: 'Dispatching',
    dispatchedBy: 'เจ้าหน้าที่คลัง',
    dispatchedAt: daysFromNow(0),
  })
  // จัดไปแล้ว 1 ใน 2 รายการ
  if (dispatchingLoan) {
    const rlines = await db.loanRequestLine.findMany({ where: { loanDocNo: dispatchingLoan } })
    if (rlines[0]) {
      const cat = await db.productCatalog.findUnique({ where: { id: rlines[0].catalogId } })
      const availAsset = assetList.find(a => a.catalogModel === cat?.model && a.status === 'Available')
      if (availAsset) {
        const catalog = catalogs.find(c => c.model === availAsset.catalogModel)!
        await db.loanLineItem.create({
          data: {
            loanDocNo: dispatchingLoan,
            requestLineId: rlines[0].id,
            assetTagId: availAsset.tagId,
            source: availAsset.source,
            accessoriesHandedOver: catalog.defaultAccessories,
            dispatchedBy: 'เจ้าหน้าที่คลัง',
            dispatchedAt: daysFromNow(0),
            status: 'Out',
          },
        })
        await db.loanRequestLine.update({ where: { id: rlines[0].id }, data: { fulfilledQty: 1 } })
        await db.assetUnit.update({ where: { tagId: availAsset.tagId }, data: { status: 'On_Loan', locationId: null } })
      }
    }
  }

  // Phase 3: Dispatched (รอส่งมอบ) — 1 ใบ
  const dispatchedLoan = await createLoanRequest({
    docNoSeed: 4,
    customer: customers[3],
    customerId: customerMap.get(customers[3].company)!,
    salesRep: salesReps[3],
    purpose: 'Demo',
    expectedReturnDate: daysFromNow(7),
    requests: [
      { model: 'RFD40', qty: 2 },
    ],
    status: 'Dispatched',
    dispatchedBy: 'เจ้าหน้าที่คลัง',
    dispatchedAt: daysFromNow(-1),
  })
  // จัดครบทั้ง 2
  if (dispatchedLoan) {
    const rlines = await db.loanRequestLine.findMany({ where: { loanDocNo: dispatchedLoan } })
    for (const rl of rlines) {
      const cat = await db.productCatalog.findUnique({ where: { id: rl.catalogId } })
      const avail = assetList.filter(a => a.catalogModel === cat?.model && a.status === 'Available').slice(0, rl.quantity)
      for (const a of avail) {
        await db.loanLineItem.create({
          data: {
            loanDocNo: dispatchedLoan,
            requestLineId: rl.id,
            assetTagId: a.tagId,
            source: a.source,
            accessoriesHandedOver: cat?.defaultAccessories ?? '[]',
            dispatchedBy: 'เจ้าหน้าที่คลัง',
            dispatchedAt: daysFromNow(-1),
            status: 'Out',
          },
        })
        await db.assetUnit.update({ where: { tagId: a.tagId }, data: { status: 'On_Loan', locationId: null } })
      }
      await db.loanRequestLine.update({ where: { id: rl.id }, data: { fulfilledQty: avail.length } })
    }
  }

  // Phase 4: Delivered (กำลังยืม) — หลายใบ
  // ใช้เครื่อง On_Loan ที่มีอยู่แล้วสร้างใบยืมแบบ Delivered
  const onLoanAssets = assetList.filter(a => a.status === 'On_Loan')
  let loanCounter = 4
  let customerIdx = 0
  for (let i = 0; i < onLoanAssets.length; i += 2) {
    loanCounter++
    const customer = customers[customerIdx % customers.length]
    customerIdx++
    const salesRep = salesReps[loanCounter % salesReps.length]
    const docNo = `LOAN-202610-${String(loanCounter).padStart(3, '0')}`
    const purpose = i % 5 === 0 ? 'Standby_Repair' : 'Demo'
    const expectedReturnDate = daysFromNow(Math.floor(Math.random() * 14) - 3)
    const isOverdue = expectedReturnDate < new Date()

    await db.loanTransaction.create({
      data: {
        docNo,
        customerId: customerMap.get(customer.company),
        customerName: customer.name,
        customerCompany: customer.company,
        customerIndustry: customer.industry,
        salesRepName: salesRep,
        purpose,
        industry: customer.industry,
        requestedAt: daysFromNow(-Math.floor(Math.random() * 30) - 1),
        expectedReturnDate,
        dispatchedBy: 'เจ้าหน้าที่คลัง',
        dispatchedAt: daysFromNow(-Math.floor(Math.random() * 28) - 1),
        deliveredBy: salesRep,
        deliveredAt: daysFromNow(-Math.floor(Math.random() * 25) - 1),
        customerSignature: null, // ข้อมูลเก่าไม่มีลายเซ็น
        status: isOverdue ? 'Partially_Returned' : 'Delivered', // ทำให้บางใบ overdue จริงๆ คือ Delivered ที่เลยเวลา
        termsAndNotes: 'ผู้ยืมรับผิดชอบความเสียหาย',
      },
    })
    const itemsInLoan = onLoanAssets.slice(i, i + 2)
    for (const asset of itemsInLoan) {
      const catalog = catalogs.find(c => c.model === asset.catalogModel)!
      await db.loanLineItem.create({
        data: {
          loanDocNo: docNo,
          assetTagId: asset.tagId,
          source: asset.source,
          accessoriesHandedOver: catalog.defaultAccessories,
          dispatchedBy: 'เจ้าหน้าที่คลัง',
          dispatchedAt: daysFromNow(-25),
          status: 'Out',
        },
      })
    }
  }

  // Phase 5: คำขอที่ติดคิว (Queued — ขอไม่พอ)
  // สร้างคำขอที่จะติดคิว: TC53 มี 10 ตัว ใช้ไปเยอะ ขอเพิ่มอีก 5
  const queuedLoan = await createLoanRequest({
    docNoSeed: loanCounter + 1,
    customer: customers[4],
    customerId: customerMap.get(customers[4].company)!,
    salesRep: salesReps[0],
    purpose: 'POC',
    expectedReturnDate: daysFromNow(30),
    requests: [
      { model: 'TC53', qty: 5 },
    ],
    status: 'Queued',
  })
  // สร้าง waiting list entry
  if (queuedLoan) {
    const rl = await db.loanRequestLine.findFirst({ where: { loanDocNo: queuedLoan } })
    if (rl) {
      await db.waitingList.create({
        data: {
          loanDocNo: queuedLoan,
          catalogId: rl.catalogId,
          customerName: customers[4].name,
          customerCompany: customers[4].company,
          customerIndustry: customers[4].industry,
          salesRepName: salesReps[0],
          purpose: 'POC',
          quantity: 5,
          position: 1,
          status: 'Waiting',
        },
      })
    }
  }

  // สร้าง waiting list เพิ่มอีก 1 รายการ (ไม่ผูกใบยืม)
  const tc53Catalog = await db.productCatalog.findUnique({ where: { model: 'TC53' } })
  if (tc53Catalog) {
    await db.waitingList.create({
      data: {
        loanDocNo: null,
        catalogId: tc53Catalog.id,
        customerName: customers[5].name,
        customerCompany: customers[5].company,
        customerIndustry: customers[5].industry,
        salesRepName: salesReps[1],
        purpose: 'Demo',
        quantity: 3,
        position: 2,
        status: 'Waiting',
      },
    })
  }

  // === Maintenance Tickets ===
  console.log('สร้าง Maintenance Tickets...')
  const inRepairAssets = assetList.filter(a => a.status === 'In_Repair')
  let ticketNo = 0
  for (const asset of inRepairAssets) {
    ticketNo++
    const rmaNo = `RMA-202610-${String(ticketNo).padStart(3, '0')}`
    await db.maintenanceTicket.create({
      data: {
        ticketNo: rmaNo,
        assetTagId: asset.tagId,
        reason: pick(['หัวอ่านบาร์โค้ดไม่ทำงาน', 'จอภาพไม่แสดงผล', 'ปุ่มกดไม่ตอบสนอง', 'แบตเตอรี่บวม', 'เครื่องไม่บูต']),
        openedAt: daysFromNow(-Math.floor(Math.random() * 30) - 1),
        status: pick(['Open', 'In_Progress']),
        notes: 'ส่งเคลมศูนย์บริการ',
      },
    })
  }

  // === Audit Session ===
  const auditTargetName = 'Barcode Scanner ลังที่ 1'
  const auditLocId = locationMap.get(auditTargetName)!
  const expectedAssets = assetList.filter(a => a.locationId === auditLocId)
  if (expectedAssets.length > 0) {
    const session = await db.auditSession.create({
      data: {
        sessionNo: 'AUDIT-202610-001',
        locationId: auditLocId,
        auditorName: 'ผจก. คลัง',
        startedAt: daysFromNow(-1),
        status: 'In_Progress',
        expectedCount: expectedAssets.length,
        scannedCount: Math.floor(expectedAssets.length / 2),
        notes: 'ตรวจนับกลางเดือน',
      },
    })
    for (const asset of expectedAssets) {
      const wasScanned = Math.random() < 0.5
      await db.auditItem.create({
        data: {
          sessionId: session.id,
          assetTagId: asset.tagId,
          expected: true,
          scanned: wasScanned,
          scannedAt: wasScanned ? daysFromNow(-1) : null,
        },
      })
    }
  }

  console.log('\n✅ Seed v2 เสร็จสมบูรณ์!')
  console.log(`  - Catalogs: ${catalogs.length}`)
  console.log(`  - Locations: ${locations.length}`)
  console.log(`  - Customers: ${customers.length}`)
  console.log(`  - Asset Units: ${counter}`)
  console.log(`  - Loan Transactions: ${loanCounter + 1}`)
  console.log(`  - Waiting List: 2`)
  console.log(`  - Maintenance Tickets: ${ticketNo}`)

  // Helper function (closure)
  async function createLoanRequest(opts: {
    docNoSeed: number
    customer: typeof customers[0]
    customerId: string
    salesRep: string
    purpose: string
    expectedReturnDate: Date
    requests: { model: string; qty: number }[]
    status: string
    dispatchedBy?: string
    dispatchedAt?: Date
  }): Promise<string | null> {
    const docNo = `LOAN-202610-${String(opts.docNoSeed).padStart(3, '0')}`
    await db.loanTransaction.create({
      data: {
        docNo,
        customerId: opts.customerId,
        customerName: opts.customer.name,
        customerCompany: opts.customer.company,
        customerIndustry: opts.customer.industry,
        salesRepName: opts.salesRep,
        purpose: opts.purpose,
        industry: opts.customer.industry,
        requestedAt: daysFromNow(-1),
        expectedReturnDate: opts.expectedReturnDate,
        dispatchedBy: opts.dispatchedBy ?? null,
        dispatchedAt: opts.dispatchedAt ?? null,
        status: opts.status,
        termsAndNotes: 'ผู้ยืมรับผิดชอบความเสียหาย',
      },
    })
    for (const req of opts.requests) {
      const catId = catalogMap.get(req.model)!
      await db.loanRequestLine.create({
        data: {
          loanDocNo: docNo,
          catalogId: catId,
          quantity: req.qty,
          notes: null,
          fulfilledQty: 0,
        },
      })
    }
    console.log(`  + ${docNo} | ${opts.customer.company} | ${opts.status} | ${opts.requests.map(r => `${r.model}×${r.qty}`).join(', ')}`)
    return docNo
  }
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
