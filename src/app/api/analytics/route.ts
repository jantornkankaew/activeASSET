import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuthWithReq } from '@/lib/auth/api-guard'

// GET /api/analytics — สรุปสำหรับฝ่ายการตลาด (ต้องล็อกอิน)
export async function GET(req: Request) {
  const { response } = await requireAuthWithReq(req)
  if (response) return response

  // === 1. ความถี่ยืม รายรุ่น (top 10) ===
  const allLoans = await db.loanTransaction.findMany({
    select: {
      docNo: true,
      customerName: true,
      customerCompany: true,
      customerIndustry: true,
      salesRepName: true,
      purpose: true,
      industry: true,
      requestedAt: true,
      status: true,
      requestLines: { include: { catalog: { select: { model: true, brand: true, category: true } } } },
      lines: { select: { assetTagId: true, source: true } },
    },
  })

  // นับจำนวนครั้งที่ยืมต่อรุ่น
  const modelCount: Record<string, { count: number; brand: string; category: string }> = {}
  const categoryCount: Record<string, number> = {}
  const brandCount: Record<string, number> = {}
  const purposeCount: Record<string, number> = {}
  const industryCount: Record<string, number> = {}
  const customerCount: Record<string, { count: number; company: string; industry: string | null }> = {}

  for (const loan of allLoans) {
    // นับ per model (รวมเฉพาะที่มี request)
    for (const rl of loan.requestLines) {
      const key = rl.catalog.model
      if (!modelCount[key]) {
        modelCount[key] = { count: 0, brand: rl.catalog.brand, category: rl.catalog.category }
      }
      modelCount[key].count += rl.quantity
    }
    // per category
    for (const rl of loan.requestLines) {
      categoryCount[rl.catalog.category] = (categoryCount[rl.catalog.category] || 0) + rl.quantity
    }
    // per brand
    for (const rl of loan.requestLines) {
      brandCount[rl.catalog.brand] = (brandCount[rl.catalog.brand] || 0) + rl.quantity
    }
    // purpose
    purposeCount[loan.purpose] = (purposeCount[loan.purpose] || 0) + 1
    // industry
    const ind = loan.customerIndustry || loan.industry || 'Unknown'
    industryCount[ind] = (industryCount[ind] || 0) + 1
    // top customer
    const companyKey = loan.customerCompany || loan.customerName
    if (!customerCount[companyKey]) {
      customerCount[companyKey] = { count: 0, company: companyKey, industry: loan.customerIndustry || loan.industry }
    }
    customerCount[companyKey].count += 1
  }

  // Top models sorted
  const topModels = Object.entries(modelCount)
    .map(([model, info]) => ({ model, ...info }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const categories = Object.entries(categoryCount)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  const brands = Object.entries(brandCount)
    .map(([brand, count]) => ({ brand, count }))
    .sort((a, b) => b.count - a.count)

  const purposes = Object.entries(purposeCount)
    .map(([purpose, count]) => ({ purpose, count }))
    .sort((a, b) => b.count - a.count)

  const industries = Object.entries(industryCount)
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count)

  const topCustomers = Object.values(customerCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // === Demand vs Supply รายรุ่น ===
  const allCatalogs = await db.productCatalog.findMany({
    include: {
      units: { select: { status: true, source: true } },
      requestLines: { select: { quantity: true, fulfilledQty: true } },
      waitingList: { where: { status: { in: ['Waiting', 'Notified'] } }, select: { quantity: true } },
    },
  })
  const demandSupply = allCatalogs.map((c) => {
    const totalUnits = c.units.length
    const available = c.units.filter((u) => u.status === 'Available').length
    const onLoan = c.units.filter((u) => u.status === 'On_Loan').length
    const inRepair = c.units.filter((u) => u.status === 'In_Repair').length
    const supplierUnits = c.units.filter((u) => u.source === 'Supplier').length

    // demand = total requested ในช่วงเวลาทั้งหมด
    const totalRequested = c.requestLines.reduce((s, r) => s + r.quantity, 0)
    const totalWaiting = c.waitingList.reduce((s, w) => s + w.quantity, 0)

    // utilization = onLoan / total
    const utilization = totalUnits > 0 ? (onLoan / totalUnits) * 100 : 0

    // demand score = totalRequested / totalUnits (ถ้า > 1 = ขอเกินสต็อก)
    const demandScore = totalUnits > 0 ? totalRequested / totalUnits : 0

    let status: 'sufficient' | 'tight' | 'shortage'
    if (totalWaiting > 0) status = 'shortage'
    else if (utilization > 80) status = 'tight'
    else status = 'sufficient'

    return {
      model: c.model,
      brand: c.brand,
      category: c.category,
      totalUnits,
      available,
      onLoan,
      inRepair,
      supplierUnits,
      totalRequested,
      totalWaiting,
      utilization: utilization.toFixed(0) + '%',
      demandScore: demandScore.toFixed(2),
      status,
    }
  }).sort((a, b) => b.totalRequested - a.totalRequested)

  // === Trend รายเดือน (last 6 months) ===
  const now = new Date()
  const months: { month: string; count: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const count = allLoans.filter((l) => {
      const rd = new Date(l.requestedAt)
      return rd >= d && rd < next
    }).length
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      count,
      label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
    })
  }

  // === Source distribution (Demo vs Sales vs Supplier) ===
  const allAssets = await db.assetUnit.findMany({ select: { source: true, status: true } })
  const sourceStats = {
    Demo_Stock: allAssets.filter((a) => a.source === 'Demo_Stock').length,
    Sales_Stock: allAssets.filter((a) => a.source === 'Sales_Stock').length,
    Supplier: allAssets.filter((a) => a.source === 'Supplier').length,
  }

  return NextResponse.json({
    summary: {
      totalLoans: allLoans.length,
      activeLoans: allLoans.filter((l) => ['Delivered', 'Dispatched', 'Dispatching', 'Partially_Returned'].includes(l.status)).length,
      completedLoans: allLoans.filter((l) => l.status === 'Returned').length,
      queuedLoans: allLoans.filter((l) => l.status === 'Queued').length,
    },
    topModels,
    categories,
    brands,
    purposes,
    industries,
    topCustomers,
    demandSupply,
    trend: months,
    sourceStats,
  })
}
