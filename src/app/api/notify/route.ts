import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth/api-guard'

// POST /api/notify — ส่งข้อความแจ้งเตือนให้คนถัดในคิว (ต้องล็อกอิน)
export async function POST(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { waitingListId, message: customMessage } = body

  // ถ้ามี waitingListId → ดึงข้อมูลคิว + อัปเดต status เป็น Notified
  let waitingItem: Awaited<ReturnType<typeof db.waitingList.findUnique>> = null
  let messageText = customMessage || ''

  if (waitingListId) {
    waitingItem = await db.waitingList.findUnique({
      where: { id: waitingListId },
      include: { catalog: { select: { model: true, brand: true } } },
    })
    if (!waitingItem) {
      return NextResponse.json({ error: 'ไม่พบรายการ waiting list' }, { status: 404 })
    }
    if (waitingItem.status === 'Fulfilled') {
      return NextResponse.json({ error: 'รายการนี้จัดให้แล้ว' }, { status: 400 })
    }

    messageText =
      `🔔 แจ้งเตือนคิวยืมสินค้า activeASSET\n\n` +
      `คุณ ${waitingItem.customerName}${waitingItem.customerCompany ? ` (${waitingItem.customerCompany})` : ''}\n` +
      `รุ่นที่ขอยืม: ${waitingItem.catalog.brand} ${waitingItem.catalog.model} × ${waitingItem.quantity}\n` +
      `วัตถุประสงค์: ${waitingItem.purpose}\n` +
      `พนักงานขาย: ${waitingItem.salesRepName}\n\n` +
      `✅ สินค้าที่คุณขอยืมพร้อมแล้ว!\n` +
      `กรุณาติดต่อเจ้าหน้าที่คลังเพื่อนัดรับสินค้า\n\n` +
      `— ส่งจากระบบ activeASSET`
  }

  // ถ้ามี LINE_CHANNEL_ACCESS_TOKEN → ใช้ Messaging API push message
  // รองรับหลายผู้รับ: LINE_TARGET_USER_ID + LINE_BROADCAST_USER_IDS (comma-separated)
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const targetUser = process.env.LINE_TARGET_USER_ID
  const broadcastUsers = (process.env.LINE_BROADCAST_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const allRecipients = [...new Set([targetUser, ...broadcastUsers].filter(Boolean) as string[])]

  if (token && allRecipients.length > 0) {
    const results: Array<{ to: string; ok: boolean; error?: string }> = []
    let allOk = true
    for (const recipient of allRecipients) {
      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            to: recipient,
            messages: [{ type: 'text', text: messageText }],
          }),
        })
        if (!res.ok) {
          const errText = await res.text()
          results.push({ to: recipient, ok: false, error: errText })
          allOk = false
        } else {
          results.push({ to: recipient, ok: true })
        }
      } catch (e: unknown) {
        results.push({ to: recipient, ok: false, error: e instanceof Error ? e.message : '' })
        allOk = false
      }
    }

    // อัปเดต status เป็น Notified เสมอ (ถ้าส่งอย่างน้อย 1 คนสำเร็จ)
    if (waitingItem && results.some(r => r.ok)) {
      await db.waitingList.update({
        where: { id: waitingItem.id },
        data: { status: 'Notified', notifiedAt: new Date() },
      })
    }

    if (allOk) {
      return NextResponse.json({
        ok: true,
        sent: true,
        channel: 'messaging-api',
        recipientCount: allRecipients.length,
      })
    } else {
      // ส่งบางคนสำเร็จ — ส่งกลับ share URL ด้วยเผื่อ client ต้องการส่งเอง
      return NextResponse.json({
        ok: true,
        sent: true,
        partial: true,
        channel: 'messaging-api',
        recipientCount: results.filter(r => r.ok).length,
        totalCount: allRecipients.length,
        failures: results.filter(r => !r.ok),
        shareUrl: `https://line.me/R/share?text=${encodeURIComponent(messageText)}`,
      })
    }
  }

  // ไม่มี LINE config → ส่ง share URL กลับให้ client ใช้ share เอง
  if (waitingItem) {
    await db.waitingList.update({
      where: { id: waitingItem.id },
      data: { status: 'Notified', notifiedAt: new Date() },
    })
  }
  return NextResponse.json({
    ok: true,
    sent: false,
    channel: 'share',
    message: messageText,
    shareUrl: `https://line.me/R/share?text=${encodeURIComponent(messageText)}`,
  })
}

