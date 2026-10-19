import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/assets/quick-register — ลงทะเบียนด่วนสำหรับยืมจาก Supplier/คลังขาย
// สิทธิ์: store, admin
export async function POST(request: Request) {
  const { response } = await requireRole('store', 'admin')
  if (response) return response

  const body = await request.json()
  const {
    catalogId, serialNo, source, supplierId,
    supplierLoanStart, supplierLoanDue, depositPrice, maxLoanCount,
    conditionGrade, registeredAccessories, notes,
  } = body

  if (!catalogId) return NextResponse.json({ error: 'ต้องระบุรุ่นสินค้า' }, { status: 400 })
  if (!serialNo?.trim()) return NextResponse.json({ error: 'ต้องระบุ Serial Number' }, { status: 400 })
  if (!['Supplier', 'Sales_Stock'].includes(source)) {
    return NextResponse.json({ error: 'Quick register ใช้ได้เฉพาะ Supplier หรือ Sales_Stock' }, { status: 400 })
  }
  if (source === 'Supplier' && !supplierId) {
    return NextResponse.json({ error: 'ต้องระบุ supplier สำหรับ source=Supplier' }, { status: 400 })
  }

  // ตรวจ serial ซ้ำ
  const exist = await db.assetUnit.findFirst({ where: { serialNo } })
  if (exist) return NextResponse.json({ error: `Serial Number ${serialNo} มีอยู่แล้ว` }, { status: 400 })

  // สร้าง Tag ID อัตโนมัติ: SUP-YYYYMMDD-XXX หรือ SAL-YYYYMMDD-XXX
  const now = new Date()
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const prefix = source === 'Supplier' ? 'SUP' : 'SAL'
  // หา running number ของวันนี้
  const todayPrefix = `${prefix}-${ymd}-`
  const todayCount = await db.assetUnit.count({ where: { tagId: { startsWith: todayPrefix } } })
  const tagId = `${todayPrefix}${String(todayCount + 1).padStart(3, '0')}`

  // หา location (Supplier → ไม่มี location ชั่วคราว, Sales_Stock → คลังขาย)
  let locationId: string | null = null
  if (source === 'Sales_Stock') {
    const salesLoc = await db.location.findFirst({ where: { name: { contains: 'คลังขาย' } } })
    locationId = salesLoc?.id || null
  }

  const created = await db.assetUnit.create({
    data: {
      tagId,
      serialNo: serialNo.trim(),
      catalogId,
      source,
      supplierId: supplierId || null,
      supplierLoanStart: supplierLoanStart ? new Date(supplierLoanStart) : (source === 'Supplier' ? now : null),
      supplierLoanDue: supplierLoanDue ? new Date(supplierLoanDue) : null,
      depositPrice: depositPrice ? parseFloat(depositPrice) : null,
      maxLoanCount: maxLoanCount ? parseInt(maxLoanCount) : (source === 'Supplier' ? 3 : null),
      loanCount: 0,
      status: 'Available',
      locationId,
      conditionGrade: conditionGrade || 'A',
      registeredAccessories: registeredAccessories ? JSON.stringify(registeredAccessories) : null,
      notes: notes || `Quick register จาก DispatchSheet — ${now.toLocaleString('th-TH')}`,
    },
    include: {
      catalog: { select: { model: true, brand: true, category: true, defaultAccessories: true } },
      location: { select: { name: true, zone: true } },
      supplier: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    asset: {
      tagId: created.tagId,
      serialNo: created.serialNo,
      model: created.catalog.model,
      brand: created.catalog.brand,
      category: created.catalog.category,
      source: created.source,
      supplierId: created.supplierId,
      supplierName: created.supplier?.name || null,
      supplierLoanStart: created.supplierLoanStart,
      supplierLoanDue: created.supplierLoanDue,
      depositPrice: created.depositPrice,
      maxLoanCount: created.maxLoanCount,
      loanCount: created.loanCount,
      status: created.status,
      conditionGrade: created.conditionGrade,
      location: created.location ? { name: created.location.name, zone: created.location.zone } : null,
      registeredAccessories: created.registeredAccessories ? JSON.parse(created.registeredAccessories) : [],
      defaultAccessories: created.catalog.defaultAccessories ? JSON.parse(created.catalog.defaultAccessories) : [],
    },
  })
}
