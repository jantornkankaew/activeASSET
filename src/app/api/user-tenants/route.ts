import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// GET /api/user-tenants — list tenants ที่ user มีสิทธิ์เข้าถึง
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  // ดึง userTenants + primary tenant
  const [userTenants, user] = await Promise.all([
    db.userTenant.findMany({
      where: { userId },
      include: { tenant: { select: { id: true, name: true, code: true, plan: true, active: true } } },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, activeTenantId: true },
    }),
  ])

  // รวม primary tenant (ถ้าไม่ซ้ำกับ userTenants)
  const tenantsMap = new Map<string, { id: string; name: string; code: string; plan: string; active: boolean; role: string }>()
  for (const ut of userTenants) {
    tenantsMap.set(ut.tenant.id, { ...ut.tenant, role: ut.role })
  }
  // เพิ่ม primary tenant ถ้ามีและไม่ซ้ำ
  if (user?.tenantId) {
    const primary = await db.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, code: true, plan: true, active: true },
    })
    if (primary && !tenantsMap.has(primary.id)) {
      tenantsMap.set(primary.id, { ...primary, role: (session.user as { role?: string }).role || 'sales' })
    }
  }

  return NextResponse.json({
    tenants: Array.from(tenantsMap.values()),
    activeTenantId: user?.activeTenantId || user?.tenantId,
  })
}

// POST /api/user-tenants — admin เพิ่ม user เข้า tenant
export async function POST(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { userId, tenantId, role } = body
  if (!userId || !tenantId) {
    return NextResponse.json({ error: 'ต้องระบุ userId และ tenantId' }, { status: 400 })
  }

  try {
    const created = await db.userTenant.create({
      data: { userId, tenantId, role: role || 'sales' },
      include: { tenant: true },
    })
    return NextResponse.json({ userTenant: created })
  } catch {
    return NextResponse.json({ error: 'เพิ่มไม่สำเร็จ (อาจซ้ำ)' }, { status: 400 })
  }
}
