import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/loans/[docNo] — รายละเอียดเต็ม (ต้องล็อกอิน)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  const { docNo } = await params

  const loan = await db.loanTransaction.findUnique({
    where: { docNo },
    include: {
      customer: true,
      requestLines: {
        include: { catalog: true },
      },
      lines: {
        include: {
          asset: {
            include: {
              catalog: { select: { model: true, brand: true, category: true, defaultAccessories: true } },
              location: { select: { name: true } },
            },
          },
          photos: true,
          returnItems: {
            include: { returnEvent: { select: { returnDate: true, inspectorName: true, inspectorSignAt: true } } },
          },
        },
      },
      returnEvents: {
        include: {
          items: {
            include: {
              loanLineItem: {
                include: { asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } } },
              },
              photos: true,  // รูปถ่ายของเครื่องตอนรับคืน (returnEventItemId link)
            },
          },
        },
        orderBy: { returnDate: 'desc' },
      },
      waitingList: true,
    },
  })

  if (!loan) return NextResponse.json({ error: 'ไม่พบใบยืม' }, { status: 404 })

  const safeParse = (v: unknown): string[] => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') {
      try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
    }
    return []
  }

  const loanParsed = {
    ...loan,
    requestLines: loan.requestLines.map((rl) => ({
      ...rl,
      catalog: {
        ...rl.catalog,
        defaultAccessories: safeParse(rl.catalog.defaultAccessories),
      },
    })),
    lines: loan.lines.map((l) => ({
      ...l,
      accessoriesHandedOver: safeParse(l.accessoriesHandedOver),
      asset: {
        ...l.asset,
        registeredAccessories: safeParse(l.asset.registeredAccessories),
        catalog: {
          ...l.asset.catalog,
          defaultAccessories: safeParse(l.asset.catalog.defaultAccessories),
        },
      },
    })),
    returnEvents: loan.returnEvents.map((ev) => ({
      ...ev,
      items: ev.items.map((it) => ({
        ...it,
        accessoriesReturned: safeParse(it.accessoriesReturned),
      })),
    })),
  }

  return NextResponse.json({ loan: loanParsed })
}
