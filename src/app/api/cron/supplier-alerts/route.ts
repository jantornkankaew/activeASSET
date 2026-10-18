import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCronSecret } from '@/lib/auth/api-guard'
import { sendLineNotification } from '@/lib/notify/line'

// POST /api/cron/supplier-alerts — ตรวจเครื่อง Supplier ใกล้/เลยกำหนดคืน + ส่ง LINE
// รันทุกวัน (เช้า) ผ่าน cron external service เช่น cron-job.org, Vercel Cron, GitHub Actions
// ตัวอย่าง cron URL: POST https://your-app.com/api/cron/supplier-alerts?secret=xxx
export async function POST(request: Request) {
  const { ok, response } = requireCronSecret(request)
  if (!ok) return response

  const now = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(now.getDate() + 7)

  // ดึงเครื่อง Supplier ที่ต้องแจ้งเตือน
  const assets = await db.assetUnit.findMany({
    where: {
      source: 'Supplier',
      status: { in: ['Available', 'On_Loan', 'In_Inspection'] },
      supplierLoanDue: { lte: sevenDaysFromNow },
    },
    include: {
      catalog: { select: { model: true, brand: true } },
      supplier: { select: { name: true, phone: true, contactName: true } },
    },
    orderBy: { supplierLoanDue: 'asc' },
  })

  const overdue = assets.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) < now)
  const dueSoon = assets.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) >= now)

  // สร้างข้อความสรุป
  let message = `📋 รายงานประจำวัน — Supplier Alerts\n`
  message += `วันที่: ${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}\n\n`

  if (overdue.length > 0) {
    message += `🚨 เลยกำหนดคืน ${overdue.length} เครื่อง:\n`
    for (const a of overdue) {
      const daysOver = Math.floor((now.getTime() - new Date(a.supplierLoanDue!).getTime()) / (1000 * 60 * 60 * 24))
      message += `  • ${a.tagId} ${a.catalog.brand} ${a.catalog.model} (เลย ${daysOver} วัน) → ${a.supplier?.name}\n`
    }
    message += `\n`
  }

  if (dueSoon.length > 0) {
    message += `⏰ ใกล้ครบกำหนดคืน ${dueSoon.length} เครื่อง:\n`
    for (const a of dueSoon) {
      const daysLeft = Math.ceil((new Date(a.supplierLoanDue!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      message += `  • ${a.tagId} ${a.catalog.brand} ${a.catalog.model} (ครบใน ${daysLeft} วัน) → ${a.supplier?.name}\n`
    }
    message += `\n`
  }

  if (overdue.length === 0 && dueSoon.length === 0) {
    message += `✅ ไม่มีเครื่องที่ต้องแจ้งเตือนวันนี้\n`
  }

  message += `\n— ส่งจากระบบ activeASSET (cron)`

  // ส่ง LINE (push หรือ share fallback)
  const result = await sendLineNotification(message)

  return NextResponse.json({
    ok: true,
    summary: {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      total: assets.length,
    },
    line: result,
  })
}

// GET — สำหรับทดสอบดู summary โดยไม่ส่ง LINE
export async function GET(request: Request) {
  const { ok, response } = requireCronSecret(request)
  if (!ok) return response

  const now = new Date()
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(now.getDate() + 7)

  const assets = await db.assetUnit.findMany({
    where: {
      source: 'Supplier',
      status: { in: ['Available', 'On_Loan', 'In_Inspection'] },
      supplierLoanDue: { lte: sevenDaysFromNow },
    },
    include: {
      catalog: { select: { model: true, brand: true } },
      supplier: { select: { name: true, phone: true, contactName: true } },
    },
    orderBy: { supplierLoanDue: 'asc' },
  })

  const overdue = assets.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) < now)
  const dueSoon = assets.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) >= now)

  return NextResponse.json({
    summary: {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      total: assets.length,
    },
    overdue: overdue.map((a) => ({
      tagId: a.tagId,
      model: `${a.catalog.brand} ${a.catalog.model}`,
      supplierName: a.supplier?.name,
      supplierLoanDue: a.supplierLoanDue,
      daysOverdue: Math.floor((now.getTime() - new Date(a.supplierLoanDue!).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    dueSoon: dueSoon.map((a) => ({
      tagId: a.tagId,
      model: `${a.catalog.brand} ${a.catalog.model}`,
      supplierName: a.supplier?.name,
      supplierLoanDue: a.supplierLoanDue,
      daysUntilDue: Math.ceil((new Date(a.supplierLoanDue!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })),
  })
}
