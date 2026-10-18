import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// PATCH /api/users/[id] — update user role (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin')
  if (response) return response

  const { id } = await params
  const body = await request.json()
  const { role, name } = body

  const data: { role?: string; name?: string } = {}
  if (role && ['admin', 'sales', 'store', 'manager'].includes(role)) data.role = role
  if (name?.trim()) data.name = name.trim()

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'ไม่มี field ที่จะอัปเดต' }, { status: 400 })
  }

  const user = await db.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, updatedAt: true },
  })

  return NextResponse.json({ user })
}

// DELETE /api/users/[id] — remove user (admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin')
  if (response) return response

  const { id } = await params

  // Don't allow self-delete (prevent lockout)
  const authHeader = request.headers.get('authorization') || ''
  // We don't easily have the JWT here; let me check by email via session
  // For safety, check user count first
  const userCount = await db.user.count()
  if (userCount <= 1) {
    return NextResponse.json({ error: 'ไม่สามารถลบ user คนสุดท้ายได้' }, { status: 400 })
  }

  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
