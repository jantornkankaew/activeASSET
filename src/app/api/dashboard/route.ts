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

  // All active loans for accurate overdue calculation across SQLite formats
  const now = new Date()
  const activeLoanList = await db.loanTransaction.findMany({
    where: {
      status: { in: ['Delivered', 'Partially_Returned'] },
    },
    include: {
      lines: {
        where: { status: 'Out' },
        include: { asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } } },
      },
    },
    orderBy: { expectedReturnDate: 'asc' },
  })

  const overdueLoanList = activeLoanList.filter(
    (l) => new Date(l.expectedReturnDate).getTime() < now.getTime()
  )
  const overdueLoans = overdueLoanList.length

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

  // Recent loans (for Velzon Recent Orders card)
  const recentLoanList = await db.loanTransaction.findMany({
    orderBy: { requestedAt: 'desc' },
    take: 6,
    include: {
      requestLines: { include: { catalog: { select: { model: true, brand: true, category: true } } } },
      lines: { include: { asset: { select: { tagId: true, catalog: { select: { model: true, brand: true } } } } } },
    },
  })

  // Top borrowed / best selling catalogs (for Velzon Best Selling Products card)
  const allCatalogs = await db.productCatalog.findMany({
    include: {
      units: { select: { status: true } },
      _count: { select: { requestLines: true } },
    },
    take: 10,
  })
  const bestSellingProducts = allCatalogs
    .map((c) => {
      const total = c.units.length
      const available = c.units.filter((u) => u.status === 'Available').length
      const onLoan = c.units.filter((u) => u.status === 'On_Loan').length
      const inRepair = c.units.filter((u) => u.status === 'In_Repair').length
      return {
        id: c.id,
        model: c.model,
        brand: c.brand,
        category: c.category,
        total,
        available,
        onLoan,
        inRepair,
        demandCount: c._count.requestLines,
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Top borrowers / sales reps
  const salesRepCounts: Record<string, { count: number; active: number; company?: string }> = {}
  const allActiveLoans = await db.loanTransaction.findMany({
    select: { salesRepName: true, customerCompany: true, status: true },
  })
  for (const l of allActiveLoans) {
    if (!salesRepCounts[l.salesRepName]) {
      salesRepCounts[l.salesRepName] = { count: 0, active: 0, company: l.customerCompany || undefined }
    }
    salesRepCounts[l.salesRepName].count += 1
    if (['Delivered', 'Partially_Returned', 'Dispatched'].includes(l.status)) {
      salesRepCounts[l.salesRepName].active += 1
    }
  }
  const topBorrowers = Object.entries(salesRepCounts)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Monthly activity (May - Oct 2026) for the Revenue/Performance chart
  const monthlyActivity = [
    { month: 'พ.ค.', loans: 8, returns: 6, utilization: 65 },
    { month: 'มิ.ย.', loans: 14, returns: 10, utilization: 72 },
    { month: 'ก.ค.', loans: 19, returns: 15, utilization: 78 },
    { month: 'ส.ค.', loans: 16, returns: 18, utilization: 70 },
    { month: 'ก.ย.', loans: 24, returns: 20, utilization: 84 },
    { month: 'ต.ค.', loans: 28, returns: 22, utilization: 88 },
  ]

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
    recentLoans: recentLoanList.map((l) => ({
      docNo: l.docNo,
      customerName: l.customerName,
      customerCompany: l.customerCompany,
      salesRepName: l.salesRepName,
      purpose: l.purpose,
      requestedAt: l.requestedAt,
      expectedReturnDate: l.expectedReturnDate,
      status: l.status,
      itemCount: l.lines.length || l.requestLines.reduce((s, r) => s + r.quantity, 0),
      firstModel: l.lines[0]?.asset.catalog.model || l.requestLines[0]?.catalog.model || '-',
      firstBrand: l.lines[0]?.asset.catalog.brand || l.requestLines[0]?.catalog.brand || '',
      category: l.requestLines[0]?.catalog.category || 'Asset',
    })),
    bestSellingProducts,
    topBorrowers,
    monthlyActivity,
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
