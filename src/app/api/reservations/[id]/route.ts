import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// PATCH /api/reservations/[id] — approve/reject/cancel/convert
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { action, approvedBy, rejectedReason, convertedLoanDocNo } = body

  const item = await db.reservation.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'ไม่พบ reservation' }, { status: 404 })

  const now = new Date()

  if (action === 'approve') {
    const { response } = await requireRole('admin', 'manager', 'store')
    if (response) return response
    const updated = await db.reservation.update({
      where: { id },
      data: { status: 'Approved', approvedBy: approvedBy || 'Admin', approvedAt: now },
    })
    return NextResponse.json({ reservation: updated })
  }

  if (action === 'reject') {
    const { response } = await requireRole('admin', 'manager', 'store')
    if (response) return response
    const updated = await db.reservation.update({
      where: { id },
      data: { status: 'Rejected', rejectedReason: rejectedReason || null },
    })
    return NextResponse.json({ reservation: updated })
  }

  if (action === 'cancel') {
    const { response } = await requireRole('admin', 'manager', 'store', 'sales')
    if (response) return response
    const updated = await db.reservation.update({
      where: { id },
      data: { status: 'Cancelled' },
    })
    return NextResponse.json({ reservation: updated })
  }

  if (action === 'convert') {
    const { response } = await requireRole('admin', 'manager', 'store', 'sales')
    if (response) return response
    const updated = await db.reservation.update({
      where: { id },
      data: { status: 'Converted', convertedLoanDocNo: convertedLoanDocNo || null },
    })
    return NextResponse.json({ reservation: updated })
  }

  return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
}
