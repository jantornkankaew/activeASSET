'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  LoanStatusBadge, PurposeBadge, SourceBadge, GradeBadge,
} from './shared'
import {
  ScanLine, CheckCircle2, AlertCircle, ShieldCheck, User, Wrench,
  History, Package, Star, FileText, Building2, Calendar, Truck, Phone,
  MapPin, ChevronRight, Camera, X, Upload, Image as ImageIcon,
} from 'lucide-react'
import {
  getLoanStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime,
  GRADE_LABELS, SOURCE_LABELS, INDUSTRY_LABELS, PURPOSE_LABELS,
} from '@/lib/activeasset-constants'

// Velzon color tokens
const VZ = { primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548', purple: '#a071f0', slate: '#74788d' }

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
  photos?: Array<{ id: string; photoPath: string; caption: string | null }>
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
    comment: string | null
    sendToRepair: boolean
    returnToSource: boolean
    accessoriesReturned: string[]
    photos?: Array<{ id: string; photoPath: string; caption: string | null }>
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
  expectedReturnDate: string
  status: string
  lines: LoanLineItem[]
  returnEvents?: ReturnEvent[]
}

interface ReturnItemForm {
  loanLineItemId: string
  selected: boolean
  conditionGrade: 'A' | 'B' | 'C' | 'D'
  accessoriesReturned: string[]
  isDamaged: boolean
  damageDescription: string
  comment: string  // รีวิว/ความคิดเห็นทั่วไป (นอกเหนือจาก damage description)
  photos: Array<{ path: string; caption: string }>  // รูปถ่ายของเครื่องตอนรับคืน (ไม่บังคับ)
  sendToRepair: boolean
  returnToSource: boolean
}

interface ReturnLoanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanDetail | null
  onDone: () => void
}

// Grade → star count mapping (for the "review" star rating display)
const GRADE_TO_STARS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2 }

