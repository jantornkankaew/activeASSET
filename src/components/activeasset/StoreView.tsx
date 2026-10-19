'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import { LoanDetailSheet } from './LoanDetailSheet'
import {
  Search, ScanLine, ArrowLeft, FileText, CheckCircle2, AlertCircle,
  Package, Wrench, Calendar, User, ClipboardCheck, ShieldCheck, History, Eye,
  ChevronRight,
} from 'lucide-react'
import {
  getLoanStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime,
  GRADE_LABELS, ASSET_STATUS_LABELS, VZ, daysUntil,
} from '@/lib/activeasset-constants'

interface LoanListItem {
  docNo: string
  customerName: string
  customerCompany: string | null
  salesRepName: string
  purpose: string
  checkoutDate: string
  expectedReturnDate: string
  closedAt: string | null
  status: string
  termsAndNotes: string | null
  customerSignedAt: string | null
  customerSignedBy: string | null
  totalItems?: number
  totalDispatched?: number
  totalRequested?: number
  returnedItems: number
  pendingItems: number
  lines: {
    id: string
    assetTagId: string
    serialNo: string
    model: string
    brand: string
    status: string
    returnedAt: string | null
    accessoriesHandedOver: string[]
  }[]
}

interface ReturnItemForm {
  loanLineItemId: string
  selected: boolean
  conditionGrade: 'A' | 'B' | 'C' | 'D'
  accessoriesReturned: string[]
  isDamaged: boolean
  damageDescription: string
  sendToRepair: boolean
  nextLocationId: string
}

