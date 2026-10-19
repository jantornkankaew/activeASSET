import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthWithReq, requireRoleWithReq } from '@/lib/auth/api-guard'

// GET /api/assets — รายการเครื่อง (ต้องล็อกอิน)
export async function GET(request: Request) {
  const { response } = await requireAuthWithReq(request)
  if (response) return response
  const { searchParams } = new URL(request.url)
  const catalogModel = searchParams.get('catalogModel')
  const status = searchParams.get('status')
  const tagId = searchParams.get('tagId')
  const serialNo = searchParams.get('serialNo')
  const locationId = searchParams.get('locationId')
  const source = searchParams.get('source')

  const assets = await db.assetUnit.findMany({
    where: {
      ...(catalogModel ? { catalog: { model: catalogModel } } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(tagId ? { tagId } : {}),
      ...(serialNo ? { serialNo: { contains: serialNo } } : {}),
      ...(locationId ? { locationId } : {}),
      ...(source && source !== 'all' ? { source } : {}),
    },
    include: {
      catalog: {
        select: { model: true, brand: true, category: true, defaultAccessories: true },
      },
      location: { select: { name: true, zone: true } },
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { tagId: 'asc' },
    take: 200,
  })

  const result = assets.map((a) => ({
    tagId: a.tagId,
    serialNo: a.serialNo,
    model: a.catalog.model,
    brand: a.catalog.brand,
    category: a.catalog.category,
    source: a.source,
    supplierId: a.supplierId,
    supplierName: a.supplier?.name || null,
    supplierLoanStart: a.supplierLoanStart,
    supplierLoanDue: a.supplierLoanDue,
    depositPrice: a.depositPrice,
    maxLoanCount: a.maxLoanCount,
    loanCount: a.loanCount,
    status: a.status,
    conditionGrade: a.conditionGrade,
    location: a.location ? { name: a.location.name, zone: a.location.zone } : null,
    registeredAccessories: a.registeredAccessories ? JSON.parse(a.registeredAccessories) : [],
    defaultAccessories: a.catalog.defaultAccessories ? JSON.parse(a.catalog.defaultAccessories) : [],
    purchaseDate: a.purchaseDate,
    warrantyExpireDate: a.warrantyExpireDate,
    catalogId: a.catalogId,
  }))

  return NextResponse.json({ assets: result })
}

// POST /api/assets — ลงทะเบียนสินค้าใหม่ (Admin ใช้ในหน้าจัดการสินค้า)
// สิทธิ์: admin, store
export async function POST(request: Request) {
  const { response } = await requireRoleWithReq(request, 'admin', 'store')
  if (response) return response

  const body = await request.json()
  const {
    tagId, serialNo, catalogId, source, supplierId,
    supplierLoanStart, supplierLoanDue, depositPrice, maxLoanCount,
    locationId, conditionGrade, registeredAccessories,
    purchaseDate, warrantyExpireDate, notes,
  } = body

  if (!tagId?.trim()) return NextResponse.json({ error: 'ต้องระบุ Tag ID' }, { status: 400 })
  if (!serialNo?.trim()) return NextResponse.json({ error: 'ต้องระบุ Serial Number' }, { status: 400 })
  if (!catalogId) return NextResponse.json({ error: 'ต้องระบุรุ่นสินค้า' }, { status: 400 })
  if (source === 'Supplier' && !supplierId) return NextResponse.json({ error: 'source=Supplier ต้องระบุ supplier' }, { status: 400 })

  // ตรวจ serial ซ้ำ
  const existSn = await db.assetUnit.findFirst({ where: { serialNo } })
  if (existSn) return NextResponse.json({ error: `Serial Number ${serialNo} มีอยู่แล้ว` }, { status: 400 })
  const existTag = await db.assetUnit.findUnique({ where: { tagId } })
  if (existTag) return NextResponse.json({ error: `Tag ID ${tagId} มีอยู่แล้ว` }, { status: 400 })

  const created = await db.assetUnit.create({
    data: {
      tagId: tagId.trim(),
      serialNo: serialNo.trim(),
      catalogId,
      source: source || 'Demo_Stock',
      supplierId: supplierId || null,
      supplierLoanStart: supplierLoanStart ? new Date(supplierLoanStart) : null,
      supplierLoanDue: supplierLoanDue ? new Date(supplierLoanDue) : null,
      depositPrice: depositPrice ? parseFloat(depositPrice) : null,
      maxLoanCount: maxLoanCount ? parseInt(maxLoanCount) : (source === 'Supplier' ? 3 : null),
      loanCount: 0,
      status: 'Available',
      locationId: locationId || null,
      conditionGrade: conditionGrade || 'A',
      registeredAccessories: registeredAccessories ? JSON.stringify(registeredAccessories) : null,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyExpireDate: warrantyExpireDate ? new Date(warrantyExpireDate) : null,
      notes: notes || null,
    },
  })

  return NextResponse.json({ asset: created })
}

// PATCH /api/assets — อัปเดต (รวมถึงการ mark return-to-supplier)
// สิทธิ์: admin, store
export async function PATCH(request: Request) {
  const { response } = await requireRoleWithReq(request, 'admin', 'store')
  if (response) return response

  const body = await request.json()
  const { tagId, ...patch } = body
  if (!tagId) return NextResponse.json({ error: 'ต้องระบุ tagId' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  for (const k of ['status', 'conditionGrade', 'locationId', 'source', 'supplierId', 'depositPrice', 'maxLoanCount', 'loanCount', 'notes']) {
    if (k in patch) updateData[k] = patch[k]
  }
  if ('supplierLoanStart' in patch) updateData.supplierLoanStart = patch.supplierLoanStart ? new Date(patch.supplierLoanStart) : null
  if ('supplierLoanDue' in patch) updateData.supplierLoanDue = patch.supplierLoanDue ? new Date(patch.supplierLoanDue) : null

  const updated = await db.assetUnit.update({
    where: { tagId },
    data: updateData,
  })

  return NextResponse.json({ asset: updated })
}
