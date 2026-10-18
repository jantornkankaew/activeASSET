import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth/api-guard'

// GET /api/export/analytics — Export Excel สรุปการวิเคราะห์ (สิทธิ์: admin, manager)
export async function GET() {
  const { response } = await requireRole('admin', 'manager')
  if (response) return response

  const wb = XLSX.utils.book_new()

  // Sheet 1: สรุปทั่วไป
  const allLoans = await db.loanTransaction.findMany({
    select: {
      docNo: true, customerName: true, customerCompany: true, customerIndustry: true,
      salesRepName: true, purpose: true, requestedAt: true, status: true,
      requestLines: { include: { catalog: { select: { model: true, brand: true, category: true } } } },
      lines: { select: { source: true } },
    },
  })

  // Sheet: ความถี่ยืมตามรุ่น
  const modelCount: Record<string, { count: number; brand: string; category: string }> = {}
  for (const loan of allLoans) {
    for (const rl of loan.requestLines) {
      const key = rl.catalog.model
      if (!modelCount[key]) modelCount[key] = { count: 0, brand: rl.catalog.brand, category: rl.catalog.category }
      modelCount[key].count += rl.quantity
    }
  }
  const topModels = Object.entries(modelCount)
    .map(([model, info]) => ({ 'รุ่น': model, 'ยี่ห้อ': info.brand, 'หมวดหมู่': info.category, 'จำนวนครั้งยืม': info.count }))
    .sort((a, b) => b['จำนวนครั้งยืม'] - a['จำนวนครั้งยืม'])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topModels), 'รุ่นยอดนิยม')

  // Sheet: Demand vs Supply
  const catalogs = await db.productCatalog.findMany({
    include: {
      units: { select: { status: true, source: true } },
      requestLines: { select: { quantity: true } },
      waitingList: { where: { status: { in: ['Waiting', 'Notified'] } }, select: { quantity: true } },
    },
  })
  const demandSupply = catalogs.map((c) => {
    const total = c.units.length
    const available = c.units.filter((u) => u.status === 'Available').length
    const onLoan = c.units.filter((u) => u.status === 'On_Loan').length
    const inRepair = c.units.filter((u) => u.status === 'In_Repair').length
    const supplierUnits = c.units.filter((u) => u.source === 'Supplier').length
    const totalRequested = c.requestLines.reduce((s, r) => s + r.quantity, 0)
    const totalWaiting = c.waitingList.reduce((s, w) => s + w.quantity, 0)
    return {
      'รุ่น': c.model,
      'ยี่ห้อ': c.brand,
      'หมวดหมู่': c.category,
      'จำนวนทั้งหมด': total,
      'พร้อมใช้': available,
      'กำลังยืม': onLoan,
      'ส่งซ่อม': inRepair,
      'จาก Supplier': supplierUnits,
      'ยืมรวม (ครั้ง)': totalRequested,
      'ติดคิว': totalWaiting,
      'Utilization %': total > 0 ? ((onLoan / total) * 100).toFixed(0) + '%' : '0%',
      'สถานะ': totalWaiting > 0 ? 'ขาดสต็อก' : (onLoan / Math.max(total, 1)) > 0.8 ? 'ใกล้หมด' : 'พอเพียง',
    }
  }).sort((a, b) => b['ยืมรวม (ครั้ง)'] - a['ยืมรวม (ครั้ง)'])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(demandSupply), 'Demand vs Supply')

  // Sheet: Top ลูกค้า
  const customerCount: Record<string, { count: number; industry: string | null }> = {}
  for (const loan of allLoans) {
    const key = loan.customerCompany || loan.customerName
    if (!customerCount[key]) customerCount[key] = { count: 0, industry: loan.customerIndustry }
    customerCount[key].count += 1
  }
  const topCustomers = Object.entries(customerCount)
    .map(([company, info]) => ({ 'บริษัท': company, 'อุตสาหกรรม': info.industry || '', 'จำนวนครั้งยืม': info.count }))
    .sort((a, b) => b['จำนวนครั้งยืม'] - a['จำนวนครั้งยืม'])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topCustomers), 'Top ลูกค้า')

  // Sheet: ใบยืมทั้งหมด
  const loanRows = allLoans.map((l) => ({
    'เลขที่': l.docNo,
    'สถานะ': l.status,
    'ลูกค้า': l.customerName,
    'บริษัท': l.customerCompany || '',
    'อุตสาหกรรม': l.customerIndustry || '',
    'พนักงาน': l.salesRepName,
    'วัตถุประสงค์': l.purpose,
    'วันที่ขอ': new Date(l.requestedAt).toLocaleDateString('th-TH'),
    'รายการที่ขอ': l.requestLines.map((r) => `${r.catalog.brand} ${r.catalog.model} ×${r.quantity}`).join(', '),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loanRows), 'ใบยืมทั้งหมด')

  // Sheet: Supplier summary
  const suppliers = await db.supplier.findMany({
    include: { assets: { select: { status: true } } },
  })
  const supplierRows = suppliers.map((s) => ({
    'Supplier': s.name,
    'ผู้ติดต่อ': s.contactName || '',
    'เบอร์': s.phone || '',
    'อีเมล': s.email || '',
    'จำนวนเครื่องทั้งหมด': s.assets.length,
    'ใช้งานอยู่': s.assets.filter((a) => a.status === 'Available' || a.status === 'On_Loan').length,
    'คืนแล้ว': s.assets.filter((a) => a.status === 'Returned_To_Supplier').length,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(supplierRows), 'Suppliers')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="analytics-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
