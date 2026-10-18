import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// POST /api/push/subscribe — บันทึก push subscription (จาก browser)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const body = await request.json()
  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'subscription ไม่ถูกต้อง' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent') || null

  // upsert (ถ้า endpoint ซ้ำ → update)
  const created = await db.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint } },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    },
  })

  return NextResponse.json({ ok: true, id: created.id })
}

// DELETE /api/push/subscribe — ยกเลิก subscription
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'no user id' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  if (!endpoint) {
    return NextResponse.json({ error: 'ต้องระบุ endpoint' }, { status: 400 })
  }

  await db.pushSubscription.deleteMany({
    where: { userId, endpoint },
  })

  return NextResponse.json({ ok: true })
}

// GET /api/push/subscribe — ดึง VAPID public key + สถานะ subscription
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id

  const publicKey = process.env.VAPID_PUBLIC_KEY || ''
  const hasVapid = !!publicKey && !!process.env.VAPID_PRIVATE_KEY

  let subscriptionCount = 0
  if (userId) {
    subscriptionCount = await db.pushSubscription.count({ where: { userId } })
  }

  return NextResponse.json({
    publicKey,
    hasVapid,
    subscriptionCount,
  })
}