export function StoreView() {
  const { toast } = useToast()
  const [loans, setLoans] = useState<LoanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'pending' | 'overdue' | 'partial' | 'closed' | 'all'>('pending')
  const [selectedLoan, setSelectedLoan] = useState<LoanListItem | null>(null)

  // จดจำแท็บของเคาน์เตอร์รับคืนเมื่อ refresh
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = sessionStorage.getItem('activeasset_store_filterTab')
    if (saved && ['pending', 'overdue', 'partial', 'closed', 'all'].includes(saved)) {
      setFilterTab(saved as typeof filterTab)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem('activeasset_store_filterTab', filterTab)
  }, [filterTab])

  // Return form state
  const [returnForms, setReturnForms] = useState<Record<string, ReturnItemForm>>({})
  const [inspectorName, setInspectorName] = useState('เจ้าหน้าที่คลัง (Store)')
  const [returnNotes, setReturnNotes] = useState('')
  const [sigHasContent, setSigHasContent] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)
  const [submitting, setSubmitting] = useState(false)

  // History modal
  const [historyDocNo, setHistoryDocNo] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<unknown>(null)

  // Full detail sheet
  const [detailDocNo, setDetailDocNo] = useState<string | null>(null)

  const loadLoans = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/loans?${params.toString()}`)
    const data = await res.json()
    setLoans(data.loans || [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    const t = setTimeout(loadLoans, 250)
    return () => clearTimeout(t)
  }, [loadLoans])

  // คำนวณยอดสำหรับแท็บกรอง (เฉพาะใบยืมที่ส่งมอบถึงมือลูกค้าแล้วเท่านั้น)
  const counts = useMemo(() => {
    const pending = loans.filter((l) => (l.pendingItems ?? 0) > 0 && ['Delivered', 'Partially_Returned'].includes(l.status)).length
    const overdue = loans.filter((l) => (l.pendingItems ?? 0) > 0 && ['Delivered', 'Partially_Returned'].includes(l.status) && daysUntil(l.expectedReturnDate) < 0).length
    const partial = loans.filter((l) => l.status === 'Partially_Returned' && (l.pendingItems ?? 0) > 0).length
    const closed = loans.filter((l) => l.status === 'Returned' || ((l.pendingItems ?? 0) === 0 && (l.returnedItems ?? 0) > 0)).length
    const relevantAll = loans.filter((l) => ['Delivered', 'Partially_Returned', 'Returned'].includes(l.status)).length
    return { pending, overdue, partial, closed, all: relevantAll }
  }, [loans])

  // กรองเฉพาะรายการที่ส่งมอบถึงลูกค้าแล้ว (Delivered, Partially_Returned)
  // และเรียงลำดับ: 1) ที่กำลังจะครบ หรือครบวันนี้ 2) เกินกำหนด 3) ยังไม่ครบ
  const filteredLoans = useMemo(() => {
    const list = loans.filter((l) => {
      const days = daysUntil(l.expectedReturnDate)
      const isOverdue = (l.pendingItems ?? 0) > 0 && days < 0 && ['Delivered', 'Partially_Returned'].includes(l.status)

      if (filterTab === 'pending') {
        // ต้องส่งถึงลูกค้าแล้วเท่านั้น (กำลังยืม หรือ คืนบางส่วน)
        return (l.pendingItems ?? 0) > 0 && ['Delivered', 'Partially_Returned'].includes(l.status)
      }
      if (filterTab === 'overdue') {
        return isOverdue
      }
      if (filterTab === 'partial') {
        return l.status === 'Partially_Returned' && (l.pendingItems ?? 0) > 0
      }
      if (filterTab === 'closed') {
        return l.status === 'Returned' || ((l.pendingItems ?? 0) === 0 && (l.returnedItems ?? 0) > 0)
      }
      // แท็บทั้งหมดในเคาน์เตอร์รับคืน: แสดงเฉพาะใบยืมที่มีหรือเคยมีของอยู่กับลูกค้า
      return ['Delivered', 'Partially_Returned', 'Returned'].includes(l.status)
    })

    return list.sort((a, b) => {
      const getPriority = (l: LoanListItem) => {
        const isPending = (l.pendingItems ?? 0) > 0
        if (!isPending) return { tier: 4, subOrder: 0 }

        const days = daysUntil(l.expectedReturnDate)
        // Tier 1: กำลังจะครบ หรือครบวันนี้ (0 วัน = ครบวันนี้, 1-3 วัน = กำลังจะครบ)
        if (days >= 0 && days <= 3) {
          return { tier: 1, subOrder: days }
        }
        // Tier 2: ตามด้วยเกินกำหนด (< 0 วัน) เรียงจากเพิ่งเกินกำหนด 1 วัน, 2 วัน, 3 วัน...
        if (days < 0) {
          return { tier: 2, subOrder: Math.abs(days) }
        }
        // Tier 3: แล้วค่อยเป็นยังไม่ครบ (> 3 วัน) เรียงตามวันใกล้มาถึง
        return { tier: 3, subOrder: days }
      }

      const pA = getPriority(a)
      const pB = getPriority(b)

      if (pA.tier !== pB.tier) {
        return pA.tier - pB.tier
      }
      if (pA.subOrder !== pB.subOrder) {
        return pA.subOrder - pB.subOrder
      }
      return a.docNo.localeCompare(b.docNo)
    })
  }, [loans, filterTab])

  const openLoan = (loan: LoanListItem) => {
    setSelectedLoan(loan)
    // Initialize return forms for items that are still Out
    const forms: Record<string, ReturnItemForm> = {}
    for (const line of loan.lines || []) {
      if (line.status === 'Out') {
        forms[line.id] = {
          loanLineItemId: line.id,
          selected: true,
          conditionGrade: 'A',
          accessoriesReturned: [...(line.accessoriesHandedOver || [])],
          isDamaged: false,
          damageDescription: '',
          sendToRepair: false,
          nextLocationId: '',
        }
      }
    }
    setReturnForms(forms)
  }

  const updateForm = (lineId: string, patch: Partial<ReturnItemForm>) => {
    setReturnForms((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))
  }

  const toggleAccessory = (lineId: string, acc: string) => {
    const form = returnForms[lineId]
    if (!form) return
    const has = form.accessoriesReturned.includes(acc)
    updateForm(lineId, {
      accessoriesReturned: has
        ? form.accessoriesReturned.filter((x) => x !== acc)
        : [...form.accessoriesReturned, acc],
    })
  }

  const submitReturn = async () => {
    if (!selectedLoan) return
    const selectedItems = Object.values(returnForms).filter((f) => f.selected)
    if (selectedItems.length === 0) {
      toast({ title: 'เลือกเครื่องที่จะรับคืนอย่างน้อย 1 เครื่อง', variant: 'destructive' })
      return
    }
    if (!inspectorName.trim()) {
      toast({ title: 'ต้องระบุชื่อเจ้าหน้าที่ตรวจรับ', variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'เจ้าหน้าที่ต้องลงลายมือชื่อก่อนยืนยัน', variant: 'destructive' })
      return
    }
    // ตรวจ D ที่ไม่ได้ระบุ damage
    for (const item of selectedItems) {
      if (item.conditionGrade === 'D' && !item.damageDescription.trim()) {
        toast({
          title: `เครื่องในรายการเป็น Grade D ต้องระบุรายละเอียดความเสียหาย`,
          variant: 'destructive',
        })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${selectedLoan.docNo}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorName,
          inspectorSignature: sig,
          notes: returnNotes,
          items: selectedItems.map((f) => ({
            loanLineItemId: f.loanLineItemId,
            conditionGrade: f.conditionGrade,
            accessoriesReturned: f.accessoriesReturned,
            isDamaged: f.isDamaged || f.conditionGrade === 'D',
            damageDescription: f.damageDescription,
            sendToRepair: f.sendToRepair || f.conditionGrade === 'D',
            nextLocationId: f.nextLocationId || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'รับคืนไม่สำเร็จ')
      toast({
        title: `รับคืนสำเร็จ (${selectedItems.length} เครื่อง)`,
        description: data.loanStatus === 'Returned' ? 'ใบยืมปิดสมบูรณ์แล้ว' : `สถานะใบยืม: ${getLoanStatusLabel(data.loanStatus).label} • คงค้าง ${data.remaining} เครื่อง`,
      })
      // Reload loans
      await loadLoans()
      setSelectedLoan(null)
      sigRef.current?.clear()
      setSigHasContent(false)
      setReturnNotes('')
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const openHistory = async (docNo: string) => {
    setHistoryDocNo(docNo)
    setHistoryData(null)
    const res = await fetch(`/api/loans/${docNo}`)
    const data = await res.json()
    setHistoryData(data.loan)
  }

  if (selectedLoan) {
    return (
      <LoanReturnPanel
        loan={selectedLoan}
        returnForms={returnForms}
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        returnNotes={returnNotes}
        setReturnNotes={setReturnNotes}
        sigRef={sigRef}
        sigHasContent={sigHasContent}
        setSigHasContent={setSigHasContent}
        submitting={submitting}
        onBack={() => setSelectedLoan(null)}
        onToggleAccessory={toggleAccessory}
        onUpdateForm={updateForm}
        onSubmit={submitReturn}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-140px)] space-y-4 animate-fade-in">
      {/* ===== Velzon page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            เคาน์เตอร์รับคืน
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">ตรวจรับเครื่องคืน สแกนบาร์โค้ด ตรวจสภาพ และคัดแยกส่งซ่อม (Phase 4)</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Store</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Return Counter</span>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="vz-card p-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่ใบยืม / ชื่อลูกค้า / บริษัท..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'pending', label: 'ต้องรับคืน', count: counts.pending, alert: false },
              { id: 'overdue', label: 'เกินกำหนด', count: counts.overdue, alert: counts.overdue > 0 },
              { id: 'partial', label: 'คืนบางส่วน', count: counts.partial, alert: false },
              { id: 'closed', label: 'คืนครบแล้ว', count: counts.closed, alert: false },
              { id: 'all', label: 'ทั้งหมด', count: counts.all, alert: false },
            ].map((tab) => {
              const active = filterTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as typeof filterTab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
                    active
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/60'
                  }`}
                  style={active ? { backgroundColor: VZ.primary, borderColor: VZ.primary } : undefined}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                      active
                        ? 'bg-white/20 text-white'
                        : tab.alert
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Loans List — Clean Spacious Queue */}
      <div className="vz-card overflow-hidden flex-1 flex flex-col min-h-0 shadow-sm border border-border/60">
        <div className="px-6 py-3.5 vz-divider flex items-center justify-between flex-shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <h5 className="text-base font-semibold text-foreground mb-0">
              {filterTab === 'pending' ? 'รายการที่ต้องรับคืน' : filterTab === 'overdue' ? 'รายการเกินกำหนดส่งคืน' : filterTab === 'partial' ? 'รายการคืนบางส่วน' : filterTab === 'closed' ? 'รายการคืนครบแล้ว' : 'รายการใบยืมทั้งหมด'}
            </h5>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted font-mono font-semibold text-muted-foreground">
              {filteredLoans.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            คลิกแถวเพื่อดูรายละเอียดใบยืม
          </span>
        </div>

        <div className="flex-1 p-0 min-h-0 bg-muted/15">
          <ScrollArea className="h-[calc(100vh-365px)] min-h-[480px]">
            <div className="p-4 sm:p-5 space-y-3">
              {loading && <p className="p-8 text-center text-muted-foreground text-sm">กำลังโหลดข้อมูล...</p>}
              {!loading && filteredLoans.length === 0 && (
                <div className="p-16 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2.5 opacity-25" />
                  <p className="text-sm">ไม่มีรายการในหมวดนี้</p>
                </div>
              )}
              {filteredLoans.map((l) => {
                const days = daysUntil(l.expectedReturnDate)
                const isOverdue = (l.pendingItems ?? 0) > 0 && days < 0
                const isDueToday = (l.pendingItems ?? 0) > 0 && days === 0
                const isDueSoon = (l.pendingItems ?? 0) > 0 && days > 0 && days <= 3
                const totalQty = l.totalDispatched ?? l.lines?.length ?? 0
                const retDate = new Date(l.expectedReturnDate)
                const dayNumber = retDate.getDate()
                const monthName = retDate.toLocaleDateString('th-TH', { month: 'short' })

                return (
                  <div
                    key={l.docNo}
                    onClick={() => setDetailDocNo(l.docNo)}
                    className={`p-4 sm:p-5 rounded-xl border transition-all cursor-pointer bg-card hover:border-primary/50 hover:shadow-md ${
                      isOverdue
                        ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20'
                        : 'border-border/70 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: รูปปฏิทินด้านหน้าสุด + ข้อมูลใบยืม */}
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        {/* 📅 รูปปฏิทินใส่วันที่คืนด้านหน้าสุด */}
                        <div className={`h-13 w-12 rounded-xl flex flex-col items-center justify-between overflow-hidden flex-shrink-0 border shadow-2xs ${
                          isOverdue
                            ? 'border-rose-300 bg-rose-50/60 dark:bg-rose-950/40'
                            : isDueToday
                            ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/40'
                            : 'border-border/80 bg-muted/40'
                        }`}>
                          <span className={`text-[10px] font-bold w-full text-center py-0.5 tracking-wide ${
                            isOverdue
                              ? 'bg-rose-500 text-white'
                              : isDueToday
                              ? 'bg-amber-500 text-white'
                              : 'bg-muted-foreground/15 text-muted-foreground font-semibold'
                          }`}>
                            {monthName}
                          </span>
                          <span className={`text-lg font-bold font-mono leading-none pb-1.5 ${
                            isOverdue ? 'text-rose-600' : isDueToday ? 'text-amber-700' : 'text-foreground'
                          }`}>
                            {dayNumber}
                          </span>
                        </div>

                        {/* ข้อมูลใบยืม */}
                        <div className="space-y-1 flex-1 min-w-0">
                          {/* บรรทัด 1: เลขที่ใบยืม + สถานะ (ไม่ใส่กำลังยืม, ครบกำหนด 0 วัน ใส่แค่ ครบกำหนด) */}
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-base font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                              {l.docNo}
                            </span>
                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                                เกินกำหนด {Math.abs(days)} วัน
                              </span>
                            ) : isDueToday ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                ครบกำหนด
                              </span>
                            ) : isDueSoon ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                ครบกำหนดใน {days} วัน
                              </span>
                            ) : l.status === 'Partially_Returned' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border text-amber-700 bg-amber-50 border-amber-200">
                                คืนบางส่วน
                              </span>
                            ) : null}
                          </div>

                          {/* บรรทัด 2: ข้อมูลลูกค้าและบริษัท */}
                          <div className="text-sm font-semibold text-foreground truncate">
                            {l.customerName}
                            {l.customerCompany && (
                              <span className="text-sm text-muted-foreground font-normal ml-2">
                                • {l.customerCompany}
                              </span>
                            )}
                          </div>


                        </div>
                      </div>

                      {/* Right: ยอดค้างคืน + ปุ่มรับคืน */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border/40 flex-shrink-0">
                        <div className="text-left md:text-right">
                          {(l.pendingItems ?? 0) > 0 ? (
                            <div>
                              <div className="text-xs text-muted-foreground">ยอดที่ต้องรับคืน</div>
                              <div className="text-base font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                ค้าง {l.pendingItems} <span className="text-xs font-normal text-muted-foreground">/ {totalQty} เครื่อง</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="h-4 w-4" /> คืนครบแล้ว ({totalQty} เครื่อง)
                            </div>
                          )}
                        </div>

                        {/* ปุ่มรับคืน */}
                        {(l.pendingItems ?? 0) > 0 && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openLoan(l)
                            }}
                            className="h-9 px-5 text-xs font-semibold rounded-lg text-white shadow-xs hover:shadow transition-all"
                            style={{ backgroundColor: VZ.primary }}
                          >
                            <ScanLine className="h-4 w-4 mr-1.5" /> รับคืน
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {historyDocNo && (
        <HistoryModal docNo={historyDocNo} data={historyData} onClose={() => setHistoryDocNo(null)} />
      )}

      {/* Full Loan Detail Sheet */}
      <LoanDetailSheet
        open={!!detailDocNo}
        onOpenChange={(o) => !o && setDetailDocNo(null)}
        docNo={detailDocNo}
        onDispatch={() => {}}
        onDeliver={() => {}}
        onReturn={(loan) => {
          setDetailDocNo(null)
          const item = loans.find((x) => x.docNo === loan.docNo)
          if (item) openLoan(item)
        }}
      />
    </div>
  )
}

// ===== Loan Return Panel =====
function LoanReturnPanel({
  loan, returnForms, inspectorName, setInspectorName, returnNotes, setReturnNotes,
  sigRef, sigHasContent, setSigHasContent, submitting, onBack,
  onToggleAccessory, onUpdateForm, onSubmit,
}: {
  loan: LoanListItem
  returnForms: Record<string, ReturnItemForm>
  inspectorName: string
  setInspectorName: (v: string) => void
  returnNotes: string
  setReturnNotes: (v: string) => void
  sigRef: React.RefObject<SignaturePadHandle | null>
  sigHasContent: boolean
  setSigHasContent: (v: boolean) => void
  submitting: boolean
  onBack: () => void
  onToggleAccessory: (lineId: string, acc: string) => void
  onUpdateForm: (lineId: string, patch: Partial<ReturnItemForm>) => void
  onSubmit: () => void
}) {
  const pendingLines = loan.lines.filter((l) => l.status === 'Out')
  const returnedLines = loan.lines.filter((l) => l.status === 'Returned')
  const selectedCount = Object.values(returnForms).filter((f) => f.selected).length

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="vz-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-base text-foreground">{loan.docNo}</span>
              <Badge variant="outline" className={`text-xs ${getLoanStatusLabel(loan.status).color} ${getLoanStatusLabel(loan.status).bg}`}>{getLoanStatusLabel(loan.status).label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{loan.customerName}{loan.customerCompany ? ` — ${loan.customerCompany}` : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Store</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Process Return</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: items to return */}
        <div className="lg:col-span-2 space-y-3">
          <div className="vz-card overflow-hidden">
            <div className="px-4 py-3 vz-divider flex items-center justify-between">
              <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> เครื่องที่รอรับคืน ({pendingLines.length})
              </h5>
            </div>
            <div className="p-0">
              {pendingLines.length === 0 && <p className="p-6 text-center text-muted-foreground text-xs">ไม่มีเครื่องค้างคืน</p>}
              <div className="divide-y divide-border">
                {pendingLines.map((line) => {
                  const form = returnForms[line.id]
                  if (!form) return null
                  return (
                    <ReturnItemCard
                      key={line.id}
                      line={line}
                      form={form}
                      onToggleSelected={(v) => onUpdateForm(line.id, { selected: v })}
                      onGradeChange={(g) => onUpdateForm(line.id, {
                        conditionGrade: g,
                        sendToRepair: g === 'D' ? true : form.sendToRepair,
                        isDamaged: g === 'D' ? true : form.isDamaged,
                      })}
                      onToggleAccessory={(acc) => onToggleAccessory(line.id, acc)}
                      onDamagedChange={(v) => onUpdateForm(line.id, { isDamaged: v })}
                      onDamageDescChange={(v) => onUpdateForm(line.id, { damageDescription: v })}
                      onSendRepairChange={(v) => onUpdateForm(line.id, { sendToRepair: v })}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {returnedLines.length > 0 && (
            <div className="vz-card overflow-hidden">
              <div className="px-4 py-3 vz-divider flex items-center justify-between">
                <h5 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-0 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> รับคืนแล้ว ({returnedLines.length})
                </h5>
              </div>
              <div className="p-0">
                <div className="divide-y divide-border">
                  {returnedLines.map((line) => (
                    <div key={line.id} className="p-3 flex items-center gap-3 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <div className="flex-1">
                        <span className="font-mono font-medium text-foreground">{line.assetTagId}</span>
                        <span className="text-muted-foreground"> • {line.brand} {line.model}</span>
                      </div>
                      <span className="text-muted-foreground">คืน {line.returnedAt ? formatThaiDate(line.returnedAt) : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: inspector info + signature */}
        <div className="space-y-4">
          <div className="vz-card">
            <div className="px-4 py-3 vz-divider">
              <h5 className="text-sm font-semibold text-foreground mb-0">ข้อมูลเจ้าหน้าที่</h5>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">ชื่อเจ้าหน้าที่ตรวจรับ <span className="text-rose-500">*</span></label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} className="pl-8" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">หมายเหตุ</label>
                <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="หมายเหตุการรับคืน..." className="mt-1 min-h-[60px]" />
              </div>
              <div className="bg-muted/40 border border-border rounded-md p-3 text-xs space-y-1">
                <div className="font-medium text-foreground">สรุปการรับคืน</div>
                <div className="flex justify-between text-muted-foreground"><span>เลือกรับคืน:</span> <b className="text-foreground">{selectedCount} เครื่อง</b></div>
                <div className="flex justify-between text-muted-foreground"><span>คงค้างหลังยืนยัน:</span> <b className="text-foreground">{pendingLines.length - selectedCount} เครื่อง</b></div>
              </div>
            </div>
          </div>

          <div className="vz-card p-4">
            <SignaturePad ref={sigRef} label="ลายมือชื่อเจ้าหน้าที่รับคืน" required onChange={setSigHasContent} />
            <p className="text-[10px] text-muted-foreground mt-2">ประทับเวลา: {new Date().toLocaleString('th-TH')}</p>
          </div>

          <Button
            className="w-full text-white"
            size="lg"
            onClick={onSubmit}
            disabled={submitting || selectedCount === 0 || !sigHasContent || !inspectorName}
            style={{ backgroundColor: VZ.primary }}
          >
            {submitting ? 'กำลังบันทึก...' : <><ShieldCheck className="h-4 w-4 mr-2" /> ยืนยันรับคืน ({selectedCount})</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReturnItemCard({
  line, form, onToggleSelected, onGradeChange, onToggleAccessory, onDamagedChange, onDamageDescChange, onSendRepairChange,
}: {
  line: LoanListItem['lines'][0]
  form: ReturnItemForm
  onToggleSelected: (v: boolean) => void
  onGradeChange: (g: 'A' | 'B' | 'C' | 'D') => void
  onToggleAccessory: (acc: string) => void
  onDamagedChange: (v: boolean) => void
  onDamageDescChange: (v: string) => void
  onSendRepairChange: (v: boolean) => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Checkbox checked={form.selected} onCheckedChange={(v) => onToggleSelected(!!v)} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold">{line.assetTagId}</span>
            <Badge variant="outline" className="text-xs">{line.brand} {line.model}</Badge>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">S/N: <span className="font-mono">{line.serialNo}</span></div>
        </div>
      </div>

      {form.selected && (
        <div className="mt-3 ml-7 space-y-3 border-l-2 border-slate-200 pl-4">
          {/* Accessories checklist */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">ตรวจสอบอุปกรณ์เสริมที่คืน</div>
            <div className="space-y-1.5">
              {line.accessoriesHandedOver.map((acc) => {
                const checked = form.accessoriesReturned.includes(acc)
                return (
                  <div key={acc} className={`flex items-center gap-2 p-2 rounded border ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => onToggleAccessory(acc)} />
                    <span className={`text-sm ${checked ? 'text-emerald-700' : 'text-rose-700 line-through'}`}>{acc}</span>
                    {checked ? <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" /> : <AlertCircle className="h-3 w-3 text-rose-500 ml-auto" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grade */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">ประเมินเกรดสภาพเครื่อง</div>
            <RadioGroup value={form.conditionGrade} onValueChange={(v) => onGradeChange(v as 'A' | 'B' | 'C' | 'D')} className="grid grid-cols-2 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((g) => {
                const info = GRADE_LABELS[g]
                return (
                  <label key={g} className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer ${form.conditionGrade === g ? `${info.bg} border-current` : 'bg-white border-slate-200'}`}>
                    <RadioGroupItem value={g} className="mt-0.5" />
                    <div>
                      <div className={`text-sm font-bold ${info.color}`}>Grade {info.label}</div>
                      <div className="text-xs text-slate-600">{info.description}</div>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </div>

          {/* Damage (auto-shown for D) */}
          {(form.isDamaged || form.conditionGrade === 'D') && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-700">รายละเอียดความเสียหาย</label>
                <Textarea value={form.damageDescription} onChange={(e) => onDamageDescChange(e.target.value)} placeholder="เช่น จอแตก, หัวพิมพ์ขาด, ปุ่มกดไม่ทำงาน..." className="mt-1 min-h-[60px]" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.sendToRepair} onCheckedChange={(v) => onSendRepairChange(!!v)} />
                <span className="text-purple-700">ส่งเข้าคิวซ่อม (สร้าง RMA Ticket อัตโนมัติ)</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryModal({ docNo, data, onClose }: { docNo: string; data: unknown; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> ประวัติใบยืม {docNo}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {!data && <p className="text-center text-slate-500 py-8">กำลังโหลด...</p>}
            {data ? <HistoryContent loan={data} /> : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function HistoryContent({ loan }: { loan: any }) {
  const returnEvents = (loan.returnEvents as any[]) || []
  const lines = (loan.lines as any[]) || []
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md">
        <div>ลูกค้า: <b>{String(loan.customerName ?? '')}</b></div>
        <div>บริษัท: <b>{String(loan.customerCompany ?? '-')}</b></div>
        <div>พนักงาน: <b>{String(loan.salesRepName ?? '')}</b></div>
        <div>วัตถุประสงค์: <b>{getPurposeLabel(String(loan.purpose ?? ''))}</b></div>
        <div>วันยืม: <b>{formatThaiDate(loan.checkoutDate as string)}</b></div>
        <div>กำหนดคืน: <b>{formatThaiDate(loan.expectedReturnDate as string)}</b></div>
      </div>

      {loan.customerSignAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> ลูกค้าลงนามแล้ว
          </div>
          <div className="mt-1">ผู้ลงนาม: {String(loan.customerSignBy ?? '-')} • เวลา: {formatThaiDateTime(loan.customerSignAt as string)}</div>
          {loan.customerSignature && (
            <img src={loan.customerSignature as string} alt="ลายเซ็นลูกค้า" className="mt-2 max-h-24 border rounded bg-white" />
          )}
        </div>
      )}

      <div>
        <h4 className="font-semibold mb-2">รายการเครื่อง ({lines.length})</h4>
        <div className="divide-y border rounded">
          {lines.map((line, i) => {
            const asset = line.asset as Record<string, unknown>
            const catalog = asset?.catalog as Record<string, unknown>
            return (
              <div key={String(line.id ?? i)} className="p-2 flex items-center gap-2">
                <span className="font-mono text-xs">{String(asset?.tagId ?? '')}</span>
                <span className="text-xs text-slate-600">{String(catalog?.brand ?? '')} {String(catalog?.model ?? '')}</span>
                <Badge variant="outline" className="ml-auto text-xs">{String(line.status ?? '')}</Badge>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">ประวัติการรับคืน ({returnEvents.length})</h4>
        {returnEvents.length === 0 ? (
          <p className="text-slate-500 text-xs">ยังไม่มีการรับคืน</p>
        ) : (
          <div className="space-y-2">
            {returnEvents.map((ev, i) => (
              <div key={String(ev.id ?? i)} className="border rounded p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">รับคืนครั้งที่ {i + 1}</span>
                  <span className="text-xs text-slate-500">{formatThaiDateTime(ev.returnDate as string)}</span>
                </div>
                <div className="text-xs text-slate-600">เจ้าหน้าที่: {String(ev.inspectorName ?? '-')}</div>
                {ev.inspectorSignAt && <div className="text-xs text-slate-600">เวลาลงนาม: {formatThaiDateTime(ev.inspectorSignAt as string)}</div>}
                {ev.notes && <div className="text-xs text-slate-500 mt-1">หมายเหตุ: {String(ev.notes)}</div>}
                <div className="mt-2 space-y-1">
                  {((ev.items as Array<Record<string, unknown>>) || []).map((item, j) => {
                    const lineItem = item.loanLineItem as Record<string, unknown>
                    const a = lineItem?.asset as Record<string, unknown>
                    const c = a?.catalog as Record<string, unknown>
                    return (
                      <div key={String(item.id ?? j)} className="text-xs flex items-center gap-2 bg-white p-2 rounded border">
                        <span className="font-mono">{String(a?.tagId ?? '')}</span>
                        <span>{String(c?.brand ?? '')} {String(c?.model ?? '')}</span>
                        <Badge variant="outline" className="ml-auto">Grade {String(item.conditionGrade ?? '')}</Badge>
                        {item.sendToRepair ? <Badge variant="outline" className="text-purple-700 text-xs">ส่งซ่อม</Badge> : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
