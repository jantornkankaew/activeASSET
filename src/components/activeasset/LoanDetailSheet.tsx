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
  EmptyState, LoadingState,
} from './shared'
import {
  ScanLine, CheckCircle2, History, MessageCircle, User, Building2,
  Calendar, FileText, Package, ShoppingCart, Truck, Zap,
  MapPin, Phone, CreditCard, Shield, Clock, ChevronDown,
} from 'lucide-react'
import {
  formatThaiDate, formatThaiDateTime, getPurposeLabel,
  SOURCE_LABELS, INDUSTRY_LABELS, PURPOSE_LABELS,
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

// Velzon color tokens
const VZ = {
  primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548',
  purple: '#a071f0', slate: '#74788d',
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
    if (!res.ok) return
    setLoan(null)
    setTimeout(() => {
      fetch(`/api/loans/${loan.docNo}`).then(r => r.json()).then(d => setLoan(d.loan))
    }, 100)
  }

  // Status timeline phases
  const phases = loan ? [
    {
      key: 'requested', icon: ShoppingCart, label: 'ขอยืม', date: loan.requestedAt,
      sub: 'โดย ' + loan.salesRepName,
      color: VZ.teal, done: true,
      body: [
        { title: `วัตถุประสงค์: ${PURPOSE_LABELS[loan.purpose]?.label || loan.purpose}`, date: formatThaiDateTime(loan.requestedAt) },
        ...(loan.customerCompany ? [{ title: `บริษัท: ${loan.customerCompany}`, date: '' }] : []),
      ],
    },
    {
      key: 'dispatched', icon: Package, label: 'จัดของ', date: loan.dispatchedAt,
      sub: loan.dispatchedBy ? `โดย ${loan.dispatchedBy}` : 'รอดำเนินการ',
      color: VZ.amber, done: !!loan.dispatchedAt,
      body: loan.dispatchedAt ? [
        { title: `จัดเครื่อง ${loan.lines.length} เครื่อง`, date: formatThaiDateTime(loan.dispatchedAt) },
        ...(loan.requestLines.filter(rl => rl.fulfilledQty < rl.quantity).length > 0
          ? [{ title: `ขาด ${loan.requestLines.reduce((s, rl) => s + (rl.quantity - rl.fulfilledQty), 0)} เครื่อง`, date: 'อยู่ในคิว' }]
          : []),
      ] : [],
    },
    {
      key: 'delivered', icon: Truck, label: 'ส่งมอบ', date: loan.deliveredAt,
      sub: loan.deliveredBy ? `โดย ${loan.deliveredBy}` : 'รอส่งมอบ',
      color: VZ.primary, done: !!loan.deliveredAt,
      body: loan.deliveredAt ? [
        { title: loan.customerSignAt ? `ลูกค้าลงนามรับของแล้ว` : 'รอลูกค้าลงนาม', date: loan.customerSignAt ? formatThaiDateTime(loan.customerSignAt) : formatThaiDate(loan.deliveredAt) },
      ] : [],
    },
    {
      key: 'returned', icon: CheckCircle2, label: 'รับคืน', date: loan.returnEvents?.[0]?.returnDate,
      sub: loan.returnEvents?.length ? `${loan.returnEvents.length} ครั้ง` : 'รอรับคืน',
      color: VZ.purple, done: !!(loan.returnEvents && loan.returnEvents.length > 0),
      body: (loan.returnEvents || []).map(ev => ({
        title: `ครั้งที่ ${ev.inspectorName} — ${ev.items.length} ชิ้น`,
        date: formatThaiDateTime(ev.returnDate),
      })),
    },
    {
      key: 'closed', icon: Shield, label: 'ปิดใบยืม', date: loan.closedAt,
      sub: loan.closedAt ? 'เสร็จสมบูรณ์' : 'ยังไม่ปิด',
      color: VZ.slate, done: !!loan.closedAt,
      body: [],
    },
  ] : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl p-0 flex flex-col">
        {/* Header — Velzon page-title-box style */}
        <SheetHeader className="px-4 py-3 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> {docNo}
            </SheetTitle>
            <span className="text-muted-foreground/40">|</span>
            {loading ? (
              <span className="text-xs text-muted-foreground">กำลังโหลด...</span>
            ) : loan ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                <LoanStatusBadge status={loan.status} />
                <PurposeBadge purpose={loan.purpose} />
                {loan.customerIndustry && <IndustryBadge industry={loan.customerIndustry} />}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => loan && window.open(`/api/loans/${loan.docNo}/pdf?type=loan`, '_blank')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-white shadow-sm transition-smooth hover:shadow-md"
              style={{ backgroundColor: VZ.teal }}
            >
              <FileText className="h-3 w-3" /> PDF ใบยืม
            </button>
            {loan && loan.returnEvents && loan.returnEvents.length > 0 && (
              <button
                onClick={() => window.open(`/api/loans/${loan.docNo}/pdf?type=return`, '_blank')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-foreground bg-muted/40 hover:bg-muted border border-border transition-smooth"
              >
                <FileText className="h-3 w-3" /> PDF ใบคืน
              </button>
            )}
          </div>
        </SheetHeader>

        {loading && <LoadingState />}
        {!loading && loan && (
          <ScrollArea className="flex-1">
            <div className="p-4">
              {/* === Velzon 2-column layout === */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* === LEFT col-2 — Order table + Status timeline === */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Card 1 — Order table (items) */}
                  <div className="vz-card overflow-hidden">
                    <div className="px-4 py-3 vz-divider flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                        รายการที่ยืม
                      </h5>
                      <div className="flex items-center gap-1.5">
                        <span className="vz-pill vz-pill-info">{loan.lines.length || loan.requestLines.length} รายการ</span>
                        {pendingReturnCount > 0 && (
                          <span className="vz-pill vz-pill-warning">{pendingReturnCount} ค้างคืน</span>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="vz-table">
                        <thead className="bg-muted/30">
                          <tr>
                            <th scope="col">รายละเอียดเครื่อง</th>
                            <th scope="col">แหล่ง</th>
                            <th scope="col">จำนวน</th>
                            <th scope="col">สถานะ</th>
                            <th scope="col" className="text-right">วันคืน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loan.lines.length === 0 && loan.requestLines.map((rl) => (
                            <tr key={rl.id}>
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <div className="vz-icon-soft h-9 w-9 bg-muted/40 flex-shrink-0">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-foreground">{rl.brand || rl.catalog?.brand} {rl.model || rl.catalog?.model}</div>
                                    <div className="text-[10px] text-muted-foreground">{rl.notes || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>—</td>
                              <td className="font-mono">{rl.quantity}</td>
                              <td>
                                <span className="vz-pill vz-pill-warning">รอจัด</span>
                                {rl.fulfilledQty < rl.quantity && (
                                  <span className="vz-pill vz-pill-danger ml-1">ขาด {rl.quantity - rl.fulfilledQty}</span>
                                )}
                              </td>
                              <td className="text-right text-[11px] text-muted-foreground">—</td>
                            </tr>
                          ))}
                          {loan.lines.map((line) => (
                            <tr key={line.id}>
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <div className="vz-icon-soft h-9 w-9 bg-muted/40 flex-shrink-0">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold text-foreground">
                                      <span className="font-mono">{line.assetTagId}</span>
                                      <span className="text-muted-foreground ml-1">·</span>
                                      <span className="ml-1">{line.brand} {line.model}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      S/N: <span className="font-mono">{line.serialNo}</span>
                                      {line.accessoriesHandedOver.length > 0 && (
                                        <span className="ml-2">• {line.accessoriesHandedOver.length} อุปกรณ์</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <SourceBadge source={line.source} />
                              </td>
                              <td className="font-mono">1</td>
                              <td>
                                {line.status === 'Returned' ? (
                                  <span className="vz-pill vz-pill-success">คืนแล้ว</span>
                                ) : (
                                  <span className="vz-pill vz-pill-warning">ค้างยืม</span>
                                )}
                              </td>
                              <td className="text-right text-[11px]">
                                {line.returnedAt ? (
                                  <span style={{ color: VZ.teal }}>{formatThaiDate(line.returnedAt)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Summary row — Velzon border-top-dashed */}
                          <tr className="border-t-2 border-dashed border-border">
                            <td colSpan={3} className="text-right text-[11px] text-muted-foreground">สรุปยอด:</td>
                            <td colSpan={2} className="p-0">
                              <table className="w-full text-xs">
                                <tbody>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">ขอยืมทั้งหมด</td>
                                    <td className="px-2 py-1 text-right font-medium tabular-nums">{loan.requestLines.reduce((s, rl) => s + rl.quantity, 0)}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">จัดจริง</td>
                                    <td className="px-2 py-1 text-right font-medium tabular-nums" style={{ color: VZ.teal }}>{loan.lines.length}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">คืนแล้ว</td>
                                    <td className="px-2 py-1 text-right font-medium tabular-nums" style={{ color: VZ.teal }}>{loan.lines.filter(l => l.status === 'Returned').length}</td>
                                  </tr>
                                  <tr>
                                    <td className="px-2 py-1 text-muted-foreground">ค้างคืน</td>
                                    <td className="px-2 py-1 text-right font-bold tabular-nums" style={{ color: pendingReturnCount > 0 ? VZ.rose : VZ.teal }}>{pendingReturnCount}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Card 2 — Order Status (timeline accordion) */}
                  <div className="vz-card overflow-hidden">
                    <div className="px-4 py-3 vz-divider flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                        สถานะใบยืม
                      </h5>
                      <span className="vz-pill vz-pill-muted">{loan.status}</span>
                    </div>
                    <div className="p-2">
                      {/* Timeline accordion — Velzon pattern */}
                      <div className="space-y-0">
                        {phases.map((phase, i) => {
                          const Icon = phase.icon
                          const isLast = i === phases.length - 1
                          return (
                            <div key={phase.key} className="relative">
                              {/* Timeline connector line */}
                              {!isLast && (
                                <div
                                  className="absolute left-5 top-10 bottom-0 w-px"
                                  style={{ backgroundColor: phase.done ? phase.color : 'rgba(116,120,141,0.20)' }}
                                />
                              )}
                              <div className="flex items-start gap-3 p-2 hover:bg-muted/30 rounded transition-smooth">
                                {/* Avatar icon */}
                                <div
                                  className="vz-avatar h-10 w-10 flex-shrink-0 relative z-10"
                                  style={{
                                    backgroundColor: phase.done ? phase.color : 'rgba(116,120,141,0.10)',
                                    color: phase.done ? 'white' : VZ.slate,
                                    boxShadow: phase.done ? `0 0 0 3px ${phase.color}22` : 'none',
                                  }}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                {/* Content */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <h6 className="text-sm font-semibold text-foreground mb-0">{phase.label}</h6>
                                    {phase.date && (
                                      <span className="text-[11px] text-muted-foreground">{formatThaiDate(phase.date)}</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{phase.sub}</p>
                                  {phase.body.length > 0 && (
                                    <div className="mt-2 ml-1 space-y-1.5 border-l-2 pl-3" style={{ borderColor: phase.done ? phase.color : 'rgba(116,120,141,0.20)' }}>
                                      {phase.body.map((b, j) => (
                                        <div key={j}>
                                          <div className="text-xs font-medium text-foreground">{b.title}</div>
                                          {b.date && <div className="text-[10px] text-muted-foreground">{b.date}</div>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* === RIGHT col-1 — Sidebar cards === */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Card — Logistics / Dispatch */}
                  <div className="vz-card">
                    <div className="px-4 py-3 vz-divider flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                        <Truck className="h-4 w-4 text-muted-foreground" /> การส่งมอบ
                      </h5>
                      <span className="vz-pill vz-pill-info">ส่งโดย</span>
                    </div>
                    <div className="p-4 text-center">
                      <div className="vz-avatar h-14 w-14 mx-auto mb-2 text-white" style={{ backgroundColor: loan.deliveredAt ? VZ.primary : 'rgba(116,120,141,0.20)', color: loan.deliveredAt ? 'white' : VZ.slate }}>
                        <Truck className="h-6 w-6" />
                      </div>
                      <h6 className="text-sm font-semibold text-foreground mb-0">
                        {loan.deliveredBy || 'รอส่งมอบ'}
                      </h6>
                      <p className="text-[11px] text-muted-foreground mb-1">
                        {loan.deliveredAt ? formatThaiDateTime(loan.deliveredAt) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        รูปแบบ: <span className="font-medium text-foreground">{SOURCE_LABELS[loan.lines[0]?.source || 'Demo_Stock']?.label || 'คลังเดโม'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Card — Customer Details */}
                  <div className="vz-card">
                    <div className="px-4 py-3 vz-divider flex items-center justify-between">
                      <h5 className="text-sm font-semibold text-foreground mb-0">ข้อมูลลูกค้า</h5>
                      <button className="text-[11px] text-primary hover:underline">ดูโปรไฟล์</button>
                    </div>
                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="vz-avatar h-9 w-9 text-xs"
                          style={{ backgroundColor: `${VZ.primary}11`, color: VZ.primary }}
                        >
                          {loan.customerName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h6 className="text-xs font-semibold text-foreground mb-0 truncate">{loan.customerName}</h6>
                          <p className="text-[10px] text-muted-foreground mb-0">ลูกค้า</p>
                        </div>
                      </div>
                      {loan.customerCompany && (
                        <div className="flex items-center gap-2 text-xs">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground truncate">{loan.customerCompany}</span>
                        </div>
                      )}
                      {loan.customerIndustry && (
                        <div className="flex items-center gap-2 text-xs">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground truncate">{INDUSTRY_LABELS[loan.customerIndustry] || loan.customerIndustry}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground truncate">พนักงาน: {loan.salesRepName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card — Loan Terms (Billing Address equivalent) */}
                  <div className="vz-card">
                    <div className="px-4 py-3 vz-divider">
                      <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-muted-foreground" /> เงื่อนไขการยืม
                      </h5>
                    </div>
                    <div className="p-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">เลขที่:</span>
                        <span className="font-mono font-semibold text-foreground">{loan.docNo}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">วัตถุประสงค์:</span>
                        <span className="text-foreground text-right">{PURPOSE_LABELS[loan.purpose]?.label || loan.purpose}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">วันที่ขอ:</span>
                        <span className="text-foreground">{formatThaiDate(loan.requestedAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">กำหนดคืน:</span>
                        <span className="font-semibold text-foreground" style={{ color: VZ.rose }}>{formatThaiDate(loan.expectedReturnDate)}</span>
                      </div>
                      {loan.closedAt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ปิดใบยืม:</span>
                          <span className="text-foreground" style={{ color: VZ.teal }}>{formatThaiDate(loan.closedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card — Signature (Payment Details equivalent) */}
                  {loan.customerSignAt && (
                    <div className="vz-card">
                      <div className="px-4 py-3 vz-divider">
                        <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-muted-foreground" /> ลายเซ็นลูกค้า
                        </h5>
                      </div>
                      <div className="p-4 text-center">
                        {loan.customerSignature && (
                          <img src={loan.customerSignature} alt="ลายเซ็น" className="max-h-20 mx-auto border rounded bg-white" />
                        )}
                        <div className="text-[11px] text-muted-foreground mt-2">
                          ลงนามโดย <b className="text-foreground">{loan.customerSignBy}</b>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{formatThaiDateTime(loan.customerSignAt)}</div>
                      </div>
                    </div>
                  )}

                  {/* Card — Waiting List (if any) */}
                  {loan.waitingList && loan.waitingList.length > 0 && (
                    <div className="vz-card">
                      <div className="px-4 py-3 vz-divider">
                        <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                          <Clock className="h-4 w-4" style={{ color: VZ.rose }} /> คิวรอ
                        </h5>
                      </div>
                      <div className="p-4 space-y-1.5">
                        {loan.waitingList.map((w) => (
                          <div key={w.id} className="text-xs p-2 rounded" style={{ backgroundColor: 'rgba(240,101,72,0.06)', border: '1px solid rgba(240,101,72,0.15)' }}>
                            <div className="font-medium" style={{ color: VZ.rose }}>คิวที่ {w.position}</div>
                            <div className="text-muted-foreground text-[11px]">ขอ {w.quantity} ชิ้น • {w.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card — Notes */}
                  {loan.termsAndNotes && (
                    <div className="vz-card">
                      <div className="px-4 py-3 vz-divider">
                        <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-muted-foreground" /> เงื่อนไข/หมายเหตุ
                        </h5>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-muted-foreground leading-relaxed">{loan.termsAndNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Return history — full-width below */}
              {loan.returnEvents && loan.returnEvents.length > 0 && (
                <div className="vz-card mt-4 overflow-hidden">
                  <div className="px-4 py-3 vz-divider flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5">
                      <History className="h-4 w-4" style={{ color: VZ.purple }} /> ประวัติรับคืน ({loan.returnEvents.length})
                    </h5>
                  </div>
                  <div className="p-4 space-y-3">
                    {loan.returnEvents.map((ev, i) => (
                      <div key={ev.id} className="border border-border rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="vz-avatar h-7 w-7 text-[10px]" style={{ backgroundColor: `${VZ.purple}11`, color: VZ.purple }}>
                              {i + 1}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground">ครั้งที่ {i + 1} — {ev.inspectorName}</div>
                              <div className="text-[10px] text-muted-foreground">{formatThaiDateTime(ev.returnDate)}</div>
                            </div>
                          </div>
                          {ev.notes && <div className="text-[11px] text-muted-foreground italic max-w-[50%] truncate">"{ev.notes}"</div>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {ev.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs">
                              <span className="font-mono text-foreground">{item.loanLineItem.asset.tagId}</span>
                              <span className="text-muted-foreground truncate flex-1">{item.loanLineItem.asset.catalog.brand} {item.loanLineItem.asset.catalog.model}</span>
                              <div className="flex items-center gap-1">
                                {item.conditionGrade && <GradeBadge grade={item.conditionGrade} />}
                                {item.isDamaged && <span className="vz-pill vz-pill-danger">เสียหาย</span>}
                                {item.sendToRepair && <span className="vz-pill" style={{ backgroundColor: `${VZ.purple}11`, color: VZ.purple }}>ซ่อม</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* === Action bar — Velzon-style at bottom === */}
        {!loading && loan && (
          <div className="border-t p-3 space-y-2 bg-card">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="flex-1 bg-[#06C755] hover:bg-[#05b04b] text-white border-transparent" onClick={shareToLINE}>
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> แชร์ไลน์
              </Button>
              {canDispatch && (
                <>
                  <Button size="sm" className="flex-1" onClick={() => onDispatch(loan)}>
                    <Package className="h-3.5 w-3.5 mr-1" /> จัดของ
                  </Button>
                  {canAutoDispatch && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      onClick={handleAutoDispatch}
                    >
                      <Zap className="h-3.5 w-3.5 mr-1" /> Auto
                    </Button>
                  )}
                </>
              )}
              {canDeliver && (
                <Button size="sm" className="flex-1" onClick={() => onDeliver(loan)}>
                  <Truck className="h-3.5 w-3.5 mr-1" /> ส่งมอบ
                </Button>
              )}
              {canReturn && (
                <Button size="sm" className="flex-1" onClick={() => onReturn(loan)}>
                  <ScanLine className="h-3.5 w-3.5 mr-1" /> รับคืน ({pendingReturnCount})
                </Button>
              )}
            </div>
          </div>
        )}
        {!loading && !loan && <EmptyState message="ไม่พบใบยืม" />}
      </SheetContent>
    </Sheet>
  )
}

export type { LoanDetail }
