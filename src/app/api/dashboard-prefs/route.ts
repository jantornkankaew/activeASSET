import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// GET /api/dashboard-prefs — ดึง preferences ของ user ปัจจุบัน
export async function GET() {
  const { response, session } = await requireAuth()
  if (response) return response

  const userId = (session?.user as { id?: string })?.id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  // ดึง preferences — ถ้ายังไม่มี สร้าง default
  let prefs = await db.userDashboardPreference.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
  })

  // Default widgets ถ้ายังไม่มี
  if (prefs.length === 0) {
    const defaults = [
      { widgetKey: 'stats', position: 0, visible: true },
      { widgetKey: 'quickActions', position: 1, visible: true },
      { widgetKey: 'overdue', position: 2, visible: true },
      { widgetKey: 'standby', position: 3, visible: true },
      { widgetKey: 'supplierAlerts', position: 4, visible: true },
      { widgetKey: 'brandDistribution', position: 5, visible: true },
      { widgetKey: 'deadStock', position: 6, visible: true },
    ]
    for (const d of defaults) {
      await db.userDashboardPreference.create({
        data: { userId, ...d },
      })
    }
    prefs = await db.userDashboardPreference.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
    })
  }

  return NextResponse.json({ preferences: prefs })
}

// PATCH /api/dashboard-prefs — อัปเดต preference (toggle visible, reorder, config)
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const body = await request.json()
  const { widgetKey, visible, position, config } = body

  if (!widgetKey) return NextResponse.json({ error: 'ต้องระบุ widgetKey' }, { status: 400 })

  const updated = await db.userDashboardPreference.upsert({
    where: { userId_widgetKey: { userId, widgetKey } },
    create: {
      userId, widgetKey,
      visible: visible ?? true,
      position: position ?? 0,
      config: config ? JSON.stringify(config) : null,
    },
    update: {
      ...(visible !== undefined && { visible }),
      ...(position !== undefined && { position }),
      ...(config !== undefined && { config: JSON.stringify(config) }),
    },
  })

  return NextResponse.json({ preference: updated })
}

// POST /api/dashboard-prefs/reset — reset to defaults
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  await db.userDashboardPreference.deleteMany({ where: { userId } })

  const defaults = [
    { widgetKey: 'stats', position: 0, visible: true },
    { widgetKey: 'quickActions', position: 1, visible: true },
    { widgetKey: 'overdue', position: 2, visible: true },
    { widgetKey: 'standby', position: 3, visible: true },
    { widgetKey: 'supplierAlerts', position: 4, visible: true },
    { widgetKey: 'brandDistribution', position: 5, visible: true },
    { widgetKey: 'deadStock', position: 6, visible: true },
  ]
  for (const d of defaults) {
    await db.userDashboardPreference.create({
      data: { userId, ...d },
    })
  }

  return NextResponse.json({ ok: true, message: 'รีเซ็ตเป็นค่า default แล้ว' })
}
