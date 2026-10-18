import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/loans/[docNo]/deliver — ส่งมอบให้ลูกค้า + เซ็นรับ
// สิทธิ์: store, admin, sales (sales ส่งมอบเองได้)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireRole('store', 'admin', 'sales')
  if (response) return response

  const { docNo } = await params
  const body = await request.json()
  const { deliveredBy, customerSignature, customerSignBy } = body

  if (!deliveredBy?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อผู้ส่งมอบ' }, { status: 400 })
  if (!customerSignature || customerSignature.length < 200) {
    return NextResponse.json({ error: 'ลูกค้าต้องลงลายมือชื่อ' }, { status: 400 })
  }

  const loan = await db.loanTransaction.findUnique({
    where: { docNo },
    include: { lines: true },
  })
  if (!loan) return NextResponse.json({ error: 'ไม่พบใบยืม' }, { status: 404 })
  if (loan.status !== 'Dispatched') {
    return NextResponse.json({ error: `ใบยืมสถานะ ${loan.status} ไม่สามารถส่งมอบได้` }, { status: 400 })
  }
  if (loan.lines.length === 0) {
    return NextResponse.json({ error: 'ใบยืมยังไม่ได้จัดเครื่อง ไม่สามารถส่งมอบได้' }, { status: 400 })
  }

  const now = new Date()
  const updated = await db.loanTransaction.update({
    where: { docNo },
    data: {
      status: 'Delivered',
      deliveredBy: deliveredBy.trim(),
      deliveredAt: now,
      customerSignature,
      customerSignAt: now,
      customerSignBy: customerSignBy?.trim() || loan.customerName,
    },
  })

  return NextResponse.json({ loan: { docNo: updated.docNo, status: updated.status } })
}
