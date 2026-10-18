import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/api-guard'

// GET /api/suppliers — list ทั้งหมด (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const suppliers = await db.supplier.findMany({
    include: {
      _count: { select: { assets: true } },
    },
    orderBy: { name: 'asc' },
  })
  const result = await Promise.all(suppliers.map(async (s) => {
    // นับยอดยืน-คืนของแต่ละ supplier
    const assets = await db.assetUnit.findMany({
      where: { supplierId: s.id },
      select: { status: true, source: true },
    })
    const active = assets.filter(a => a.status === 'Available' || a.status === 'On_Loan').length
    const returned = assets.filter(a => a.status === 'Returned_To_Supplier').length
    return {
      id: s.id,
      name: s.name,
      contactName: s.contactName,
      phone: s.phone,
      email: s.email,
      notes: s.notes,
      assetCount: s._count.assets,
      activeLoanCount: active,
      returnedCount: returned,
    }
  }))
  return NextResponse.json({ suppliers: result })
}

// POST /api/suppliers — create (สิทธิ์: admin, store)
export async function POST(request: Request) {
  const { response } = await requireRole('admin', 'store')
  if (response) return response

  const body = await request.json()
  const { name, contactName, phone, email, notes } = body
  if (!name?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อ supplier' }, { status: 400 })
  try {
    const created = await db.supplier.create({
      data: { name: name.trim(), contactName, phone, email, notes },
    })
    return NextResponse.json({ supplier: created })
  } catch {
    return NextResponse.json({ error: 'สร้างไม่สำเร็จ (อาจชื่อซ้ำ)' }, { status: 400 })
  }
}
