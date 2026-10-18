import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/catalog — รายการรุ่นทั้งหมด (ต้องล็อกอิน)
export async function GET(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const { searchParams } = new URL(request.url)
  const brand = searchParams.get('brand')
  const category = searchParams.get('category')
  const search = searchParams.get('q')?.trim()

  const catalogs = await db.productCatalog.findMany({
    where: {
      ...(brand && brand !== 'all' ? { brand } : {}),
      ...(category && category !== 'all' ? { category } : {}),
      ...(search
        ? {
            OR: [
              { model: { contains: search } },
              { brand: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      units: {
        select: {
          tagId: true,
          status: true,
          conditionGrade: true,
          source: true,
        },
      },
    },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }],
  })

  const result = catalogs.map((c) => {
    const total = c.units.length
    const available = c.units.filter((u) => u.status === 'Available').length
    const onLoan = c.units.filter((u) => u.status === 'On_Loan').length
    const inRepair = c.units.filter((u) => u.status === 'In_Repair').length
    const other = total - available - onLoan - inRepair

    let availabilityLevel: 'green' | 'yellow' | 'red'
    if (available === 0) availabilityLevel = 'red'
    else if (available < total / 2) availabilityLevel = 'yellow'
    else availabilityLevel = 'green'

    return {
      id: c.id,
      model: c.model,
      brand: c.brand,
      category: c.category,
      defaultSpecs: c.defaultSpecs,
      defaultAccessories: c.defaultAccessories ? JSON.parse(c.defaultAccessories) : [],
      total,
      available,
      onLoan,
      inRepair,
      other,
      availabilityLevel,
    }
  })

  return NextResponse.json({ catalogs: result })
}
