import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth/api-guard'

// POST /api/reservations/[id]/convert — แปลง reservation เป็นใบยืม (LoanTransaction)
// ใช้ข้อมูลจาก reservation สร้าง loan + request line + auto-fulfillment ถ้าเป็นไปได้
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRole('admin', 'manager', 'store', 'sales')
  if (response) return response

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { expectedReturnDate, termsAndNotes } = body

  const reservation = await db.reservation.findUnique({
    where: { id },
    include: { catalog: true },
  })
  if (!reservation) {
    return NextResponse.json({ error: 'ไม่พบ reservation' }, { status: 404 })
  }
  if (reservation.status !== 'Approved') {
    return NextResponse.json({ error: `reservation สถานะ ${reservation.status} ไม่สามารถแปลงได้ — ต้องเป็น Approved` }, { status: 400 })
  }

  // ตรวจ availability อีกครั้งก่อน convert
  const totalStock = await db.assetUnit.count({
    where: { catalogId: reservation.catalogId, status: 'Available' },
  })
  if (totalStock < reservation.quantity) {
    return NextResponse.json({
      error: `สต็อกไม่พอ — ต้องการ ${reservation.quantity} แต่มี ${totalStock} ว่าง`,
    }, { status: 400 })
  }

  // สร้าง loan doc number
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastLoan = await db.loanTransaction.findFirst({
    where: { docNo: { startsWith: `LOAN-${ym}-` } },
    orderBy: { docNo: 'desc' },
  })
  let seq = 1
  if (lastLoan) seq = parseInt(lastLoan.docNo.split('-')[2], 10) + 1
  const docNo = `LOAN-${ym}-${String(seq).padStart(3, '0')}`

  // ใช้ endDate ของ reservation เป็น expectedReturnDate ถ้าไม่ระบุ
  const finalReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : reservation.endDate

  // Transaction: สร้าง loan + request line + mark reservation as converted
  const result = await db.$transaction(async (tx) => {
    // สร้าง loan
    const loan = await tx.loanTransaction.create({
      data: {
        docNo,
        tenantId: reservation.tenantId,
        customerId: reservation.customerId,
        customerName: reservation.customerName,
        customerCompany: reservation.customerCompany,
        customerIndustry: reservation.customerIndustry,
        salesRepName: reservation.salesRepName,
        purpose: reservation.purpose,
        industry: reservation.customerIndustry,
        expectedReturnDate: finalReturnDate,
        status: 'Requested',
        termsAndNotes: termsAndNotes || `แปลงจาก reservation ${reservation.resNo}`,
      },
    })

    // สร้าง request line
    const requestLine = await tx.loanRequestLine.create({
      data: {
        loanDocNo: docNo,
        catalogId: reservation.catalogId,
        quantity: reservation.quantity,
        notes: `จาก reservation ${reservation.resNo}`,
        fulfilledQty: 0,
      },
    })

    // Mark reservation as converted
    const updated = await tx.reservation.update({
      where: { id },
      data: {
        status: 'Converted',
        convertedLoanDocNo: docNo,
      },
    })

    return { loan, requestLine, reservation: updated }
  })

  return NextResponse.json({
    ok: true,
    loan: { docNo: result.loan.docNo, status: result.loan.status },
    reservation: { id: result.reservation.id, status: result.reservation.status },
    message: `แปลงเป็นใบยืม ${result.loan.docNo} สำเร็จ — รอ Store จัดของ`,
  })
}
