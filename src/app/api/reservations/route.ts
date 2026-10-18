import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/api-guard'

// GET /api/reservations — list reservations
export async function GET(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const reservations = await db.reservation.findMany({
    where: status && status !== 'all' ? { status } : {},
    include: {
      catalog: { select: { model: true, brand: true, category: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // คำนวณ availability ในช่วงวันที่จอง
  const result = await Promise.all(reservations.map(async (r) => {
    // หาจำนวนเครื่อง Available ของรุ่นนี้
    const totalStock = await db.assetUnit.count({
      where: { catalogId: r.catalogId, source: 'Demo_Stock' },
    })

    // หาจำนวนที่จองซ้อนทับในช่วงวันเดียวกัน (Approved + Pending อื่นๆ)
    const overlapping = await db.reservation.findMany({
      where: {
        catalogId: r.catalogId,
        status: { in: ['Pending', 'Approved'] },
        id: { not: r.id },
        OR: [
          { startDate: { lte: r.endDate }, endDate: { gte: r.startDate } },
        ],
      },
      select: { quantity: true },
    })
    const overlappingQty = overlapping.reduce((s, o) => s + o.quantity, 0)

    // จำนวนเครื่อง On_Loan ในปัจจุบัน
    const onLoanNow = await db.assetUnit.count({
      where: { catalogId: r.catalogId, status: 'On_Loan' },
    })

    return {
      id: r.id,
      resNo: r.resNo,
      customerName: r.customerName,
      customerCompany: r.customerCompany,
      customerIndustry: r.customerIndustry,
      salesRepName: r.salesRepName,
      purpose: r.purpose,
      catalogId: r.catalogId,
      model: r.catalog.model,
      brand: r.catalog.brand,
      category: r.catalog.category,
      quantity: r.quantity,
      startDate: r.startDate,
      endDate: r.endDate,
      notes: r.notes,
      status: r.status,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt,
      rejectedReason: r.rejectedReason,
      convertedLoanDocNo: r.convertedLoanDocNo,
      createdAt: r.createdAt,
      totalStock,
      overlappingQty,
      onLoanNow,
      availableForDates: Math.max(0, totalStock - onLoanNow - overlappingQty),
      canApprove: r.status === 'Pending' && (totalStock - onLoanNow - overlappingQty) >= r.quantity,
    }
  }))

  return NextResponse.json({ reservations: result })
}

// POST /api/reservations — create new reservation
export async function POST(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const {
    customerName, customerCompany, customerIndustry, salesRepName, purpose,
    catalogId, quantity, startDate, endDate, notes,
  } = body

  if (!customerName?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อลูกค้า' }, { status: 400 })
  if (!catalogId) return NextResponse.json({ error: 'ต้องระบุรุ่นสินค้า' }, { status: 400 })
  if (!quantity || quantity < 1) return NextResponse.json({ error: 'ต้องระบุจำนวน ≥ 1' }, { status: 400 })
  if (!startDate || !endDate) return NextResponse.json({ error: 'ต้องระบุช่วงวันที่' }, { status: 400 })

  if (new Date(startDate) >= new Date(endDate)) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องหลังวันเริ่มต้น' }, { status: 400 })
  }

  // สร้างเลขที่ reservation
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastRes = await db.reservation.findFirst({
    where: { resNo: { startsWith: `RES-${ym}-` } },
    orderBy: { resNo: 'desc' },
  })
  let seq = 1
  if (lastRes) seq = parseInt(lastRes.resNo.split('-')[2], 10) + 1
  const resNo = `RES-${ym}-${String(seq).padStart(3, '0')}`

  // หาหรือสร้าง customer
  let customerId: string | null = null
  if (customerCompany) {
    const existing = await db.customer.findUnique({ where: { company: customerCompany } })
    if (existing) {
      customerId = existing.id
    } else {
      const created = await db.customer.create({
        data: {
          name: customerName,
          company: customerCompany,
          industry: customerIndustry || null,
        },
      })
      customerId = created.id
    }
  }

  // ตรวจ conflict
  const totalStock = await db.assetUnit.count({
    where: { catalogId, source: 'Demo_Stock' },
  })
  const overlapping = await db.reservation.findMany({
    where: {
      catalogId,
      status: { in: ['Pending', 'Approved'] },
      OR: [
        { startDate: { lte: new Date(endDate) }, endDate: { gte: new Date(startDate) } },
      ],
    },
    select: { quantity: true },
  })
  const overlappingQty = overlapping.reduce((s, o) => s + o.quantity, 0)
  const onLoanNow = await db.assetUnit.count({
    where: { catalogId, status: 'On_Loan' },
  })
  const availableForDates = Math.max(0, totalStock - onLoanNow - overlappingQty)
  const hasConflict = availableForDates < quantity

  const created = await db.reservation.create({
    data: {
      resNo,
      customerId,
      customerName: customerName.trim(),
      customerCompany: customerCompany?.trim() || null,
      customerIndustry: customerIndustry || null,
      salesRepName: salesRepName?.trim() || 'ไม่ระบุ',
      purpose: purpose || 'Demo',
      catalogId,
      quantity: parseInt(quantity),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      notes: notes?.trim() || null,
      status: hasConflict ? 'Pending' : 'Approved', // auto-approve ถ้าไม่ conflict
      approvedAt: hasConflict ? null : now,
    },
  })

  return NextResponse.json({
    reservation: { id: created.id, resNo: created.resNo, status: created.status },
    hasConflict,
    availableForDates,
  })
}
