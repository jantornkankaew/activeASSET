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
      sendToRepair: lastReturn?.sendToRepair || false,
      inspectorName: lastReturn?.returnEvent.inspectorName || null,
      returnNotes: lastReturn?.returnEvent.notes || null,
    }
  })

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
  })
}
