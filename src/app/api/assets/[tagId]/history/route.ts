import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// GET /api/assets/[tagId]/history — ประวัติการยืม-คืนของเครื่องเดียว
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  const { tagId } = await params

  const asset = await db.assetUnit.findUnique({
    where: { tagId },
    include: {
      catalog: { select: { model: true, brand: true, category: true, defaultAccessories: true } },
      location: { select: { name: true, zone: true } },
      supplier: { select: { name: true, phone: true, contactName: true } },
    },
  })

  if (!asset) {
    return NextResponse.json({ error: 'ไม่พบเครื่อง' }, { status: 404 })
  }

  // ดึง LoanLineItem ทั้งหมดของเครื่องนี้ (ประวัติยืม-คืน)
  const loanLines = await db.loanLineItem.findMany({
    where: { assetTagId: tagId },
    include: {
      loan: {
        select: {
          docNo: true,
          customerName: true,
          customerCompany: true,
          salesRepName: true,
          purpose: true,
          status: true,
          requestedAt: true,
          expectedReturnDate: true,
          deliveredAt: true,
          closedAt: true,
        },
      },
      returnItems: {
        include: {
          returnEvent: {
            select: { returnDate: true, inspectorName: true, notes: true },
          },
        },
      },
    },
    orderBy: { dispatchedAt: 'desc' },
  })

  const history = loanLines.map((line) => {
    const lastReturn = line.returnItems[line.returnItems.length - 1]
    return {
      loanDocNo: line.loan.docNo,
      loanStatus: line.loan.status,
      customerName: line.loan.customerName,
      customerCompany: line.loan.customerCompany,
      salesRepName: line.loan.salesRepName,
      purpose: line.loan.purpose,
      source: line.source,
      dispatchedAt: line.dispatchedAt,
      expectedReturnDate: line.loan.expectedReturnDate,
      deliveredAt: line.loan.deliveredAt,
      returnedAt: line.returnedAt,
      lineStatus: line.status,
      conditionGrade: lastReturn?.conditionGrade || null,
      isDamaged: lastReturn?.isDamaged || false,
      damageDescription: lastReturn?.damageDescription || null,
      comment: lastReturn?.comment || null,
      sendToRepair: lastReturn?.sendToRepair || false,
      inspectorName: lastReturn?.returnEvent.inspectorName || null,
      returnNotes: lastReturn?.returnEvent.notes || null,
    }
  })

  // === Compute aggregated S/N-level rating stats across ALL return events ===
  // (ตัดข้ามหลายใบยืม — คำนวณจากทุก ReturnEventItem ของเครื่องนี้)
  const allReturnItems = loanLines.flatMap((line) => line.returnItems)
  const GRADE_TO_STARS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
  let totalStars = 0
  let totalReviewCount = 0
  const allReviews: Array<{
    loanDocNo: string
    customerName: string
    customerCompany: string | null
    conditionGrade: string
    stars: number
    comment: string | null
    isDamaged: boolean
    damageDescription: string | null
    sendToRepair: boolean
    inspectorName: string
    returnDate: string
  }> = []

  for (const item of allReturnItems) {
    const grade = item.conditionGrade
    if (grade && GRADE_TO_STARS[grade] !== undefined) {
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1
      totalStars += GRADE_TO_STARS[grade]
      totalReviewCount++

      // Find the loan for this item
      const line = loanLines.find((l) => l.returnItems.some((ri) => ri.id === item.id))
      if (line) {
        allReviews.push({
          loanDocNo: line.loan.docNo,
          customerName: line.loan.customerName,
          customerCompany: line.loan.customerCompany,
          conditionGrade: grade,
          stars: GRADE_TO_STARS[grade],
          comment: item.comment || null,
          isDamaged: item.isDamaged,
          damageDescription: item.damageDescription || null,
          sendToRepair: item.sendToRepair,
          inspectorName: item.returnEvent.inspectorName,
          returnDate: item.returnEvent.returnDate,
        })
      }
    }
  }

  // Sort reviews by date desc (most recent first)
  allReviews.sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())

  const averageStars = totalReviewCount > 0 ? totalStars / totalReviewCount : 0

  return NextResponse.json({
    asset: {
      tagId: asset.tagId,
      serialNo: asset.serialNo,
      model: asset.catalog.model,
      brand: asset.catalog.brand,
      category: asset.catalog.category,
      source: asset.source,
      supplierName: asset.supplier?.name || null,
      supplierPhone: asset.supplier?.phone || null,
      supplierContact: asset.supplier?.contactName || null,
      supplierLoanStart: asset.supplierLoanStart,
      supplierLoanDue: asset.supplierLoanDue,
      depositPrice: asset.depositPrice,
      maxLoanCount: asset.maxLoanCount,
      loanCount: asset.loanCount,
      status: asset.status,
      conditionGrade: asset.conditionGrade,
      location: asset.location ? { name: asset.location.name, zone: asset.location.zone } : null,
      purchaseDate: asset.purchaseDate,
      warrantyExpireDate: asset.warrantyExpireDate,
      registeredAccessories: asset.registeredAccessories ? JSON.parse(asset.registeredAccessories) : [],
      defaultAccessories: asset.catalog.defaultAccessories ? JSON.parse(asset.catalog.defaultAccessories) : [],
    },
    history,
    stats: {
      totalLoans: history.length,
      completedLoans: history.filter((h) => h.lineStatus === 'Returned').length,
      activeLoan: history.find((h) => h.lineStatus === 'Out') || null,
      damagedCount: history.filter((h) => h.isDamaged).length,
      repairCount: history.filter((h) => h.sendToRepair).length,
    },
    ratingStats: {
      totalReviews: totalReviewCount,
      averageStars: Number(averageStars.toFixed(2)),
      gradeCounts,
      allReviews,
    },
  })
}