export function ReturnLoanSheet({ open, onOpenChange, loan, onDone }: ReturnLoanSheetProps) {
  const { toast } = useToast()
  const [forms, setForms] = useState<Record<string, ReturnItemForm>>({})
  const [inspectorName, setInspectorName] = useState('เจ้าหน้าที่คลัง (Store)')
  const [returnNotes, setReturnNotes] = useState('')
  const [sigHasContent, setSigHasContent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)

  useEffect(() => {
    if (open && loan) {
      const f: Record<string, ReturnItemForm> = {}
      for (const line of loan.lines) {
        if (line.status === 'Out') {
          const acc = Array.isArray(line.accessoriesHandedOver) ? line.accessoriesHandedOver : []
          f[line.id] = {
            loanLineItemId: line.id,
            selected: false,
            conditionGrade: 'A',
            accessoriesReturned: [...acc],
            isDamaged: false,
            damageDescription: '',
            comment: '',
            photos: [],
            sendToRepair: false,
            returnToSource: true,
          }
        }
      }
      setForms(f)
      setReturnNotes('')
      sigRef.current?.clear()
      setSigHasContent(false)
    }
  }, [open, loan])

  if (!loan) return null

  const updateForm = (lineId: string, patch: Partial<ReturnItemForm>) => {
    setForms((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))
  }
  const toggleAccessory = (lineId: string, acc: string) => {
    const f = forms[lineId]
    if (!f) return
    const has = f.accessoriesReturned.includes(acc)
    updateForm(lineId, {
      accessoriesReturned: has ? f.accessoriesReturned.filter((x) => x !== acc) : [...f.accessoriesReturned, acc],
    })
  }

  const pendingLines = loan.lines.filter((l) => l.status === 'Out')
  const returnedLines = loan.lines.filter((l) => l.status === 'Returned')
  const selectedCount = Object.values(forms).filter((f) => f.selected).length

  // === "Review" summary — grade distribution of all returned items across all return events ===
  const allReturnedItems = (loan.returnEvents || []).flatMap(ev => ev.items)
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const item of allReturnedItems) {
    if (item.conditionGrade && gradeCounts[item.conditionGrade] !== undefined) {
      gradeCounts[item.conditionGrade]++
    }
  }
  // Also count already-returned lines from current loan (returnedAt set)
  const totalReturnedCount = allReturnedItems.length
  const avgStars = totalReturnedCount > 0
    ? allReturnedItems.reduce((s, it) => s + (GRADE_TO_STARS[it.conditionGrade] || 4), 0) / totalReturnedCount
    : 0

  const submit = async () => {
    if (!loan) return
    const selected = Object.values(forms).filter((f) => f.selected)
    if (selected.length === 0) {
      toast({ title: 'เลือกเครื่องที่จะรับคืน', variant: 'destructive' })
      return
    }
    if (!inspectorName.trim()) {
      toast({ title: 'ต้องระบุชื่อเจ้าหน้าที่', variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'เจ้าหน้าที่ต้องลงลายมือชื่อ', variant: 'destructive' })
      return
    }
    for (const item of selected) {
      if (item.conditionGrade === 'D' && !item.damageDescription.trim()) {
        toast({ title: 'Grade D ต้องระบุรายละเอียดความเสียหาย', variant: 'destructive' })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loan.docNo}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorName,
          inspectorSignature: sig,
          notes: returnNotes,
          items: selected.map((f) => ({
            loanLineItemId: f.loanLineItemId,
            conditionGrade: f.conditionGrade,
            accessoriesReturned: f.accessoriesReturned,
            isDamaged: f.isDamaged || f.conditionGrade === 'D',
            damageDescription: f.damageDescription,
            comment: f.comment,
            photos: f.photos,
            sendToRepair: f.sendToRepair || f.conditionGrade === 'D',
            returnToSource: f.returnToSource,
            nextLocationId: null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'รับคืนไม่สำเร็จ')
      toast({
        title: `✓ รับคืนสำเร็จ (${selected.length} เครื่อง)`,
        description: data.loanStatus === 'Returned' ? 'ใบยืมปิดสมบูรณ์' : `คงค้าง ${data.remaining} เครื่อง`,
      })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl p-0 flex flex-col">
        {/* ===== Velzon page-title-box style header ===== */}
        <SheetHeader className="px-4 py-3 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-3">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4" /> รับคืน — {loan.docNo}
            </SheetTitle>
            <span className="text-muted-foreground/40">|</span>
            <SheetDescription className="flex items-center gap-1.5 flex-wrap">
              <LoanStatusBadge status={loan.status} />
              <span className="text-xs">{loan.customerName}{loan.customerCompany ? ` • ${loan.customerCompany}` : ''}</span>
            </SheetDescription>
          </div>
          <div className="text-xs text-muted-foreground">
            กำหนดคืน: <span className="font-medium text-foreground">{formatThaiDate(loan.expectedReturnDate)}</span>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* ===== Velzon seller-details 2-column layout ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* === LEFT col-1 — Sidebar === */}
              <div className="lg:col-span-1 space-y-4">
                {/* Loan summary card (Velzon company profile card) */}
                <div className="vz-card">
                  <div className="p-4">
                    {/* Avatar */}
                    <div className="vz-icon-soft h-14 w-14 mx-auto mb-3 bg-muted/40 rounded-md">
                      <FileText className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <h5 className="text-sm font-semibold text-foreground mb-0">{loan.docNo}</h5>
                      <p className="text-[11px] text-muted-foreground">{getLoanStatusLabel(loan.status).label}</p>
                    </div>
                    {/* Info table — Velzon table-borderless */}
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ลูกค้า:</span>
                        <span className="font-medium text-foreground text-right">{loan.customerName}</span>
                      </div>
                      {loan.customerCompany && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">บริษัท:</span>
                          <span className="font-medium text-foreground text-right">{loan.customerCompany}</span>
                        </div>
                      )}
                      {loan.customerIndustry && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">อุตสาหกรรม:</span>
                          <span className="font-medium text-foreground text-right">{INDUSTRY_LABELS[loan.customerIndustry] || loan.customerIndustry}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">พนักงาน:</span>
                        <span className="font-medium text-foreground text-right">{loan.salesRepName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">วัตถุประสงค์:</span>
                        <span className="font-medium text-foreground text-right">{PURPOSE_LABELS[loan.purpose] || loan.purpose}</span>
                      </div>
                    </div>
                  </div>

                  {/* === Customer Reviews section (border-top-dashed) === */}
                  <div className="border-t border-dashed border-border p-4">
                    <h6 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">รีวิวการรับคืน</h6>
                    {/* Summary box — bg-light px-3 py-2 rounded-2 */}
                    <div className="bg-muted/40 px-3 py-2 rounded-md mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i <= Math.round(avgStars) ? 'fill-current' : ''}`}
                              style={{ color: i <= Math.round(avgStars) ? VZ.amber : 'rgba(116,120,141,0.3)' }}
                            />
                          ))}
                        </div>
                        <h6 className="text-xs font-semibold text-foreground mb-0">{avgStars.toFixed(1)} out of 5</h6>
                      </div>
                    </div>
                    <div className="text-center text-[10px] text-muted-foreground mb-3">
                      รวม <span className="font-medium text-foreground">{totalReturnedCount}</span> รีวิว
                    </div>

                    {/* Grade breakdown — Velzon 5-row rating distribution */}
                    <div className="space-y-1.5">
                      {[
                        { label: '5 ★', grade: 'A', count: gradeCounts.A, color: VZ.teal },
                        { label: '4 ★', grade: 'B', count: gradeCounts.B, color: VZ.teal },
                        { label: '3 ★', grade: 'C', count: gradeCounts.C, color: VZ.amber },
                        { label: '2 ★', grade: 'D', count: gradeCounts.D, color: VZ.rose },
                      ].map((row) => {
                        const total = totalReturnedCount || 1
                        const pct = (row.count / total) * 100
                        return (
                          <div key={row.grade} className="flex items-center gap-2">
                            <div className="w-8"><h6 className="text-[10px] font-medium text-foreground mb-0">{row.label}</h6></div>
                            <div className="flex-1">
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, backgroundColor: row.color }}
                                />
                              </div>
                            </div>
                            <div className="w-6 text-right"><h6 className="text-[10px] font-medium text-muted-foreground mb-0 tabular-nums">{row.count}</h6></div>
                          </div>
                        )
                      })}
                      {totalReturnedCount === 0 && (
                        <p className="text-[10px] text-muted-foreground text-center italic mt-2">ยังไม่มีรีวิวการรับคืน</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* === RIGHT col-2 — Main === */}
              <div className="lg:col-span-2 space-y-4">
                {/* === Items to return — Velzon review card pattern === */}
                <div className="vz-card">
                  <div className="px-4 py-3 vz-divider flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                      รอรับคืน ({pendingLines.length})
                    </h5>
                    <div className="flex items-center gap-1.5">
                      {selectedCount > 0 && (
                        <span className="vz-pill vz-pill-info">เลือก {selectedCount}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 space-y-3">
                    {pendingLines.length === 0 && (
                      <div className="py-6 text-center">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: VZ.teal }} />
                        <div className="text-sm font-medium text-foreground">ไม่มีเครื่องรอรับคืน</div>
                      </div>
                    )}
                    {pendingLines.map((line) => {
                      const f = forms[line.id]
                      if (!f) return null
                      return (
                        <div
                          key={line.id}
                          className={`border rounded-md transition-smooth ${f.selected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
                        >
                          {/* Top row — Velzon review card pattern */}
                          <div className="p-3 flex items-start gap-2.5">
                            <Checkbox checked={f.selected} onCheckedChange={(v) => updateForm(line.id, { selected: !!v })} className="mt-1" />
                            {/* avatar-sm bg-light rounded */}
                            <div className="vz-icon-soft h-9 w-9 bg-muted/40 rounded-md flex-shrink-0">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-sm font-semibold text-foreground">{line.assetTagId}</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-foreground">{line.brand} {line.model}</span>
                                <SourceBadge source={line.source} />
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                S/N: <span className="font-mono">{line.serialNo}</span>
                              </div>
                              {/* Source hint */}
                              {line.source === 'Supplier' && (
                                <div className="text-[10px] mt-1 p-1.5 rounded" style={{ backgroundColor: 'rgba(160,113,240,0.06)', color: VZ.purple, border: '1px solid rgba(160,113,240,0.15)' }}>
                                  ⚠ ยืมจาก Supplier — คืนตาม source = ส่งคืน Supplier
                                </div>
                              )}
                              {line.source === 'Sales_Stock' && (
                                <div className="text-[10px] mt-1 p-1.5 rounded" style={{ backgroundColor: 'rgba(64,81,137,0.06)', color: VZ.primary, border: '1px solid rgba(64,81,137,0.15)' }}>
                                  จากคลังขาย — คืนตาม source = กลับคลังขาย
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expandable form when selected */}
                          {f.selected && (
                            <div className="px-3 pb-3 ml-6 space-y-2.5 border-l-2 border-primary/30 ml-9 pl-3">
                              {/* Accessories */}
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1.5">อุปกรณ์เสริมที่คืน</div>
                                <div className="space-y-1">
                                  {line.accessoriesHandedOver.map((acc) => {
                                    const checked = f.accessoriesReturned.includes(acc)
                                    return (
                                      <div
                                        key={acc}
                                        className={`flex items-center gap-1.5 p-1.5 rounded border text-xs transition-smooth ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}
                                      >
                                        <Checkbox checked={checked} onCheckedChange={() => toggleAccessory(line.id, acc)} className="h-3 w-3" />
                                        <span className={checked ? 'text-emerald-700' : 'text-rose-700 line-through'}>{acc}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* === Star rating — Velzon clickable stars pattern === */}
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1.5">รีวิวสภาพเครื่อง (ดาว)</div>
                                {/* Clickable star widget — 5★=A, 4★=B, 3★=C, 2★=D, 1★=E */}
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => {
                                      const currentStars = GRADE_TO_STARS[f.conditionGrade] || 0
                                      const isFilled = s <= currentStars
                                      return (
                                        <button
                                          key={s}
                                          type="button"
                                          onClick={() => {
                                            // Map stars back to grade
                                            const starToGrade: Record<number, 'A' | 'B' | 'C' | 'D'> = {
                                              5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'D',
                                            }
                                            const newGrade = starToGrade[s]
                                            updateForm(line.id, {
                                              conditionGrade: newGrade,
                                              sendToRepair: newGrade === 'D' ? true : f.sendToRepair,
                                              isDamaged: newGrade === 'D' ? true : f.isDamaged,
                                            })
                                          }}
                                          className="p-0.5 hover:scale-110 transition-smooth"
                                          title={`${s} ดาว = Grade ${s === 5 ? 'A' : s === 4 ? 'B' : s === 3 ? 'C' : 'D'}`}
                                        >
                                          <Star
                                            className={`h-7 w-7 transition-smooth ${isFilled ? 'fill-current' : ''}`}
                                            style={{ color: isFilled ? VZ.amber : 'rgba(116,120,141,0.30)' }}
                                          />
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {/* Current grade label */}
                                  {(() => {
                                    const info = GRADE_LABELS[f.conditionGrade]
                                    const stars = GRADE_TO_STARS[f.conditionGrade] || 0
                                    return (
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold ${info.color}`}>Grade {info.label}</span>
                                        <span className="text-[10px] text-muted-foreground">{stars}/5 ดาว</span>
                                      </div>
                                    )
                                  })()}
                                </div>
                                {/* Grade description */}
                                <p className="text-[10px] text-muted-foreground mb-2">
                                  {GRADE_LABELS[f.conditionGrade].description}
                                </p>
                                {/* Grade mapping hint */}
                                <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground mb-1">
                                  <span className="vz-pill vz-pill-success">5★ = A สมบูรณ์</span>
                                  <span className="vz-pill vz-pill-info">4★ = B ดี</span>
                                  <span className="vz-pill vz-pill-warning">3★ = C มีรอย</span>
                                  <span className="vz-pill vz-pill-danger">2★ = D ชำรุด</span>
                                </div>
                              </div>

                              {/* Review comment — Velzon review text pattern (always visible when selected) */}
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                                  <Star className="h-3 w-3" style={{ color: VZ.amber }} />
                                  ความคิดเห็น/รีวิวเครื่อง
                                </div>
                                <Textarea
                                  value={f.comment}
                                  onChange={(e) => updateForm(line.id, { comment: e.target.value })}
                                  placeholder="เช่น สภาพดีเหมือนเดิม, มีรอยถลอกเล็กน้อยที่มุม, แบตเตอรี่เหลือน้อย..."
                                  className="min-h-[60px] text-xs bg-card"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  บันทึกรีวิวเกี่ยวกับสภาพเครื่อง การใช้งาน หรือข้อสังเกตอื่น ๆ (นอกเหนือจากความเสียหาย)
                                </p>
                              </div>

                              {/* === Photo upload (ไม่บังคับ) — Velzon dropzone pattern === */}
                              <div>
                                <div className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                                  <Camera className="h-3 w-3" style={{ color: VZ.primary }} />
                                  รูปถ่ายเครื่อง (ไม่บังคับ)
                                </div>
                                {/* Photo previews — Velzon avatar-sm thumbnail pattern */}
                                {f.photos.length > 0 && (
                                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                                    {f.photos.map((photo, idx) => (
                                      <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={photo.path} alt={photo.caption || `รูปที่ ${idx + 1}`} className="w-full h-full object-cover" />
                                        {/* Remove button overlay */}
                                        <button
                                          type="button"
                                          onClick={() => updateForm(line.id, {
                                            photos: f.photos.filter((_, i) => i !== idx),
                                          })}
                                          className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth"
                                          title="ลบรูป"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                        {photo.caption && (
                                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate">
                                            {photo.caption}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Upload zone — Velzon dropzone style */}
                                <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-border rounded-md cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-smooth">
                                  <Upload className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-[11px] text-muted-foreground">
                                    {f.photos.length > 0 ? 'เพิ่มรูปอื่น' : 'แนบรูปถ่ายเครื่อง'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={async (e) => {
                                      const files = e.target.files
                                      if (!files || files.length === 0) return
                                      const newPhotos: Array<{ path: string; caption: string }> = [...f.photos]
                                      for (const file of Array.from(files)) {
                                        // แปลงเป็น base64 แล้วส่งไป /api/uploads
                                        const dataUrl = await new Promise<string>((resolve, reject) => {
                                          const reader = new FileReader()
                                          reader.onload = () => resolve(reader.result as string)
                                          reader.onerror = reject
                                          reader.readAsDataURL(file)
                                        })
                                        const res = await fetch('/api/uploads', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ data: dataUrl, caption: file.name }),
                                        })
                                        if (res.ok) {
                                          const data = await res.json()
                                          newPhotos.push({ path: data.path, caption: data.caption || '' })
                                        }
                                      }
                                      updateForm(line.id, { photos: newPhotos })
                                      // Reset input value so same file can be selected again
                                      e.target.value = ''
                                    }}
                                  />
                                </label>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  รองรับ PNG, JPG, WebP — แนบได้หลายรูป (ไม่บังคับ)
                                </p>
                              </div>

                              {/* Source return option */}
                              {line.source !== 'Demo_Stock' && (
                                <label className="flex items-center gap-1.5 text-xs">
                                  <Checkbox
                                    checked={f.returnToSource}
                                    onCheckedChange={(v) => updateForm(line.id, { returnToSource: !!v })}
                                    className="h-3 w-3"
                                  />
                                  <span>คืนไปยัง source ต้นทาง ({SOURCE_LABELS[line.source]?.label})</span>
                                </label>
                              )}

                              {/* Damage description + repair flag */}
                              {(f.isDamaged || f.conditionGrade === 'D') && (
                                <div className="space-y-1.5 p-2 rounded" style={{ backgroundColor: 'rgba(240,101,72,0.06)', border: '1px solid rgba(240,101,72,0.15)' }}>
                                  <Textarea
                                    value={f.damageDescription}
                                    onChange={(e) => updateForm(line.id, { damageDescription: e.target.value })}
                                    placeholder="รายละเอียดความเสียหาย..."
                                    className="min-h-[50px] text-xs bg-card"
                                  />
                                  <label className="flex items-center gap-1.5 text-xs">
                                    <Checkbox checked={f.sendToRepair} onCheckedChange={(v) => updateForm(line.id, { sendToRepair: !!v })} className="h-3 w-3" />
                                    <span style={{ color: VZ.purple }}>ส่งเข้าคิวซ่อม (สร้าง RMA อัตโนมัติ)</span>
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* === Already returned === */}
                {returnedLines.length > 0 && (
                  <div className="vz-card">
                    <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4" style={{ color: VZ.teal }} />
                      <h5 className="text-sm font-semibold text-foreground mb-0">รับคืนแล้ว ({returnedLines.length})</h5>
                    </div>
                    <div className="p-3 space-y-1">
                      {returnedLines.map((line) => (
                        <div key={line.id} className="flex items-center gap-2 p-1.5 text-xs bg-muted/30 rounded">
                          <CheckCircle2 className="h-3 w-3" style={{ color: VZ.teal }} />
                          <span className="font-mono text-foreground">{line.assetTagId}</span>
                          <span className="text-muted-foreground">{line.brand} {line.model}</span>
                          <SourceBadge source={line.source} className="ml-auto" />
                          <span className="text-muted-foreground text-[10px]">{line.returnedAt ? formatThaiDate(line.returnedAt) : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* === Past return events — Velzon "Products Reviews" pattern (quote cards) === */}
                {loan.returnEvents && loan.returnEvents.length > 0 && (
                  <div className="vz-card">
                    <div className="px-4 py-3 vz-divider">
                      <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                        <History className="h-4 w-4" style={{ color: VZ.purple }} /> รีวิวการรับคืนย้อนหลัง ({loan.returnEvents.length})
                      </h5>
                    </div>
                    <div className="p-3 space-y-2">
                      {loan.returnEvents.map((ev, i) => {
                        // Compute average stars for this return event
                        const avgEventStars = ev.items.length > 0
                          ? ev.items.reduce((s, it) => s + (GRADE_TO_STARS[it.conditionGrade] || 4), 0) / ev.items.length
                          : 0
                        return (
                          <div key={ev.id} className="border border-dashed border-border rounded-md p-3">
                            {/* Header row — avatar + name + stars + date */}
                            <div className="flex items-start gap-2.5">
                              {/* avatar-sm */}
                              <div className="vz-avatar h-8 w-8 text-[10px]" style={{ backgroundColor: 'rgba(160,113,240,0.10)', color: VZ.purple }}>
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <h6 className="text-xs font-semibold text-foreground mb-0">ครั้งที่ {i + 1} — {ev.inspectorName}</h6>
                                    <p className="text-[10px] text-muted-foreground">{formatThaiDateTime(ev.returnDate)}</p>
                                  </div>
                                  {/* Star rating — Velzon rating pattern */}
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        className={`h-3 w-3 ${s <= Math.round(avgEventStars) ? 'fill-current' : ''}`}
                                        style={{ color: s <= Math.round(avgEventStars) ? VZ.amber : 'rgba(116,120,141,0.3)' }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {/* Quote — Velzon review text */}
                                {ev.notes && (
                                  <p className="text-[11px] text-muted-foreground italic mt-1.5 mb-2">"{ev.notes}"</p>
                                )}
                                {/* Items reviewed */}
                                <div className="mt-1.5 space-y-1">
                                  {ev.items.map((item) => (
                                    <div key={item.id} className="p-1.5 bg-muted/30 rounded text-[11px]">
                                      {/* Row 1: tagId + brand + badges */}
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-foreground">{item.loanLineItem.asset.tagId}</span>
                                        <span className="text-muted-foreground truncate flex-1">{item.loanLineItem.asset.catalog.brand} {item.loanLineItem.asset.catalog.model}</span>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <GradeBadge grade={item.conditionGrade} />
                                          {item.sendToRepair && (
                                            <span className="vz-pill" style={{ backgroundColor: 'rgba(160,113,240,0.10)', color: VZ.purple }}>
                                              <Wrench className="h-2.5 w-2.5" /> ซ่อม
                                            </span>
                                          )}
                                          {!item.returnToSource && (
                                            <span className="vz-pill vz-pill-warning">เปลี่ยน source</span>
                                          )}
                                          {item.isDamaged && (
                                            <span className="vz-pill vz-pill-danger">เสียหาย</span>
                                          )}
                                        </div>
                                      </div>
                                      {/* Row 2: comment (if exists) — Velzon review quote pattern */}
                                      {item.comment && (
                                        <div className="mt-1.5 pl-1 text-muted-foreground italic text-[10px] leading-relaxed">
                                          "{item.comment}"
                                        </div>
                                      )}
                                      {/* Row 3: photos (if exists) — Velzon thumbnail strip */}
                                      {item.photos && item.photos.length > 0 && (
                                        <div className="mt-2 flex gap-1 flex-wrap">
                                          {item.photos.map((photo) => (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                              key={photo.id}
                                              src={photo.photoPath}
                                              alt={photo.caption || ''}
                                              title={photo.caption || ''}
                                              className="h-12 w-12 object-cover rounded border border-border cursor-pointer hover:border-primary hover:scale-105 transition-smooth"
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* === Inspector info + signature === */}
                <div className="vz-card">
                  <div className="px-4 py-3 vz-divider">
                    <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                      <User className="h-4 w-4" style={{ color: VZ.primary }} /> ข้อมูลเจ้าหน้าที่รับคืน
                    </h5>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">ชื่อเจ้าหน้าที่ <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} className="pl-7 h-9 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">หมายเหตุการรับคืน</label>
                      <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="บันทึกเพิ่มเติม..." className="min-h-[50px] text-sm" />
                    </div>
                    <SignaturePad ref={sigRef} label="ลายมือชื่อเจ้าหน้าที่รับคืน" required height={120} onChange={setSigHasContent} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Action bar */}
        <div className="border-t p-3 bg-card">
          <Button
            className="w-full"
            size="lg"
            onClick={submit}
            disabled={submitting || selectedCount === 0 || !sigHasContent || !inspectorName}
            style={{ backgroundColor: VZ.teal, color: 'white' }}
          >
            {submitting ? 'กำลังบันทึก...' : <><ShieldCheck className="h-4 w-4 mr-2" /> ยืนยันรับคืน ({selectedCount})</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
