import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'
import bcrypt from 'bcryptjs'

// GET /api/users — list all team members (admin only)
export async function GET() {
  const { response } = await requireRole('admin')
  if (response) return response

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tenantId: true,
      activeTenantId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          activities: true,
          notifications: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const result = await Promise.all(users.map(async (u) => {
    const loanCount = await db.loanTransaction.count({
      where: { salesRepName: u.name },
    })
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: u.tenantId,
      activeTenantId: u.activeTenantId,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      stats: {
        activities: u._count.activities,
        notifications: u._count.notifications,
        loans: loanCount,
      },
    }
  }))

  return NextResponse.json({ users: result })
}

// POST /api/users — create new team member (admin only)
export async function POST(request: Request) {
  const { response } = await requireRole('admin')
  if (response) return response

  const body = await request.json()
  const { name, email, password, role } = body

  if (!name?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อ' }, { status: 400 })
  if (!email?.trim()) return NextResponse.json({ error: 'ต้องระบุ email' }, { status: 400 })
  if (!password?.trim() || password.length < 4) return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' }, { status: 400 })
  if (!['admin', 'sales', 'store', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'role ต้องเป็น admin/sales/store/manager' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) return NextResponse.json({ error: 'email นี้ถูกใช้แล้ว' }, { status: 409 })

  const hashed = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashed,
      role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  })

  return NextResponse.json({ user })
}
