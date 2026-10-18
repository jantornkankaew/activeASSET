// Tenant Context — ใช้สำหรับ Multi-tenant filtering
// ใน production ควร inject tenantId จาก session.user.tenantId หรือ activeTenantId

import { db } from '@/lib/db'

export interface TenantInfo {
  id: string
  name: string
  code: string
}

// ดึง tenantId ของ user (ใช้ activeTenantId ถ้ามี, ไม่งั้นใช้ tenantId)
export async function getUserTenantId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, activeTenantId: true },
  })
  return user?.activeTenantId || user?.tenantId || null
}

// ดึงข้อมูล tenant ที่ user มีสิทธิ์เข้าถึง
export async function getUserTenants(userId: string): Promise<TenantInfo[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      tenantId: true,
      tenant: { select: { id: true, name: true, code: true } },
    },
  })
  if (!user) return []
  // ในเวอร์ชันง่าย: user เข้าถึง tenant เดียว (tenantId)
  // TODO: เพิ่ม UserTenant many-to-many ถ้าต้องการหลาย tenant
  return user.tenant ? [user.tenant] : []
}

// สร้าง tenant-aware where clause
export function tenantFilter(tenantId: string | null) {
  if (!tenantId) return {} // ไม่กรองถ้าไม่มี tenant (backward compat)
  return { tenantId }
}
