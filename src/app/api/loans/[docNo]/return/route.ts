import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/loans/[docNo]/return — รับคืน (รองรับ source-based return)
// สิทธิ์: store, admin
export async function POST(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireRole('store', 'admin')
  if (response) return response

  const { docNo } = await params
  const body = await request.json()
  const {
    inspectorName, inspectorSignature, notes,
    items, // [{ loanLineItemId, conditionGrade, accessoriesReturned, isDamaged, damageDescription, sendToRepair, returnToSource, nextLocationId }]
  } = body

  if (!inspectorName?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อเจ้าหน้าที่' }, { status: 400 })
  if (!inspectorSignature || inspectorSignature.length < 200) {
    return NextResponse.json({ error: 'เจ้าหน้าที่ต้องลงลายมือชื่อ' }, { status: 400 })
  }
  if (!items?.length) return NextResponse.json({ error: 'ต้องเลือกเครื่องที่จะรับคืน' }, { status: 400 })

  const loan = await db.loanTransaction.findUnique({
    where: { docNo },
    include: { lines: true },
  })
  if (!loan) return NextResponse.json({ error: 'ไม่พบใบยืม' }, { status: 404 })

  const now = new Date()

  const result = await db.$transaction(async (tx) => {
    const returnEvent = await tx.returnEvent.create({
      data: {
        loanDocNo: docNo,
        returnDate: now,
        inspectorName: inspectorName.trim(),
        inspectorSignature,
        inspectorSignAt: now,
        notes: notes?.trim() || null,
      },
    })

    for (const item of items) {
      const line = loan.lines.find((l) => l.id === item.loanLineItemId)
      if (!line || line.status === 'Returned') continue

      await tx.returnEventItem.create({
        data: {
          returnEventId: returnEvent.id,
          loanLineItemId: item.loanLineItemId,
          conditionGrade: item.conditionGrade,
          accessoriesReturned: JSON.stringify(item.accessoriesReturned || []),
          isDamaged: !!item.isDamaged,
          damageDescription: item.damageDescription?.trim() || null,
          comment: item.comment?.trim() || null,
          sendToRepair: !!item.sendToRepair,
          returnToSource: item.returnToSource !== false,
          nextLocationId: item.nextLocationId || null,
        },
      })

      // === Create AssetPhoto records for return review photos (if any) ===
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        // Find the just-created ReturnEventItem ID
        const createdItem = await tx.returnEventItem.findFirst({
          where: {
            returnEventId: returnEvent.id,
            loanLineItemId: item.loanLineItemId,
          },
          orderBy: { id: 'desc' },
          select: { id: true },
        })
        if (createdItem) {
          for (const photo of item.photos) {
            if (photo.path) {
              await tx.assetPhoto.create({
                data: {
                  loanLineItemId: item.loanLineItemId,
                  returnEventItemId: createdItem.id,
                  photoPath: photo.path,
                  caption: photo.caption || null,
                  takenBy: inspectorName.trim(),
                },
              })
            }
          }
        }
      }

      await tx.loanLineItem.update({
        where: { id: item.loanLineItemId },
        data: { status: 'Returned', returnedAt: now },
      })

      // หา location สำหรับคืน
      let returnLocationId: string | null = null

      if (item.sendToRepair) {
        // ส่งซ่อม
        await tx.assetUnit.update({
          where: { tagId: line.assetTagId },
          data: { status: 'In_Repair', conditionGrade: item.conditionGrade },
        })
        // สร้าง RMA ticket
        const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
        const lastTicket = await tx.maintenanceTicket.findFirst({
          where: { ticketNo: { startsWith: `RMA-${ym}-` } },
          orderBy: { ticketNo: 'desc' },
        })
        let seq = 1
        if (lastTicket) seq = parseInt(lastTicket.ticketNo.split('-')[2], 10) + 1
        const rmaNo = `RMA-${ym}-${String(seq).padStart(3, '0')}`
        await tx.maintenanceTicket.create({
          data: {
            ticketNo: rmaNo,
            assetTagId: line.assetTagId,
            loanDocNo: docNo,
            reason: item.damageDescription || `Grade ${item.conditionGrade}`,
            status: 'Open',
            notes: `รับคืนจาก ${docNo}`,
          },
        })
      } else {
        // คืนตาม source ต้นทาง
        const asset = await tx.assetUnit.findUnique({
          where: { tagId: line.assetTagId },
        })
        const source = item.returnToSource === false ? 'Demo_Stock' : (asset?.source || 'Demo_Stock')

        if (source === 'Supplier') {
          // คืน Supplier → status = Returned_To_Supplier, locationId = null
          await tx.assetUnit.update({
            where: { tagId: line.assetTagId },
            data: {
              status: 'Returned_To_Supplier',
              conditionGrade: item.conditionGrade,
              locationId: null,
            },
          })
        } else {
          // หา location ตาม source
          if (item.nextLocationId) {
            returnLocationId = item.nextLocationId
          } else if (source === 'Sales_Stock') {
            const salesLoc = await tx.location.findFirst({ where: { name: { contains: 'คลังขาย' } } })
            returnLocationId = salesLoc?.id || null
          } else {
            // Demo_Stock → คืนตาม category default location
            const cat = await tx.productCatalog.findUnique({
              where: { id: asset?.catalogId || '' },
              select: { category: true },
            })
            const catLocMap: Record<string, string> = {
              'Mobile Computer': 'Mobile Computer ตู้ A1',
              'Barcode Scanner': 'Barcode Scanner ลังที่ 1',
              'Barcode Printer': 'Barcode Printer ชั้น B1',
              'RFID Reader': 'RFID Reader ตู้ C1',
              'Tablet': 'Tablet ตู้ D1',
            }
            const locName = catLocMap[cat?.category || '']
            if (locName) {
              const loc = await tx.location.findFirst({ where: { name: locName } })
              returnLocationId = loc?.id || null
            }
          }

          await tx.assetUnit.update({
            where: { tagId: line.assetTagId },
            data: {
              status: 'Available',
              conditionGrade: item.conditionGrade,
              locationId: returnLocationId,
              // เพิ่ม loanCount เมื่อคืนเสร็จ (เพราะยืมไป 1 รอบสมบูรณ์)
              loanCount: { increment: 1 },
            },
          })
        }
      }
    }

    // อัปเดต status ใบยืม
    const remaining = await tx.loanLineItem.count({
      where: { loanDocNo: docNo, status: 'Out' },
    })
    let newStatus: string
    if (remaining === 0) {
      // ตรวจดูว่าเคยถูกส่งมอบหรือไม่
      newStatus = loan.deliveredAt ? 'Returned' : 'Returned'
    } else {
      newStatus = loan.deliveredAt ? 'Partially_Returned' : 'Dispatching'
    }
    const closedAt = remaining === 0 ? now : null
    const updated = await tx.loanTransaction.update({
      where: { docNo },
      data: { status: newStatus, closedAt },
    })

    // === Auto-notify pending reservations (รวม Waiting List เดิม) ===
    if (remaining === 0 || newStatus === 'Partially_Returned') {
      const returnedCatalogIds = new Set<string>()
      for (const item of items) {
        const line = loan.lines.find((l) => l.id === item.loanLineItemId)
        if (line) {
          const asset = await tx.assetUnit.findUnique({
            where: { tagId: line.assetTagId },
            select: { catalogId: true },
          })
          if (asset) returnedCatalogIds.add(asset.catalogId)
        }
      }
      for (const catId of returnedCatalogIds) {
        const availableCount = await tx.assetUnit.count({
          where: { catalogId: catId, status: 'Available' },
        })
        // หา pending reservations ของรุ่นนี้ (เรียงตาม createdAt = ก่อน-หลัง)
        const pending = await tx.reservation.findMany({
          where: { catalogId: catId, status: 'Pending', origin: 'auto_queue' },
          orderBy: { createdAt: 'asc' },
        })
        let remainingAvail = availableCount
        for (const r of pending) {
          if (remainingAvail >= r.quantity) {
            await tx.reservation.update({
              where: { id: r.id },
              data: { status: 'Notified', notifiedAt: now },
            })
            remainingAvail -= r.quantity
          }
        }
      }
    }

    return { returnEvent, loanStatus: updated.status, remaining }
  })

  return NextResponse.json({
    returnEvent: { id: result.returnEvent.id },
    loanStatus: result.loanStatus,
    remaining: result.remaining,
  })
}
