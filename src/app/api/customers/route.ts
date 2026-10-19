import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/customers — list ลูกค้าทั้งหมด และรายชื่อพนักงานขายสำหรับ autocomplete (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const [customers, users] = await Promise.all([
    db.customer.findMany({
      include: {
        _count: { select: { loans: true } },
      },
      orderBy: { company: 'asc' },
    }),
    db.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    industry: c.industry,
    phone: c.phone,
    loanCount: c._count.loans,
  }))

  const salesReps = users.map((u) => u.name)

  return NextResponse.json({ customers: result, salesReps })
}
