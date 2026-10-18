'use client'

import { useEffect, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  LoanStatusBadge, PurposeBadge, GradeBadge, SourceBadge, IndustryBadge,
  PhaseStepper, EmptyState, LoadingState,
} from './shared'
import {
  ScanLine, CheckCircle2, History, MessageCircle, User, Building2,
  Calendar, FileText, Package, ShoppingCart, Truck, Zap,
} from 'lucide-react'
import {
  formatThaiDate, formatThaiDateTime, getPurposeLabel,
} from '@/lib/activeasset-constants'

interface LoanLineItem {
  id: string
  assetTagId: string
  serialNo: string
  model: string
  brand: string
  source: string
  status: string
  returnedAt: string | null
  accessoriesHandedOver: string[]
  conditionPhoto: string | null
  photos?: Array<{ id: string; photoPath: string; caption: string | null }>
}

interface RequestLine {
  id: string
  catalogId: string
  model?: string
  brand?: string
  category?: string
  quantity: number
  fulfilledQty: number
  notes: string | null
  catalog: { model: string; brand: string; category: string; defaultAccessories: string[] }
}

interface ReturnEvent {
  id: string
  returnDate: string
  inspectorName: string
  inspectorSignAt: string | null
  notes: string | null
  items: Array<{
    id: string
    conditionGrade: string
    isDamaged: boolean
    damageDescription: string | null
    sendToRepair: boolean
    returnToSource: boolean
    accessoriesReturned: string[]
    loanLineItem: { asset: { tagId: string; serialNo: string; catalog: { model: string; brand: string } } }
  }>
}

interface LoanDetail {
  docNo: string
  customerName: string
  customerCompany: string | null
  customerIndustry: string | null
  salesRepName: string
  purpose: string
  industry: string | null
  requestedAt: string
  expectedReturnDate: string
  dispatchedBy: string | null
  dispatchedAt: string | null
  deliveredBy: string | null
  deliveredAt: string | null
  closedAt: string | null
  status: string
  termsAndNotes: string | null
  customerSignAt: string | null
  customerSignBy: string | null
  customerSignature: string | null
  requestLines: RequestLine[]
  lines: LoanLineItem[]
  returnEvents?: ReturnEvent[]
  waitingList?: Array<{ id: string; position: number; quantity: number; status: string }>
}

interface LoanDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  docNo: string | null
  onDispatch: (loan: LoanDetail) => void
  onDeliver: (loan: LoanDetail) => void
  onReturn: (loan: LoanDetail) => void
}

