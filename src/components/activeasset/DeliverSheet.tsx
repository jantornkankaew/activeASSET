'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  LoanStatusBadge, PurposeBadge, SourceBadge,
} from './shared'
import {
  CheckCircle2, MessageCircle, Package, User, ShieldCheck, FileText,
} from 'lucide-react'
import {
  formatThaiDate, getPurposeLabel,
} from '@/lib/activeasset-constants'

interface LoanLineItem {
  id: string
  assetTagId: string
  serialNo: string
  model: string
  brand: string
  source: string
  status: string
  conditionPhoto: string | null
  accessoriesHandedOver: string[]
}

interface LoanDetail {
  docNo: string
  customerName: string
  customerCompany: string | null
  salesRepName: string
  purpose: string
  expectedReturnDate: string
  status: string
  termsAndNotes: string | null
  lines: LoanLineItem[]
}

interface DeliverSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanDetail | null
  onDone: () => void
}

// Phase 3: ส่งมอบให้ลูกค้า + ลูกค้าเซ็นรับของ
export function DeliverSheet({ open, onOpenChange, loan, onDone }: DeliverSheetProps) {
  const { toast } = useToast()
  const [deliveredBy, setDeliveredBy] = useState('')
  const [sigHasContent, setSigHasContent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)

  useEffect(() => {
    if (open && loan) {
      setDeliveredBy(loan.salesRepName)
      sigRef.current?.clear()
      setSigHasContent(false)
    }
  }, [open, loan])

  if (!loan) return null

  const submit = async () => {
    if (!deliveredBy.trim()) {
      toast({ title: 'ต้องระบุชื่อผู้ส่งมอบ', variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'ลูกค้าต้องลงลายมือชื่อรับของ', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loan.docNo}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveredBy,
          customerSignature: sig,
          customerSignBy: loan.customerName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✓ ส่งมอบสำเร็จ`, description: `${loan.docNo} — ลูกค้ารับของแล้ว` })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const shareToLINE = () => {
    const text =
      `ใบยืมทรัพย์สิน activeASSET\n` +
      `เลขที่: ${loan.docNo}\n` +
      `ลูกค้า: ${loan.customerName}${loan.customerCompany ? ` (${loan.customerCompany})` : ''}\n` +
      `พนักงาน: ${loan.salesRepName}\n` +
      `วัตถุประสงค์: ${getPurposeLabel(loan.purpose)}\n` +
      `กำหนดคืน: ${formatThaiDate(loan.expectedReturnDate)}\n` +
      `จำนวน: ${loan.lines.length} เครื่อง\n\n` +
      `รายการเครื่อง:\n` +
      loan.lines.map((l, i) => `${i + 1}. ${l.assetTagId} | ${l.brand} ${l.model} | S/N: ${l.serialNo}`).join('\n')
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> ส่งมอบให้ลูกค้า — {loan.docNo}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <LoanStatusBadge status={loan.status} />
            <PurposeBadge purpose={loan.purpose} />
            <span>{loan.customerName}{loan.customerCompany ? ` • ${loan.customerCompany}` : ''}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 text-sm">
            {/* Checklist สินค้าที่จะส่งมอบ */}
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-1.5">
                <Package className="h-4 w-4" /> รายการสินค้าที่ส่งมอบ ({loan.lines.length} เครื่อง)
              </h3>
              <div className="space-y-1.5">
                {loan.lines.map((line, i) => (
                  <div key={line.id} className="border rounded p-2 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono">{line.assetTagId}</span>
                          <Badge variant="outline" className="text-xs">{line.brand} {line.model}</Badge>
                          <SourceBadge source={line.source} />
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">S/N: <span className="font-mono">{line.serialNo}</span></div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    {line.accessoriesHandedOver.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1.5">
                        <b>อุปกรณ์:</b> {line.accessoriesHandedOver.join(', ')}
                      </div>
                    )}
                    {line.conditionPhoto && (
                      <img src={line.conditionPhoto} alt="สภาพสินค้า" className="h-16 mt-1.5 rounded border" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* ข้อมูลใบยืม */}
            <div className="bg-slate-50 p-3 rounded-md text-xs space-y-1">
              <div>ลูกค้า: <b>{loan.customerName}</b>{loan.customerCompany ? ` (${loan.customerCompany})` : ''}</div>
              <div>พนักงาน: <b>{loan.salesRepName}</b></div>
              <div>กำหนดคืน: <b>{formatThaiDate(loan.expectedReturnDate)}</b></div>
              {loan.termsAndNotes && <div className="mt-1 text-slate-500">{loan.termsAndNotes}</div>}
            </div>

            <Separator />

            {/* ผู้ส่งมอบ */}
            <div>
              <label className="text-xs font-medium text-slate-600">ชื่อผู้ส่งมอบ <span className="text-rose-500">*</span></label>
              <div className="relative mt-1">
                <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} className="pl-7 h-9 text-sm" />
              </div>
            </div>

            {/* ลายเซ็นลูกค้า */}
            <div>
              <SignaturePad
                ref={sigRef}
                label="ลายมือชื่อลูกค้ารับของ"
                hint="ลูกค้าตรวจสินค้าตรงตามเอกสารแล้ว — ลงลายมือชื่อด้านล่าง"
                required
                height={140}
                onChange={setSigHasContent}
              />
              <p className="text-xs text-slate-400 mt-1">
                ประทับเวลา: {new Date().toLocaleString('th-TH')}
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 bg-[#06C755] hover:bg-[#05b04b] text-white border-transparent" onClick={shareToLINE}>
              <MessageCircle className="h-4 w-4 mr-1" /> ส่งรายการเข้า LINE
            </Button>
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={submit}
            disabled={submitting || !sigHasContent || !deliveredBy}
          >
            {submitting ? 'กำลังบันทึก...' : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" /> ยืนยันส่งมอบ (ลูกค้ารับของแล้ว)
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
