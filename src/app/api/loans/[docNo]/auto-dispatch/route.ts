import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/loans/[docNo]/auto-dispatch
// Auto-dispatch: หยิบเครื่อง Available อัตโนมัติตาม request lines
// ข้ามขั้นตอน Store scan ด้วยตนเอง — ใช้เมื่อ stock พอและต้องการความเร็ว
export async function POST(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireRole('admin', 'store', 'sales')
  if (response) return response

  const { docNo } = await params
  const body = await request.json().catch(() => ({}))
  const { dispatchedBy } = body

  if (!dispatchedBy?.trim()) {
    return NextResponse.json({ error: 'ต้องระบุชื่อผู้จัด' }, { status: 400 })
  }

  const loan = await db.loanTransaction.findUnique({
    where: { docNo },
    include: {
      requestLines: { include: { catalog: true } },
      lines: true,
    },
  })
  if (!loan) return NextResponse.json({ error: 'ไม่พบใบยืม' }, { status: 404 })
  if (!['Requested', 'Dispatching', 'Queued'].includes(loan.status)) {
    return NextResponse.json({ error: `ใบยืมสถานะ ${loan.status} ไม่สามารถ auto-dispatch ได้` }, { status: 400 })
  }

  const now = new Date()
  const dispatchedItems: Array<{ tagId: string; serialNo: string; model: string; source: string }> = []
  const failures: Array<{ requestLineId: string; model: string; reason: string }> = []

  await db.$transaction(async (tx) => {
    for (const rl of loan.requestLines) {
      const remaining = rl.quantity - rl.fulfilledQty
      if (remaining <= 0) continue

      const available = await tx.assetUnit.findMany({
        where: { catalogId: rl.catalogId, status: 'Available' },
        take: remaining,
      })

      if (available.length < remaining) {
        failures.push({
          requestLineId: rl.id,
          model: rl.catalog.model,
          reason: `ต้องการ ${remaining} แต่มีแค่ ${available.length} ว่าง`,
        })
        continue
      }

      for (const asset of available) {
        const accessories = rl.catalog.defaultAccessories ? JSON.parse(rl.catalog.defaultAccessories) : []
        await tx.loanLineItem.create({
          data: {
            loanDocNo: docNo,
            requestLineId: rl.id,
            assetTagId: asset.tagId,
            source: asset.source,
            accessoriesHandedOver: JSON.stringify(accessories),
            dispatchedBy: dispatchedBy.trim(),
            dispatchedAt: now,
            status: 'Out',
          },
        })
        await tx.assetUnit.update({
          where: { tagId: asset.tagId },
          data: { status: 'On_Loan', locationId: null },
        })
        dispatchedItems.push({
          tagId: asset.tagId,
          serialNo: asset.serialNo,
          model: rl.catalog.model,
          source: asset.source,
        })
      }

      await tx.loanRequestLine.update({
        where: { id: rl.id },
        data: { fulfilledQty: rl.fulfilledQty + available.length },
      })
    }

    // อัปเดต status
    const allFulfilled = await tx.loanRequestLine.findMany({
      where: { loanDocNo: docNo },
      select: { quantity: true, fulfilledQty: true },
    })
    const totalRequested = allFulfilled.reduce((s, r) => s + r.quantity, 0)
    const totalFulfilled = allFulfilled.reduce((s, r) => s + r.fulfilledQty, 0)
    const complete = totalFulfilled >= totalRequested && failures.length === 0

    await tx.loanTransaction.update({
      where: { docNo },
      data: {
        status: complete ? 'Dispatched' : 'Dispatching',
        dispatchedBy: dispatchedBy.trim(),
        dispatchedAt: now,
      },
    })
  })

  return NextResponse.json({
    ok: true,
    docNo,
    dispatchedCount: dispatchedItems.length,
    dispatchedItems,
    failures,
    message: failures.length === 0
      ? `Auto-dispatch สำเร็จ — จัด ${dispatchedItems.length} เครื่อง`
      : `จัดได้ ${dispatchedItems.length} เครื่อง — ${failures.length} รายการไม่สำเร็จ`,
  })
}
