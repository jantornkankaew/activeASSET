import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth/api-guard'

// GET /api/export/loans — Export Excel ของใบยืมทั้งหมด (สิทธิ์: admin, manager)
export async function GET(request: Request) {
  const { response } = await requireRole('admin', 'manager')
  if (response) return response

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const loans = await db.loanTransaction.findMany({
    where: status && status !== 'all' ? { status } : {},
    include: {
      requestLines: { include: { catalog: { select: { model: true, brand: true } } } },
      lines: { include: { asset: { select: { tagId: true, serialNo: true, catalog: { select: { model: true, brand: true } } } } } },
    },
    orderBy: { requestedAt: 'desc' },
  })

  const rows = loans.map((l) => {
    const totalRequested = l.requestLines.reduce((s, r) => s + r.quantity, 0)
    const totalFulfilled = l.requestLines.reduce((s, r) => s + r.fulfilledQty, 0)
    const returnedItems = l.lines.filter((x) => x.status === 'Returned').length
    return {
      'เลขที่ใบยืม': l.docNo,
      'สถานะ': l.status,
      'ลูกค้า': l.customerName,
      'บริษัท': l.customerCompany || '',
      'อุตสาหกรรม': l.customerIndustry || '',
      'พนักงานขาย': l.salesRepName,
      'วัตถุประสงค์': l.purpose,
      'วันที่ขอยืม': new Date(l.requestedAt).toLocaleDateString('th-TH'),
      'กำหนดคืน': new Date(l.expectedReturnDate).toLocaleDateString('th-TH'),
      'วันที่จัดของ': l.dispatchedAt ? new Date(l.dispatchedAt).toLocaleDateString('th-TH') : '',
      'วันที่ส่งมอบ': l.deliveredAt ? new Date(l.deliveredAt).toLocaleDateString('th-TH') : '',
      'วันที่ปิดใบยืม': l.closedAt ? new Date(l.closedAt).toLocaleDateString('th-TH') : '',
      'ขอยืม (ชิ้น)': totalRequested,
      'จัดได้ (ชิ้น)': totalFulfilled,
      'จัดจริง (ชิ้น)': l.lines.length,
      'คืนแล้ว (ชิ้น)': returnedItems,
      'ค้างคืน (ชิ้น)': l.lines.length - returnedItems,
      'ลูกค้าเซ็นรับ': l.customerSignAt ? 'เซ็นแล้ว' : 'ยังไม่เซ็น',
      'รายการที่ขอ': l.requestLines.map((r) => `${r.catalog.brand} ${r.catalog.model} × ${r.quantity}`).join(', '),
      'เครื่องที่จัด': l.lines.map((x) => `${x.asset.tagId} (${x.asset.catalog.brand} ${x.asset.catalog.model})`).join(', '),
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  // ปรับ column widths
  const colsWidth = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 15) }))
  ws['!cols'] = colsWidth
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ใบยืม')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="loans-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
