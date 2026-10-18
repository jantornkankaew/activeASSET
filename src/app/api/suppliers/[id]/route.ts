import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// PATCH /api/suppliers/[id] — update (สิทธิ์: admin, store)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin', 'store')
  if (response) return response

  const { id } = await params
  const body = await request.json()
  const { name, contactName, phone, email, notes } = body
  try {
    const updated = await db.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name?.trim() }),
        ...(contactName !== undefined && { contactName }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(notes !== undefined && { notes }),
      },
    })
    return NextResponse.json({ supplier: updated })
  } catch {
    return NextResponse.json({ error: 'อัปเดตไม่สำเร็จ' }, { status: 400 })
  }
}

// DELETE /api/suppliers/[id] (สิทธิ์: admin เท่านั้น)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin')
  if (response) return response

  const { id } = await params
  // ตรวจว่ามี asset ผูกอยู่ไหม
  const count = await db.assetUnit.count({ where: { supplierId: id } })
  if (count > 0) {
    return NextResponse.json({ error: `มีเครื่อง ${count} รายการผูกกับ supplier นี้ ไม่สามารถลบได้` }, { status: 400 })
  }
  await db.supplier.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
