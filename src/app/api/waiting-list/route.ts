import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/api-guard'

// GET /api/waiting-list — รายการ waiting list (ต้องล็อกอิน)
export async function GET(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const items = await db.waitingList.findMany({
    where: status && status !== 'all' ? { status } : {},
    include: {
      catalog: { select: { model: true, brand: true, category: true } },
    },
    orderBy: [{ catalogId: 'asc' }, { position: 'asc' }],
  })

  // นับ available stock รายรุ่น
  const result: any[] = []
  for (const w of items) {
    const availableCount = await db.assetUnit.count({
      where: { catalogId: w.catalogId, status: 'Available' },
    })
    result.push({
      id: w.id,
      catalogId: w.catalogId,
      model: w.catalog.model,
      brand: w.catalog.brand,
      category: w.catalog.category,
      customerName: w.customerName,
      customerCompany: w.customerCompany,
      customerIndustry: w.customerIndustry,
      salesRepName: w.salesRepName,
      purpose: w.purpose,
      quantity: w.quantity,
      position: w.position,
      status: w.status,
      loanDocNo: w.loanDocNo,
      availableCount,
      canFulfill: availableCount >= w.quantity,
      createdAt: w.createdAt,
      notifiedAt: w.notifiedAt,
      fulfilledAt: w.fulfilledAt,
      fulfilledLoanDocNo: w.fulfilledLoanDocNo,
    })
  }

  return NextResponse.json({ items: result })
}

// POST /api/waiting-list — สร้าง waiting list entry (สิทธิ์: sales, store, admin)
export async function POST(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { catalogId, customerName, customerCompany, customerIndustry, salesRepName, purpose, quantity } = body

  if (!catalogId || !customerName || !quantity) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
  }

  const lastPos = await db.waitingList.findFirst({
    where: { catalogId, status: 'Waiting' },
    orderBy: { position: 'desc' },
  })
  const pos = (lastPos?.position || 0) + 1

  const created = await db.waitingList.create({
    data: {
      catalogId,
      customerName,
      customerCompany,
      customerIndustry,
      salesRepName,
      purpose,
      quantity,
      position: pos,
      status: 'Waiting',
    },
  })

  return NextResponse.json({ item: created })
}

// PATCH /api/waiting-list — ยกเลิกหรือทำเครื่องหมาย fulfilled (สิทธิ์: store, admin, sales)
export async function PATCH(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { id, action, fulfilledLoanDocNo } = body

  const item = await db.waitingList.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  if (action === 'cancel') {
    const updated = await db.waitingList.update({
      where: { id },
      data: { status: 'Cancelled' },
    })
    return NextResponse.json({ item: updated })
  }
  if (action === 'fulfill') {
    const updated = await db.waitingList.update({
      where: { id },
      data: {
        status: 'Fulfilled',
        fulfilledAt: new Date(),
        fulfilledLoanDocNo: fulfilledLoanDocNo || null,
      },
    })
    return NextResponse.json({ item: updated })
  }
  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
}
