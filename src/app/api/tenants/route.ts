import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/api-guard'

// GET /api/tenants — list tenants (admin เท่านั้น)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const tenants = await db.tenant.findMany({
    include: {
      _count: { select: { users: true, assets: true, loans: true, customers: true } },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ tenants: tenants.map(t => ({
    id: t.id, name: t.name, code: t.code, plan: t.plan, active: t.active,
    userCount: t._count.users,
    assetCount: t._count.assets,
    loanCount: t._count.loans,
    customerCount: t._count.customers,
  }))})
}

// POST /api/tenants — create tenant (admin เท่านั้น)
export async function POST(request: Request) {
  const { response } = await requireRole('admin')
  if (response) return response

  const body = await request.json()
  const { name, code, plan } = body
  if (!name?.trim() || !code?.trim()) {
    return NextResponse.json({ error: 'ต้องระบุ name และ code' }, { status: 400 })
  }
  try {
    const created = await db.tenant.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        plan: plan || 'standard',
      },
    })
    return NextResponse.json({ tenant: created })
  } catch {
    return NextResponse.json({ error: 'สร้างไม่สำเร็จ (ชื่อหรือรหัสซ้ำ)' }, { status: 400 })
  }
}
