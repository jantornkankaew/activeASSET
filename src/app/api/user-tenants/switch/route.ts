import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// POST /api/user-tenants/switch — เปลี่ยน active tenant
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const body = await request.json()
  const { tenantId } = body
  if (!tenantId) {
    return NextResponse.json({ error: 'ต้องระบุ tenantId' }, { status: 400 })
  }

  // ตรวจว่า user มีสิทธิ์เข้าถึง tenant นี้
  const userTenant = await db.userTenant.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  })
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  })

  if (!userTenant && user?.tenantId !== tenantId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง tenant นี้' }, { status: 403 })
  }

  // อัปเดต activeTenantId
  await db.user.update({
    where: { id: userId },
    data: { activeTenantId: tenantId },
  })

  // ถ้ามี userTenant → อัปเดต role ใน session ด้วย (ผ่าน JWT callback)
  const newRole = userTenant?.role || (session.user as { role?: string }).role || 'sales'

  return NextResponse.json({
    ok: true,
    activeTenantId: tenantId,
    role: newRole,
    message: 'สลับ tenant สำเร็จ — กรุณารีเฟรชหน้า',
  })
}
