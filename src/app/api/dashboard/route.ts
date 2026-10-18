import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthWithReq } from '@/lib/auth/api-guard'

// GET /api/dashboard — สรุปตัวเลขสำหรับ Overview (ต้องล็อกอิน)
export async function GET(req: Request) {
  const { response } = await requireAuthWithReq(req)
  if (response) return response

  const totalAssets = await db.assetUnit.count()
  const available = await db.assetUnit.count({ where: { status: 'Available' } })
  const onLoan = await db.assetUnit.count({ where: { status: 'On_Loan' } })
  const inRepair = await db.assetUnit.count({ where: { status: 'In_Repair' } })
  const inInspection = await db.assetUnit.count({ where: { status: 'In_Inspection' } })
  const lost = await db.assetUnit.count({ where: { status: 'Lost' } })
  const disposed = await db.assetUnit.count({ where: { status: 'Disposed' } })

  // Loans (3-phase)
  const requested = await db.loanTransaction.count({ where: { status: 'Requested' } })
  const dispatching = await db.loanTransaction.count({ where: { status: 'Dispatching' } })
  const dispatched = await db.loanTransaction.count({ where: { status: 'Dispatched' } })
  const delivered = await db.loanTransaction.count({ where: { status: 'Delivered' } })
  const partialLoans = await db.loanTransaction.count({ where: { status: 'Partially_Returned' } })
  const returned = await db.loanTransaction.count({ where: { status: 'Returned' } })
  const queuedLoans = await db.loanTransaction.count({ where: { status: 'Queued' } })

  // active = กำลังยืมจริง (Delivered + Partially_Returned)
  const activeLoans = delivered + partialLoans

  // overdue = Delivered ที่ expectedReturnDate < now
  const overdueLoans = await db.loanTransaction.count({
    where: {
      status: { in: ['Delivered', 'Partially_Returned'] },
      expectedReturnDate: { lt: new Date() },
    },
  })

  // รายการ Overdue
  const overdueLoanList = await db.loanTransaction.findMany({
    where: {
      status: { in: ['Delivered', 'Partially_Returned'] },
      expectedReturnDate: { lt: new Date() },
    },
    include: {
      lines: {
        where: { status: 'Out' },
        include: { asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } } },
      },
    },
    orderBy: { expectedReturnDate: 'asc' },
    take: 20,
  })

  // Standby loans (purpose = Standby_Repair) ที่ยังไม่คืน
  const standbyLoans = await db.loanTransaction.findMany({
    where: {
      purpose: 'Standby_Repair',
      status: { in: ['Delivered', 'Partially_Returned'] },
    },
    include: {
      lines: {
        where: { status: 'Out' },
        include: { asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } } },
      },
    },
    orderBy: { requestedAt: 'asc' },
  })

  // Maintenance tickets
  const openTickets = await db.maintenanceTicket.count({ where: { status: { in: ['Open', 'In_Progress'] } } })

  // Brand distribution
  const allAssets = await db.assetUnit.findMany({
    select: { catalog: { select: { brand: true } }, status: true },
  })
  const brandCount: Record<string, number> = {}
  for (const a of allAssets) {
    brandCount[a.catalog.brand] = (brandCount[a.catalog.brand] || 0) + 1
  }
  const brandDistribution = Object.entries(brandCount)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)

  // Dead stock
  const deadStockAssets = await db.assetUnit.findMany({
    where: {
      status: 'Available',
      loanLines: { none: {} },
    },
    select: { tagId: true, serialNo: true, purchaseDate: true, catalog: { select: { model: true, brand: true } } },
    take: 30,
  })

  return NextResponse.json({
    summary: {
      totalAssets,
      available,
      onLoan,
      inRepair,
      inInspection,
      lost,
      disposed,
      requested,
      dispatching,
      dispatched,
      delivered,
      activeLoans,
      overdueLoans,
      partialLoans,
      returned,
      queuedLoans,
      openTickets,
      deadStockCount: deadStockAssets.length,
    },
    overdueLoans: overdueLoanList.map((l) => ({
      docNo: l.docNo,
      customerName: l.customerName,
      customerCompany: l.customerCompany,
      salesRepName: l.salesRepName,
      purpose: l.purpose,
      requestedAt: l.requestedAt,
      expectedReturnDate: l.expectedReturnDate,
      status: l.status,
      items: l.lines.map((line) => ({
        tagId: line.asset.tagId,
        serialNo: line.asset.serialNo,
        model: line.asset.catalog.model,
        brand: line.asset.catalog.brand,
      })),
    })),
    standbyLoans: standbyLoans.map((l) => ({
      docNo: l.docNo,
      customerName: l.customerName,
      customerCompany: l.customerCompany,
      requestedAt: l.requestedAt,
      expectedReturnDate: l.expectedReturnDate,
      items: l.lines.map((line) => ({
        tagId: line.asset.tagId,
        serialNo: line.asset.serialNo,
        model: line.asset.catalog.model,
        brand: line.asset.catalog.brand,
      })),
    })),
    brandDistribution,
    deadStockAssets,
  })
}
