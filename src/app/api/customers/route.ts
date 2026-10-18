import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/customers — list ลูกค้าทั้งหมด (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const customers = await db.customer.findMany({
    include: {
      _count: { select: { loans: true } },
    },
    orderBy: { company: 'asc' },
  })
  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    company: c.company,
    industry: c.industry,
    phone: c.phone,
    loanCount: c._count.loans,
  }))
  return NextResponse.json({ customers: result })
}
