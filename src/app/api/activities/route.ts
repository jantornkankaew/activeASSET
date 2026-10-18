import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/activities — list recent activities (สำหรับ activity feed)
export async function GET(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '20')

  const activities = await db.activity.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
    },
  })

  return NextResponse.json({
    activities: activities.map(a => ({
      id: a.id,
      userId: a.userId,
      userName: a.user?.name || 'ระบบ',
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      description: a.description,
      createdAt: a.createdAt,
    })),
  })
}

// POST /api/activities — create (internal use)
export async function POST(request: Request) {
  const { response, session } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { action, targetType, targetId, description } = body

  if (!action || !description) {
    return NextResponse.json({ error: 'ต้องระบุ action และ description' }, { status: 400 })
  }

  const userId = (session?.user as { id?: string })?.id
  const created = await db.activity.create({
    data: {
      userId: userId || null,
      action,
      targetType,
      targetId,
      description,
    },
  })

  return NextResponse.json({ activity: created })
}
