import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/locations — รายการสถานที่จัดเก็บ (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const locations = await db.location.findMany({
    include: {
      _count: { select: { assets: true } },
    },
    orderBy: [{ zone: 'asc' }, { name: 'asc' }],
  })

  const result = locations.map((l) => ({
    id: l.id,
    name: l.name,
    zone: l.zone,
    assetCount: l._count.assets,
  }))

  return NextResponse.json({ locations: result })
}
