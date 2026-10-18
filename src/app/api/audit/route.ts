import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth/api-guard'

// GET /api/audit — รายการ audit sessions (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const sessions = await db.auditSession.findMany({
    include: {
      location: { select: { name: true, zone: true } },
      _count: { select: { items: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 50,
  })

  const result = sessions.map((s) => ({
    id: s.id,
    sessionNo: s.sessionNo,
    location: s.location,
    auditorName: s.auditorName,
    startedAt: s.startedAt,
    closedAt: s.closedAt,
    status: s.status,
    expectedCount: s.expectedCount,
    scannedCount: s.scannedCount,
    unexpectedCount: s.unexpectedCount,
    notes: s.notes,
    itemCount: s._count.items,
  }))

  return NextResponse.json({ sessions: result })
}

// POST /api/audit — เริ่ม audit session ใหม่ (สิทธิ์: admin, manager, store)
export async function POST(request: Request) {
  const { response } = await requireRole('admin', 'manager', 'store')
  if (response) return response

  const body = await request.json()
  const { locationId, auditorName, notes } = body

  if (!locationId) {
    return NextResponse.json({ error: 'ต้องระบุจุดจัดเก็บ' }, { status: 400 })
  }
  if (!auditorName?.trim()) {
    return NextResponse.json({ error: 'ต้องระบุชื่อผู้ตรวจนับ' }, { status: 400 })
  }

  // ดึงเครื่องที่ควรอยู่ใน location นี้ (Expected Items)
  const expectedAssets = await db.assetUnit.findMany({
    where: { locationId },
    select: { tagId: true },
  })

  if (expectedAssets.length === 0) {
    return NextResponse.json({ error: 'จุดจัดเก็บนี้ไม่มีเครื่องในระบบ ไม่สามารถตรวจนับได้' }, { status: 400 })
  }

  // สร้าง session no
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastSession = await db.auditSession.findFirst({
    where: { sessionNo: { startsWith: `AUDIT-${ym}-` } },
    orderBy: { sessionNo: 'desc' },
  })
  let seq = 1
  if (lastSession) {
    seq = parseInt(lastSession.sessionNo.split('-')[2], 10) + 1
  }
  const sessionNo = `AUDIT-${ym}-${String(seq).padStart(3, '0')}`

  const session = await db.$transaction(async (tx) => {
    const created = await tx.auditSession.create({
      data: {
        sessionNo,
        locationId,
        auditorName: auditorName.trim(),
        status: 'In_Progress',
        expectedCount: expectedAssets.length,
        scannedCount: 0,
        unexpectedCount: 0,
        notes: notes?.trim() || null,
      },
    })

    for (const a of expectedAssets) {
      await tx.auditItem.create({
        data: {
          sessionId: created.id,
          assetTagId: a.tagId,
          expected: true,
          scanned: false,
        },
      })
    }

    return created
  })

  const created = await db.auditSession.findUnique({
    where: { id: session.id },
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

  return NextResponse.json({ session: created })
}
