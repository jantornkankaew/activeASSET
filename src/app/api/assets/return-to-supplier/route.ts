import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/assets/return-to-supplier — ส่งคืน supplier
// สิทธิ์: admin, store
export async function POST(request: Request) {
  const { response } = await requireRole('admin', 'store')
  if (response) return response

  const body = await request.json()
  const { tagId, notes } = body

  if (!tagId) return NextResponse.json({ error: 'ต้องระบุ tagId' }, { status: 400 })

  const asset = await db.assetUnit.findUnique({
    where: { tagId },
    include: { supplier: true },
  })
  if (!asset) return NextResponse.json({ error: 'ไม่พบเครื่อง' }, { status: 404 })
  if (asset.source !== 'Supplier') {
    return NextResponse.json({ error: 'เครื่องนี้ไม่ได้ยืมจาก supplier' }, { status: 400 })
  }
  if (asset.status === 'Returned_To_Supplier') {
    return NextResponse.json({ error: 'เครื่องนี้คืน supplier ไปแล้ว' }, { status: 400 })
  }
  if (asset.status === 'On_Loan') {
    return NextResponse.json({ error: 'เครื่องกำลังยืมอยู่ ไม่สามารถคืน supplier ได้' }, { status: 400 })
  }

  const updated = await db.assetUnit.update({
    where: { tagId },
    data: {
      status: 'Returned_To_Supplier',
      locationId: null, // ออกจากคลังเรา
      notes: notes ? `${asset.notes || ''}\n[คืน Supplier ${new Date().toLocaleString('th-TH')}] ${notes}` : asset.notes,
    },
  })

  return NextResponse.json({
    asset: updated,
    supplier: asset.supplier,
  })
}
