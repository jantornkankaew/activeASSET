import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/loans/[docNo]/dispatch — Store หยิบของจริง + สแกน S/N + ถ่ายรูป + เพิ่ม add-on
// สิทธิ์: store, admin
export async function POST(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireRole('store', 'admin')
  if (response) return response

  const { docNo } = await params
  const body = await request.json()
  const { dispatchedBy, items, complete } = body

  if (!dispatchedBy?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อเจ้าหน้าที่จัด' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'ต้องสแกนเครื่องอย่างน้อย 1 เครื่อง' }, { status: 400 })

  const loan = await db.loanTransaction.findUnique({
    where: { docNo },
    include: { requestLines: true, lines: true },
  })
  if (!loan) return NextResponse.json({ error: 'ไม่พบใบยืม' }, { status: 404 })
  if (!['Requested', 'Dispatching', 'Queued'].includes(loan.status)) {
    return NextResponse.json({ error: `ใบยืมสถานะ ${loan.status} ไม่สามารถจัดได้` }, { status: 400 })
  }

  const now = new Date()

  const result = await db.$transaction(async (tx) => {
    // ตรวจเครื่องทุกตัวว่า Available จริง
    const tagIds = items.map((i: { assetTagId: string }) => i.assetTagId)
    const assets = await tx.assetUnit.findMany({ where: { tagId: { in: tagIds } } })
    const notAvailable = assets.filter((a) => a.status !== 'Available')
    if (notAvailable.length > 0) {
      throw new Error(`เครื่อง ${notAvailable.map((a) => a.tagId).join(', ')} ไม่ว่าง`)
    }

    for (const item of items) {
      const asset = assets.find((a) => a.tagId === item.assetTagId)
      if (!asset) continue

      // รวม default + add-on accessories
      const accessories = item.accessoriesHandedOver || []

      const line = await tx.loanLineItem.create({
        data: {
          loanDocNo: docNo,
          requestLineId: item.requestLineId || null,
          assetTagId: item.assetTagId,
          source: item.source || asset.source,
          accessoriesHandedOver: JSON.stringify(accessories),
          conditionPhoto: item.conditionPhoto || null,
          dispatchedBy: dispatchedBy.trim(),
          dispatchedAt: now,
          status: 'Out',
        },
      })

      // บันทึก photos หลายรูป
      if (item.photos && Array.isArray(item.photos)) {
        for (const p of item.photos) {
          await tx.assetPhoto.create({
            data: {
              loanLineItemId: line.id,
              photoPath: p.photoPath,
              caption: p.caption || null,
              takenBy: dispatchedBy.trim(),
            },
          })
        }
      }

      // อัปเดต requestLine.fulfilledQty
      if (item.requestLineId) {
        const rl = loan.requestLines.find((r) => r.id === item.requestLineId)
        if (rl) {
          await tx.loanRequestLine.update({
            where: { id: item.requestLineId },
            data: { fulfilledQty: rl.fulfilledQty + 1 },
          })
        }
      }

      // เปลี่ยนสถานะเครื่องเป็น On_Loan
      await tx.assetUnit.update({
        where: { tagId: item.assetTagId },
        data: { status: 'On_Loan', locationId: null },
      })

      // ตรวจ loanCount — ถ้าเกิน maxLoanCount ให้แจ้งเตือน
      if (asset.maxLoanCount && asset.loanCount >= asset.maxLoanCount) {
        // ยังอนุญาตให้ยืม แต่บันทึก warning ลง notes
        console.warn(`Asset ${asset.tagId} เกิน maxLoanCount (${asset.loanCount}/${asset.maxLoanCount})`)
      }
    }

    // อัปเดต status ใบยืม
    const newStatus = complete ? 'Dispatched' : 'Dispatching'
    const updated = await tx.loanTransaction.update({
      where: { docNo },
      data: {
        status: newStatus,
        dispatchedBy: dispatchedBy.trim(),
        dispatchedAt: now,
      },
    })
    return updated
  })

  return NextResponse.json({ loan: { docNo: result.docNo, status: result.status } })
}