// GET /api/notify/auto-return — ตรวจเครื่อง Supplier ที่ใกล้ครบกำหนดคืน (ต้องล็อกอิน)
export async function GET() {
  const { response } = await requireAuth()
  if (response) return response

  const now = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(now.getDate() + 30)

  // เครื่อง Supplier ที่ยังไม่คืน + ใกล้ถึงวันครบกำหนด (within 30 days) หรือเลยกำหนดแล้ว
  const dueSoon = await db.assetUnit.findMany({
    where: {
      source: 'Supplier',
      status: { in: ['Available', 'On_Loan', 'In_Inspection'] },
      supplierLoanDue: { lte: thirtyDaysFromNow },
    },
    include: {
      catalog: { select: { model: true, brand: true } },
      supplier: { select: { name: true, phone: true, contactName: true } },
    },
    orderBy: { supplierLoanDue: 'asc' },
  })

  const overdue = dueSoon.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) < now)
  const dueWithin7Days = dueSoon.filter((a) => a.supplierLoanDue && new Date(a.supplierLoanDue) >= now)

  // เครื่องที่ยืมเกิน maxLoanCount
  const overLoanCount = await db.assetUnit.findMany({
    where: {
      maxLoanCount: { not: null },
      loanCount: { gte: 3 }, // approximation — Prisma ไม่ support direct compare ระหว่าง fields
      source: 'Supplier',
      status: { not: 'Returned_To_Supplier' },
    },
    include: {
      catalog: { select: { model: true, brand: true } },
      supplier: { select: { name: true } },
    },
  })
  // filter จริงๆ ใน JS
  const overLoanFiltered = overLoanCount.filter((a) => a.maxLoanCount !== null && a.loanCount >= a.maxLoanCount)

  return NextResponse.json({
    overdue: overdue.map((a) => ({
      tagId: a.tagId,
      serialNo: a.serialNo,
      model: a.catalog.model,
      brand: a.catalog.brand,
      supplierName: a.supplier?.name || '',
      supplierPhone: a.supplier?.phone || '',
      supplierContact: a.supplier?.contactName || '',
      supplierLoanDue: a.supplierLoanDue,
      daysOverdue: a.supplierLoanDue ? Math.floor((now.getTime() - new Date(a.supplierLoanDue).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      depositPrice: a.depositPrice,
      status: a.status,
    })),
    dueSoon: dueWithin7Days.map((a) => ({
      tagId: a.tagId,
      serialNo: a.serialNo,
      model: a.catalog.model,
      brand: a.catalog.brand,
      supplierName: a.supplier?.name || '',
      supplierPhone: a.supplier?.phone || '',
      supplierContact: a.supplier?.contactName || '',
      supplierLoanDue: a.supplierLoanDue,
      daysUntilDue: a.supplierLoanDue ? Math.ceil((new Date(a.supplierLoanDue).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      depositPrice: a.depositPrice,
      status: a.status,
    })),
    overLoanCount: overLoanFiltered.map((a) => ({
      tagId: a.tagId,
      serialNo: a.serialNo,
      model: a.catalog.model,
      brand: a.catalog.brand,
      supplierName: a.supplier?.name || '',
      loanCount: a.loanCount,
      maxLoanCount: a.maxLoanCount,
      status: a.status,
    })),
    summary: {
      overdueCount: overdue.length,
      dueSoonCount: dueWithin7Days.length,
      overLoanCount: overLoanFiltered.length,
    },
  })
}
