import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/audit/[id]/close — ปิด audit session (สิทธิ์: admin, manager, store)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin', 'manager', 'store')
  if (response) return response

  const { id } = await params

  const session = await db.auditSession.findUnique({ where: { id } })
  if (!session) {
    return NextResponse.json({ error: 'ไม่พบ Audit Session' }, { status: 404 })
  }
  if (session.status === 'Closed') {
    return NextResponse.json({ error: 'Session นี้ปิดไปแล้ว' }, { status: 400 })
  }

  const updated = await db.auditSession.update({
    where: { id },
    data: { status: 'Closed', closedAt: new Date() },
  })

  return NextResponse.json({ session: updated })
}
