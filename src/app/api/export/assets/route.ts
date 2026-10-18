import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { requireRole } from '@/lib/auth/api-guard'

// GET /api/export/assets — Export Excel ของทรัพย์สินทั้งหมด (สิทธิ์: admin, manager)
export async function GET(request: Request) {
  const { response } = await requireRole('admin', 'manager')
  if (response) return response

  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  const status = searchParams.get('status')

  const assets = await db.assetUnit.findMany({
    where: {
      ...(source && source !== 'all' ? { source } : {}),
      ...(status && status !== 'all' ? { status } : {}),
    },
    include: {
      catalog: { select: { model: true, brand: true, category: true } },
      location: { select: { name: true, zone: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { tagId: 'asc' },
  })

  const rows = assets.map((a) => ({
    'Tag ID': a.tagId,
    'Serial Number': a.serialNo,
    'ยี่ห้อ': a.catalog.brand,
    'รุ่น': a.catalog.model,
    'หมวดหมู่': a.catalog.category,
    'Source': a.source === 'Demo_Stock' ? 'คลังเดโม' : a.source === 'Sales_Stock' ? 'คลังขาย' : 'ยืมจาก Supplier',
    'Supplier': a.supplier?.name || '',
    'วันที่ยืมจาก Supplier': a.supplierLoanStart ? new Date(a.supplierLoanStart).toLocaleDateString('th-TH') : '',
    'กำหนดคืน Supplier': a.supplierLoanDue ? new Date(a.supplierLoanDue).toLocaleDateString('th-TH') : '',
    'ราคามัดจำ': a.depositPrice || 0,
    'ยืมครั้งที่': a.loanCount,
    'ยืมสูงสุด': a.maxLoanCount || '',
    'สถานะ': a.status,
    'เกรดสภาพ': a.conditionGrade || '',
    'ที่ตั้ง': a.location?.name || '',
    'โซน': a.location?.zone || '',
    'วันที่ซื้อ': a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('th-TH') : '',
    'รับประกันถึง': a.warrantyExpireDate ? new Date(a.warrantyExpireDate).toLocaleDateString('th-TH') : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length + 2, 12) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ทรัพย์สิน')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="assets-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
