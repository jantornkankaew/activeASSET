import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// GET /api/notifications — ดึง notifications ของ user ปัจจุบัน
export async function GET(request: Request) {
  const { response, session } = await requireAuth()
  if (response) return response

  const userId = (session?.user as { id?: string })?.id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unreadOnly') === 'true'
  const limit = parseInt(searchParams.get('limit') || '50')

  const notifications = await db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { read: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const unreadCount = await db.notification.count({
    where: { userId, read: false },
  })

  return NextResponse.json({
    notifications,
    unreadCount,
  })
}

// PATCH /api/notifications — mark as read (single หรือ all)
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const body = await request.json()
  const { id, markAllRead } = body

  if (markAllRead) {
    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ ok: true, message: 'mark all as read' })
  }

  if (id) {
    await db.notification.update({
      where: { id, userId }, // ensure user owns it
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ต้องระบุ id หรือ markAllRead' }, { status: 400 })
}

// POST /api/notifications — create (internal use เช่นจาก API อื่น)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const body = await request.json()
  const { userId, type, title, message, link } = body

  if (!userId || !title || !message) {
    return NextResponse.json({ error: 'ต้องระบุ userId, title, message' }, { status: 400 })
  }

  const created = await db.notification.create({
    data: {
      userId,
      type: type || 'general',
      title,
      message,
      link,
    },
  })
  return NextResponse.json({ notification: created })
}
