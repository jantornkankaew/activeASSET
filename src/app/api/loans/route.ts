import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthWithReq } from '@/lib/auth/api-guard'

// สร้างคำขอยืมใหม่ (Phase 1: Sales ขอเป็นรุ่น + จำนวน)
// ถ้าขอไม่พอ → status = Queued + สร้าง WaitingList entry อัตโนมัติ
// สิทธิ์: sales, store, admin (ทุกคนที่ล็อกอินยกเว้น manager ที่ดูอย่างเดียว)
export async function POST(request: Request) {
  const { response, user, session } = await requireAuthWithReq(request)
  if (response) return response

  const body = await request.json()
  const {
    customerName, customerCompany, customerIndustry,
    salesRepName, purpose, expectedReturnDate, termsAndNotes,
    items, // [{ catalogId, quantity, notes }]
    actualRequesterName,
  } = body

  const actualUser = user?.name || (session?.user as { name?: string })?.name || actualRequesterName || 'ไม่ระบุ'
  const actualUserId = user?.id || (session?.user as { id?: string })?.id || null

  if (!customerName?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อลูกค้า' }, { status: 400 })
  if (!salesRepName?.trim()) return NextResponse.json({ error: 'ต้องระบุชื่อพนักงาน' }, { status: 400 })
  if (!expectedReturnDate) return NextResponse.json({ error: 'ต้องระบุวันกำหนดคืน' }, { status: 400 })
  if (!items?.length) return NextResponse.json({ error: 'ต้องเพิ่มรายการขอยืมอย่างน้อย 1 รายการ' }, { status: 400 })

  // สร้างเลขที่เอกสาร
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastLoan = await db.loanTransaction.findFirst({
    where: { docNo: { startsWith: `LOAN-${ym}-` } },
    orderBy: { docNo: 'desc' },
  })
  let seq = 1
  if (lastLoan) seq = parseInt(lastLoan.docNo.split('-')[2], 10) + 1
  const docNo = `LOAN-${ym}-${String(seq).padStart(3, '0')}`

  // หาหรือสร้าง customer
  let customerId: string | null = null
  if (customerCompany) {
    const existing = await db.customer.findFirst({ where: { company: customerCompany } })
    if (existing) {
      customerId = existing.id
    } else {
      const created = await db.customer.create({
        data: {
          name: customerName,
          company: customerCompany,
          industry: customerIndustry || null,
        },
      })
      customerId = created.id
    }
  }

  // ตรวจ availability รายรุ่น
  const availabilityCheck: {
    catalogId: string
    model: string
    brand: string
    requestedQty: number
    availableQty: number
    shortfall: number
  }[] = []
  for (const item of items) {
    const catalog = await db.productCatalog.findUnique({ where: { id: item.catalogId } })
    if (!catalog) continue
    const availableCount = await db.assetUnit.count({
      where: { catalogId: item.catalogId, status: 'Available' },
    })
    availabilityCheck.push({
      catalogId: item.catalogId,
      model: catalog.model,
      brand: catalog.brand,
      requestedQty: item.quantity,
      availableQty: availableCount,
      shortfall: Math.max(0, item.quantity - availableCount),
    })
  }
  const hasShortfall = availabilityCheck.some(a => a.shortfall > 0)
  const status = hasShortfall ? 'Queued' : 'Requested'

  const loan = await db.$transaction(async (tx) => {
    // บันทึก audit note หากผู้ยืมที่ระบุไม่ตรงกับผู้ล็อกอินจริง
    let finalTermsAndNotes = termsAndNotes?.trim() || null
    if (actualUser && salesRepName.trim() !== actualUser && actualUser !== 'ไม่ระบุ') {
      const auditTag = `[ผู้บันทึกระบบ: ${actualUser}]`
      finalTermsAndNotes = finalTermsAndNotes ? `${finalTermsAndNotes}\n${auditTag}` : auditTag
    }

    const created = await tx.loanTransaction.create({
      data: {
        docNo,
        customerId,
        customerName: customerName.trim(),
        customerCompany: customerCompany?.trim() || null,
        customerIndustry: customerIndustry || null,
        salesRepName: salesRepName.trim(),
        purpose,
        industry: customerIndustry || null,
        expectedReturnDate: new Date(expectedReturnDate),
        status,
        termsAndNotes: finalTermsAndNotes,
      },
    })

    // บันทึก Log การสร้างเอกสารลงตาราง Activity
    await tx.activity.create({
      data: {
        userId: actualUserId,
        action: 'create_loan',
        targetType: 'Loan',
        targetId: docNo,
        description: `สร้างคำขอยืม ${docNo} ให้กับ ${customerCompany?.trim() || customerName.trim()} (ผู้ยืม: ${salesRepName.trim()} | บันทึกจริงโดย: ${actualUser})`,
      },
    })

    for (const item of items) {
      const rl = await tx.loanRequestLine.create({
        data: {
          loanDocNo: docNo,
          catalogId: item.catalogId,
          quantity: item.quantity,
          notes: item.notes || null,
          fulfilledQty: 0,
        },
      })
      // ถ้า shortfall > 0 สร้าง Reservation (origin=auto_queue) แทน WaitingList
      const av = availabilityCheck.find(a => a.catalogId === item.catalogId)
      if (av && av.shortfall > 0) {
        // สร้าง Reservation แทน WaitingList — รวมระบบเดียว
        const resYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
        const lastRes = await tx.reservation.findFirst({
          where: { resNo: { startsWith: `RES-${resYm}-` } },
          orderBy: { resNo: 'desc' },
        })
        let resSeq = 1
        if (lastRes) resSeq = parseInt(lastRes.resNo.split('-')[2], 10) + 1
        const resNo = `RES-${resYm}-${String(resSeq).padStart(3, '0')}`

        // startDate = วันนี้, endDate = expectedReturnDate
        await tx.reservation.create({
          data: {
            resNo,
            tenantId: customerId ? null : null, // tenantId จะถูก set ที่หลังถ้ามี
            customerId: customerId || null,
            customerName: customerName.trim(),
            customerCompany: customerCompany?.trim() || null,
            customerIndustry: customerIndustry || null,
            salesRepName: salesRepName.trim(),
            purpose,
            catalogId: item.catalogId,
            quantity: av.shortfall,
            startDate: now,
            endDate: new Date(expectedReturnDate),
            notes: `สร้างอัตโนมัติจากใบยืม ${docNo} (ขอไม่พอ ${av.shortfall} ชิ้น)`,
            origin: 'auto_queue',
            sourceLoanDocNo: docNo,
            status: 'Pending',
          },
        })
      }
    }

    return created
  })

  return NextResponse.json({
    loan: { docNo: loan.docNo, status: loan.status },
    availability: availabilityCheck,
    queued: hasShortfall,
  })
}

// GET /api/loans — list ทั้งหมด พร้อม phase filter (ต้องล็อกอิน)
export async function GET(request: Request) {
  const { response } = await requireAuthWithReq(request)
  if (response) return response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('q')?.trim()

  const loans = await db.loanTransaction.findMany({
    where: {
      ...(status && status !== 'all' ? { status } : {}),
      ...(search ? {
        OR: [
          { docNo: { contains: search } },
          { customerName: { contains: search } },
          { customerCompany: { contains: search } },
        ],
      } : {}),
    },
    include: {
      requestLines: {
        include: { catalog: { select: { model: true, brand: true, category: true } } },
      },
      lines: {
        include: {
          asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } },
        },
      },
      _count: { select: { returnEvents: true } },
    },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  })

  const result = loans.map((l) => {
    const totalRequested = l.requestLines.reduce((s, r) => s + r.quantity, 0)
    const totalFulfilled = l.requestLines.reduce((s, r) => s + r.fulfilledQty, 0)
    const returnedItems = l.lines.filter((x) => x.status === 'Returned').length
    return {
      docNo: l.docNo,
      customerName: l.customerName,
      customerCompany: l.customerCompany,
      customerIndustry: l.customerIndustry,
      salesRepName: l.salesRepName,
      purpose: l.purpose,
      industry: l.industry,
      requestedAt: l.requestedAt,
      expectedReturnDate: l.expectedReturnDate,
      dispatchedAt: l.dispatchedAt,
      deliveredAt: l.deliveredAt,
      closedAt: l.closedAt,
      status: l.status,
      termsAndNotes: l.termsAndNotes,
      customerSignedAt: l.customerSignAt,
      customerSignedBy: l.customerSignBy,
      totalRequested,
      totalFulfilled,
      totalDispatched: l.lines.length,
      returnedItems,
      pendingItems: l.lines.length - returnedItems,
      requestLines: l.requestLines.map((rl) => ({
        id: rl.id,
        catalogId: rl.catalogId,
        model: rl.catalog.model,
        brand: rl.catalog.brand,
        category: rl.catalog.category,
        quantity: rl.quantity,
        fulfilledQty: rl.fulfilledQty,
        notes: rl.notes,
      })),
      lines: l.lines.map((line) => ({
        id: line.id,
        assetTagId: line.asset.tagId,
        serialNo: line.asset.serialNo,
        model: line.asset.catalog.model,
        brand: line.asset.catalog.brand,
        source: line.source,
        status: line.status,
        returnedAt: line.returnedAt,
        conditionPhoto: line.conditionPhoto,
        accessoriesHandedOver: line.accessoriesHandedOver
          ? (() => { try { return JSON.parse(line.accessoriesHandedOver) } catch { return [] } })()
          : [],
      })),
    }
  })

  return NextResponse.json({ loans: result })
}
