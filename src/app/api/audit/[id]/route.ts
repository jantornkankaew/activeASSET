import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/audit/[id] — รายละเอียด session (ต้องล็อกอิน)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  const { id } = await params

  const session = await db.auditSession.findUnique({
    where: { id },
    include: {
      location: { select: { name: true, zone: true } },
      items: {
        include: {
          asset: {
            include: {
              catalog: { select: { model: true, brand: true, category: true } },
            },
          },
        },
        orderBy: { asset: { tagId: 'asc' } },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ error: 'ไม่พบ Audit Session' }, { status: 404 })
  }

  return NextResponse.json({ session })
}
