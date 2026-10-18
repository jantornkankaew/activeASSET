import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/audit/[id]/scan — สแกน Tag ID หรือ S/N (สิทธิ์: admin, manager, store)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin', 'manager', 'store')
  if (response) return response

  const { id } = await params
  const body = await request.json()
  const { scanInput } = body // Tag ID หรือ Serial No

  if (!scanInput?.trim()) {
    return NextResponse.json({ error: 'ต้องระบุค่าที่สแกน' }, { status: 400 })
  }

  const session = await db.auditSession.findUnique({
    where: { id },
    include: { items: { include: { asset: true } } },
  })

  if (!session) {
    return NextResponse.json({ error: 'ไม่พบ Audit Session' }, { status: 404 })
  }

  if (session.status === 'Closed') {
    return NextResponse.json({ error: 'Session นี้ปิดไปแล้ว ไม่สามารถสแกนเพิ่มได้' }, { status: 400 })
  }

  const input = scanInput.trim()
  // หา asset ที่ตรงกับ input (Tag ID หรือ Serial No)
  const asset = await db.assetUnit.findFirst({
    where: {
      OR: [{ tagId: input }, { serialNo: input }],
    },
    include: { catalog: { select: { model: true, brand: true } } },
  })

  if (!asset) {
    return NextResponse.json({
      ok: false,
      result: 'unknown',
      message: `ไม่พบเครื่องที่ตรงกับ "${input}" ในระบบ`,
    })
  }

  // หาใน audit items ของ session นี้
  const auditItem = session.items.find((it) => it.assetTagId === asset.tagId)

  if (!auditItem) {
    // unexpected — เครื่องนี้ไม่ได้อยู่ใน expected list ของ location นี้
    const newUnexpected = session.unexpectedCount + 1
    await db.auditSession.update({
      where: { id },
      data: { unexpectedCount: newUnexpected },
    })
    // สร้าง audit item ใหม่ expected=false
    await db.auditItem.create({
      data: {
        sessionId: id,
        assetTagId: asset.tagId,
        expected: false,
        scanned: true,
        scannedAt: new Date(),
        discrepancy: 'unexpected',
      },
    })
    return NextResponse.json({
      ok: true,
      result: 'unexpected',
      asset: { tagId: asset.tagId, serialNo: asset.serialNo, model: asset.catalog.model, brand: asset.catalog.brand },
      message: `⚠️ พบเครื่องไม่คาดฝัน: ${asset.tagId} (${asset.catalog.model}) — เครื่องนี้ไม่ได้อยู่ในทะเบียนของจุดนี้`,
    })
  }

  if (auditItem.scanned) {
    return NextResponse.json({
      ok: true,
      result: 'already_scanned',
      asset: { tagId: asset.tagId, serialNo: asset.serialNo, model: asset.catalog.model, brand: asset.catalog.brand },
      message: `ℹ️ เครื่อง ${asset.tagId} (${asset.catalog.model}) ถูกสแกนไปแล้ว`,
    })
  }

  // mark as scanned
  await db.auditItem.update({
    where: { id: auditItem.id },
    data: { scanned: true, scannedAt: new Date() },
  })

  const newScanned = session.scannedCount + 1
  await db.auditSession.update({
    where: { id },
    data: { scannedCount: newScanned },
  })

  return NextResponse.json({
    ok: true,
    result: 'scanned',
    asset: { tagId: asset.tagId, serialNo: asset.serialNo, model: asset.catalog.model, brand: asset.catalog.brand },
    scannedCount: newScanned,
    expectedCount: session.expectedCount,
    message: `✓ สแกนสำเร็จ: ${asset.tagId} (${asset.catalog.model})`,
  })
}
