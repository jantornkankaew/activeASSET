import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCronSecret } from '@/lib/auth/api-guard'
import { sendLineNotification } from '@/lib/notify/line'

// POST /api/cron/overdue-loans — ตรวจใบยืมที่เลยกำหนดคืน + ส่ง LINE แจ้ง Sales
// รันทุกวัน (เช้า) ผ่าน external cron
export async function POST(request: Request) {
  const { ok, response } = requireCronSecret(request)
  if (!ok) return response

  const now = new Date()

  // ใบยืม Delivered/Partially_Returned ที่เลยกำหนดคืน
  const overdueLoans = await db.loanTransaction.findMany({
    where: {
      status: { in: ['Delivered', 'Partially_Returned'] },
      expectedReturnDate: { lt: now },
    },
    include: {
      lines: {
        where: { status: 'Out' },
        include: { asset: { select: { tagId: true, catalog: { select: { model: true, brand: true } } } } },
      },
    },
    orderBy: { expectedReturnDate: 'asc' },
  })

  if (overdueLoans.length === 0) {
    return NextResponse.json({
      ok: true,
      summary: { overdueCount: 0 },
      message: 'ไม่มีใบยืมเลยกำหนดวันนี้',
    })
  }

  // สร้างข้อความ
  let message = `📋 รายงานประจำวัน — ใบยืมเลยกำหนดคืน\n`
  message += `วันที่: ${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}\n\n`
  message += `🚨 มี ${overdueLoans.length} ใบยืมเลยกำหนดคืน:\n\n`

  for (const loan of overdueLoans.slice(0, 20)) { // limit 20 ใบ
    const daysOver = Math.floor((now.getTime() - new Date(loan.expectedReturnDate).getTime()) / (1000 * 60 * 60 * 24))
    message += `• ${loan.docNo} — ${loan.customerName}${loan.customerCompany ? ` (${loan.customerCompany})` : ''}\n`
    message += `  พนักงาน: ${loan.salesRepName} • เลย ${daysOver} วัน\n`
    message += `  เครื่องที่ค้าง: ${loan.lines.map(l => `${l.asset.tagId}`).join(', ')}\n\n`
  }
  if (overdueLoans.length > 20) {
    message += `... และอีก ${overdueLoans.length - 20} ใบ\n\n`
  }
  message += `— ส่งจากระบบ activeASSET (cron)`

  const lineResult = await sendLineNotification(message)

  return NextResponse.json({
    ok: true,
    summary: { overdueCount: overdueLoans.length },
    line: lineResult,
  })
}

// GET — สำหรับทดสอบ
export async function GET(request: Request) {
  const { ok, response } = requireCronSecret(request)
  if (!ok) return response

  const now = new Date()
  const overdueLoans = await db.loanTransaction.findMany({
    where: {
      status: { in: ['Delivered', 'Partially_Returned'] },
      expectedReturnDate: { lt: now },
    },
    include: {
      lines: {
        where: { status: 'Out' },
        include: { asset: { select: { tagId: true, catalog: { select: { model: true, brand: true } } } } },
      },
    },
    orderBy: { expectedReturnDate: 'asc' },
  })

  return NextResponse.json({
    summary: { overdueCount: overdueLoans.length },
    loans: overdueLoans.map((l) => ({
      docNo: l.docNo,
      customerName: l.customerName,
      customerCompany: l.customerCompany,
      salesRepName: l.salesRepName,
      expectedReturnDate: l.expectedReturnDate,
      daysOverdue: Math.floor((now.getTime() - new Date(l.expectedReturnDate).getTime()) / (1000 * 60 * 60 * 24)),
      pendingItems: l.lines.map((line) => ({
        tagId: line.asset.tagId,
        model: line.asset.catalog.model,
      })),
    })),
  })
}