export function LoanDetailSheet({ open, onOpenChange, docNo, onDispatch, onDeliver, onReturn }: LoanDetailSheetProps) {
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !docNo) return
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) setLoading(true) })
    fetch(`/api/loans/${docNo}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setLoan(d.loan); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, docNo])

  const shareToLINE = () => {
    if (!loan) return
    const text =
      `ใบยืมทรัพย์สิน activeASSET\n` +
      `เลขที่: ${loan.docNo}\n` +
      `สถานะ: ${loan.status}\n` +
      `ลูกค้า: ${loan.customerName}${loan.customerCompany ? ` (${loan.customerCompany})` : ''}\n` +
      `พนักงาน: ${loan.salesRepName}\n` +
      `วัตถุประสงค์: ${getPurposeLabel(loan.purpose)}\n` +
      `กำหนดคืน: ${formatThaiDate(loan.expectedReturnDate)}\n` +
      (loan.lines.length > 0
        ? `จำนวน: ${loan.lines.length} เครื่อง\n\nรายการเครื่อง:\n` + loan.lines.map((a, i) => `${i + 1}. ${a.assetTagId} | ${a.brand} ${a.model} | S/N: ${a.serialNo}`).join('\n')
        : loan.requestLines.map((rl, i) => `${i + 1}. ${rl.brand || rl.catalog?.brand} ${rl.model || rl.catalog?.model} × ${rl.quantity}`).join('\n'))
    window.open(`https://line.me/R/share?text=${encodeURIComponent(text)}`, '_blank')
  }

  const pendingReturnCount = loan ? loan.lines.filter((l) => l.status === 'Out').length : 0
  const canDispatch = loan && ['Requested', 'Dispatching', 'Queued'].includes(loan.status) && loan.requestLines.some((rl) => rl.fulfilledQty < rl.quantity)
  const canAutoDispatch = canDispatch
  const canDeliver = loan && loan.status === 'Dispatched' && loan.lines.length > 0
  const canReturn = loan && ['Delivered', 'Partially_Returned'].includes(loan.status) && pendingReturnCount > 0

  const handleAutoDispatch = async () => {
    if (!loan) return
    const res = await fetch(`/api/loans/${loan.docNo}/auto-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatchedBy: 'Auto-dispatch' }),
    })
    const data = await res.json()
    if (!res.ok) {
      // show error via toast (parent)
      return
    }
    // reload loan
    setLoan(null)
    setTimeout(() => {
      fetch(`/api/loans/${loan.docNo}`).then(r => r.json()).then(d => setLoan(d.loan))
    }, 100)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> {docNo}
          </SheetTitle>
          <SheetDescription>
            {loading ? 'กำลังโหลด...' : loan ? (
              <div className="flex items-center gap-2 flex-wrap">
                <LoanStatusBadge status={loan.status} />
                <PurposeBadge purpose={loan.purpose} />
                {loan.customerIndustry && <IndustryBadge industry={loan.customerIndustry} />}
              </div>
            ) : ''}
          </SheetDescription>
        </SheetHeader>

        {loading && <LoadingState />}
        {!loading && loan && (
          <>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3 text-sm">
                {/* Phase Stepper */}
                <PhaseStepper status={loan.status} />

                {/* Customer info */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-md">
                  <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> <b>{loan.customerName}</b></div>
                  <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-slate-400" /> {loan.customerCompany || '-'}</div>
                  <div>พนักงาน: <b>{loan.salesRepName}</b></div>
                  <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> คืน {formatThaiDate(loan.expectedReturnDate)}</div>
                  <div>ขอยืม: {formatThaiDate(loan.requestedAt)}</div>
                  {loan.dispatchedAt && <div>จัดของ: {formatThaiDate(loan.dispatchedAt)} ({loan.dispatchedBy})</div>}
                  {loan.deliveredAt && <div>ส่งมอบ: {formatThaiDate(loan.deliveredAt)} ({loan.deliveredBy})</div>}
                  {loan.closedAt && <div>ปิดใบยืม: {formatThaiDate(loan.closedAt)}</div>}
                </div>

                {/* Request lines (Phase 1) */}
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" /> รายการที่ Sales ขอ ({loan.requestLines.length})
                  </h3>
                  <div className="divide-y border rounded">
                    {loan.requestLines.map((rl) => (
                      <div key={rl.id} className="p-2 flex items-center gap-2 text-xs">
                        <div className="flex-1">
                          <span className="font-medium">{rl.brand || rl.catalog?.brand} {rl.model || rl.catalog?.model}</span>
                          <span className="text-slate-500 ml-2">× {rl.quantity}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          จัดได้ {rl.fulfilledQty}/{rl.quantity}
                        </Badge>
                        {rl.fulfilledQty < rl.quantity && (
                          <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50">ขาด {rl.quantity - rl.fulfilledQty}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dispatched lines (Phase 2) */}
                {loan.lines.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-1.5">
                      <Package className="h-4 w-4" /> เครื่องที่จัดจริง ({loan.lines.length})
                    </h3>
                    <div className="divide-y border rounded">
                      {loan.lines.map((line) => (
                        <div key={line.id} className="p-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono">{line.assetTagId}</span>
                            <span className="text-slate-600">{line.brand} {line.model}</span>
                            <SourceBadge source={line.source} />
                            <Badge variant="outline" className={`text-xs ml-auto ${line.status === 'Returned' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {line.status === 'Returned' ? 'คืนแล้ว' : 'ค้างอยู่'}
                            </Badge>
                          </div>
                          <div className="text-slate-500 mt-0.5">S/N: <span className="font-mono">{line.serialNo}</span></div>
                          {line.accessoriesHandedOver.length > 0 && (
                            <div className="text-slate-500 mt-0.5">อุปกรณ์: {line.accessoriesHandedOver.join(', ')}</div>
                          )}
                          {line.photos && line.photos.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {line.photos.map((p) => (
                                <img key={p.id} src={p.photoPath} alt={p.caption || ''} className="h-12 w-12 object-cover rounded border" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer signature */}
                {loan.customerSignAt && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> ลูกค้าลงนามรับของแล้ว
                    </div>
                    <div className="mt-1 text-slate-600">ผู้ลงนาม: {loan.customerSignBy} • {formatThaiDateTime(loan.customerSignAt)}</div>
                    {loan.customerSignature && (
                      <img src={loan.customerSignature} alt="ลายเซ็น" className="mt-2 max-h-20 border rounded bg-white" />
                    )}
                  </div>
                )}

                {/* Return history */}
                {loan.returnEvents && loan.returnEvents.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2 flex items-center gap-1.5">
                        <History className="h-4 w-4" /> ประวัติรับคืน ({loan.returnEvents.length})
                      </h3>
                      <div className="space-y-2">
                        {loan.returnEvents.map((ev, i) => (
                          <div key={ev.id} className="border rounded p-2.5 bg-slate-50 text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">ครั้งที่ {i + 1} — {ev.inspectorName}</span>
                              <span className="text-slate-500">{formatThaiDateTime(ev.returnDate)}</span>
                            </div>
                            {ev.notes && <div className="text-slate-500 mb-1">หมายเหตุ: {ev.notes}</div>}
                            <div className="space-y-1">
                              {ev.items.map((item) => (
                                <div key={item.id} className="flex items-center gap-1.5 bg-white p-1.5 rounded border">
                                  <span className="font-mono">{item.loanLineItem.asset.tagId}</span>
                                  <span className="text-slate-600">{item.loanLineItem.asset.catalog.brand} {item.loanLineItem.asset.catalog.model}</span>
                                  <span className="ml-auto flex items-center gap-1">
                                    <GradeBadge grade={item.conditionGrade} />
                                    {item.sendToRepair && <Badge variant="outline" className="text-xs text-purple-700">ซ่อม</Badge>}
                                    {!item.returnToSource && <Badge variant="outline" className="text-xs text-amber-700">เปลี่ยน source</Badge>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Waiting list */}
                {loan.waitingList && loan.waitingList.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2 flex items-center gap-1.5 text-rose-700">
                        <History className="h-4 w-4" /> Waiting List ({loan.waitingList.length})
                      </h3>
                      <div className="space-y-1">
                        {loan.waitingList.map((w) => (
                          <div key={w.id} className="text-xs bg-rose-50 border border-rose-200 rounded p-1.5">
                            คิวที่ {w.position} • ขอ {w.quantity} ชิ้น • {w.status}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {loan.termsAndNotes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-1">เงื่อนไข/หมายเหตุ</h3>
                      <p className="text-xs text-slate-600">{loan.termsAndNotes}</p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="border-t p-3 space-y-2">
              {/* PDF buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => window.open(`/api/loans/${loan.docNo}/pdf?type=loan`, '_blank')}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" /> PDF ใบยืม
                </Button>
                {loan.returnEvents && loan.returnEvents.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`/api/loans/${loan.docNo}/pdf?type=return`, '_blank')}
                  >
                    <FileText className="h-3.5 w-3.5 mr-1" /> PDF ใบคืน
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-[#06C755] hover:bg-[#05b04b] text-white border-transparent" onClick={shareToLINE}>
                  <MessageCircle className="h-4 w-4 mr-1" /> LINE
                </Button>
                {canDispatch && (
                  <>
                    <Button className="flex-1" onClick={() => onDispatch(loan)}>
                      <Package className="h-4 w-4 mr-1" /> จัดของ
                    </Button>
                    {canAutoDispatch && (
                      <Button
                        variant="outline"
                        className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={handleAutoDispatch}
                      >
                        <Zap className="h-4 w-4 mr-1" /> Auto-dispatch
                      </Button>
                    )}
                  </>
                )}
                {canDeliver && (
                  <Button className="flex-1" onClick={() => onDeliver(loan)}>
                    <Truck className="h-4 w-4 mr-1" /> ส่งมอบ
                  </Button>
                )}
                {canReturn && (
                  <Button className="flex-1" onClick={() => onReturn(loan)}>
                    <ScanLine className="h-4 w-4 mr-1" /> รับคืน ({pendingReturnCount})
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
        {!loading && !loan && <EmptyState message="ไม่พบใบยืม" />}
      </SheetContent>
    </Sheet>
  )
}

export type { LoanDetail }
