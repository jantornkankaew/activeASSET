'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  LoanStatusBadge, PurposeBadge, EmptyState, LoadingState, PhaseStepper,
} from './shared'
import { LoanDetailSheet, type LoanDetail } from './LoanDetailSheet'
import { DispatchSheet } from './DispatchSheet'
import { DeliverSheet } from './DeliverSheet'
import { ReturnLoanSheet } from './ReturnLoanSheet'
import {
  Search, Plus, FileText, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, ChevronDown, Package, Truck, ScanLine,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil,
} from '@/lib/activeasset-constants'

interface LoanListItem {
  docNo: string
  customerName: string
  customerCompany: string | null
  customerIndustry: string | null
  salesRepName: string
  purpose: string
  requestedAt: string
  expectedReturnDate: string
  dispatchedAt: string | null
  deliveredAt: string | null
  closedAt: string | null
  status: string
  customerSignedAt: string | null
  totalRequested: number
  totalFulfilled: number
  totalDispatched: number
  returnedItems: number
  pendingItems: number
  requestLines: Array<{
    id: string
    model: string
    brand: string
    quantity: number
    fulfilledQty: number
  }>
  lines: Array<{
    id: string
    assetTagId: string
    source: string
    status: string
  }>
}

interface LoansTabProps {
  createLoanOpen: boolean
  onOpenCreateLoan: () => void
  refreshKey?: number
  initialOpenDocNo?: string | null
  onConsumeInitialDocNo?: () => void
}

// 3 main columns + sub-statuses stacked inside
const MAIN_COLUMNS = [
  {
    id: 'pre-delivery',
    label: 'ก่อนส่งมอบ',
    color: 'blue',
    icon: <Package className="h-4 w-4" />,
    statuses: ['Queued', 'Requested', 'Dispatching', 'Dispatched'],
    subLabels: { Queued: 'ติดคิว', Requested: 'รอจัด', Dispatching: 'กำลังจัด', Dispatched: 'รอส่งมอบ' },
  },
  {
    id: 'active',
    label: 'กำลังยืม',
    color: 'emerald',
    icon: <Truck className="h-4 w-4" />,
    statuses: ['Delivered'],
    subLabels: { Delivered: 'กำลังยืม' },
  },
  {
    id: 'returned',
    label: 'คืนแล้ว',
    color: 'slate',
    icon: <CheckCircle2 className="h-4 w-4" />,
    statuses: ['Partially_Returned', 'Returned'],
    subLabels: { Partially_Returned: 'คืนบางส่วน', Returned: 'คืนครบ' },
  },
] as const

const COLUMN_STYLES: Record<string, { header: string; dot: string; count: string; subBadge: string }> = {
  blue: {
    header: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    count: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    subBadge: 'bg-blue-500/8 text-blue-600 dark:text-blue-400 border-blue-500/15',
  },
  emerald: {
    header: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    count: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    subBadge: 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 border-emerald-500/15',
  },
  slate: {
    header: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
    count: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    subBadge: 'bg-slate-500/8 text-slate-600 dark:text-slate-400 border-slate-500/15',
  },
}

export function LoansTab({ createLoanOpen, onOpenCreateLoan, refreshKey, initialOpenDocNo, onConsumeInitialDocNo }: LoansTabProps) {
  const [loans, setLoans] = useState<LoanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState('all')

  const [detailDocNo, setDetailDocNo] = useState<string | null>(null)
  const [dispatchLoan, setDispatchLoan] = useState<LoanDetail | null>(null)
  const [deliverLoan, setDeliverLoan] = useState<LoanDetail | null>(null)
  const [returnLoan, setReturnLoan] = useState<LoanDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/loans?${params.toString()}`)
    const data = await res.json()
    setLoans(data.loans || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load, refreshKey])

  useEffect(() => {
    if (!initialOpenDocNo) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) {
        setDetailDocNo(initialOpenDocNo)
        onConsumeInitialDocNo?.()
      }
    })
    return () => { cancelled = true }
  }, [initialOpenDocNo, onConsumeInitialDocNo])

  // Group loans by main column + sub-status
  const loansByMainColumn = useMemo(() => {
    const grouped: Record<string, { status: string; label: string; items: LoanListItem[] }[]> = {}
    for (const col of MAIN_COLUMNS) {
      const subGroups: { status: string; label: string; items: LoanListItem[] }[] = []
      for (const st of col.statuses) {
        const items = loans.filter(l => l.status === st)
        if (items.length > 0) {
          subGroups.push({
            status: st,
            label: col.subLabels[st as keyof typeof col.subLabels] || st,
            items,
          })
        }
      }
      grouped[col.id] = subGroups
    }
    return grouped
  }, [loans])

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Top bar — search + view toggle + create */}
      <Card className="shadow-premium">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-2 items-stretch">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาเลขที่ใบยืม / ชื่อลูกค้า / บริษัท..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/30 border-border/50"
              />
            </div>
            {/* View toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-lg">
              <button
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-smooth ${viewMode === 'kanban' ? 'bg-card shadow-premium text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-smooth ${viewMode === 'list' ? 'bg-card shadow-premium text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
            <Button onClick={onOpenCreateLoan} className="h-10 rounded-xl">
              <Plus className="h-4 w-4 mr-1" /> ขอยืมใหม่
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && <LoadingState />}

      {/* ===== KANBAN VIEW — 3 main columns + sub-status stacks ===== */}
      {!loading && viewMode === 'kanban' && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {MAIN_COLUMNS.map((col) => {
              const subGroups = loansByMainColumn[col.id] || []
              const totalItems = subGroups.reduce((s, g) => s + g.items.length, 0)
              const cs = COLUMN_STYLES[col.color]
              return (
                <div key={col.id} className="w-80 flex-shrink-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg ${cs.count} flex items-center justify-center`}>
                        <span className={cs.header}>{col.icon}</span>
                      </div>
                      <span className={`text-sm font-bold ${cs.header}`}>{col.label}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cs.count}`}>
                      {totalItems}
                    </span>
                  </div>

                  {/* Column body — sub-status stacks */}
                  <div className="space-y-3 min-h-[120px]">
                    {totalItems === 0 && (
                      <div className="rounded-xl border border-dashed border-border/30 p-6 text-center text-xs text-muted-foreground/40">
                        ไม่มีรายการ
                      </div>
                    )}
                    {subGroups.map((sub) => (
                      <SubStatusStack
                        key={sub.status}
                        label={sub.label}
                        count={sub.items.length}
                        cs={cs}
                        items={sub.items}
                        onItemClick={(docNo) => setDetailDocNo(docNo)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== LIST VIEW — Velzon-style table cards ===== */}
      {!loading && viewMode === 'list' && (
        <Card className="shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/40 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-2">เลขที่</div>
            <div className="col-span-3">ลูกค้า</div>
            <div className="col-span-2">พนักงาน</div>
            <div className="col-span-2">สถานะ</div>
            <div className="col-span-2 text-right">ความคืบหน้า</div>
            <div className="col-span-1 text-right">กำหนดคืน</div>
          </div>
          <div className="divide-y divide-border">
            {loans.length === 0 && <EmptyState icon={<FileText className="h-12 w-12" />} message="ไม่พบใบยืม" />}
            {loans.map((l) => {
              const days = daysUntil(l.expectedReturnDate)
              const isOverdue = ['Delivered', 'Partially_Returned'].includes(l.status) && days < 0
              const isDueSoon = ['Delivered', 'Partially_Returned'].includes(l.status) && days >= 0 && days <= 3
              const progressPct = l.totalRequested > 0 ? Math.round((l.totalDispatched / l.totalRequested) * 100) : 0
              return (
                <button
                  key={l.docNo}
                  onClick={() => setDetailDocNo(l.docNo)}
                  className="w-full text-left hover:bg-muted/20 transition-smooth group"
                >
                  {/* Desktop: table row */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                    {/* Doc No + customer avatar */}
                    <div className="col-span-2 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                        {l.customerName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-xs truncate">{l.docNo}</div>
                      </div>
                    </div>
                    {/* Customer */}
                    <div className="col-span-3 min-w-0">
                      <div className="text-sm font-medium truncate">{l.customerName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{l.customerCompany || '-'}</div>
                    </div>
                    {/* Sales rep */}
                    <div className="col-span-2 min-w-0">
                      <div className="text-xs truncate">{l.salesRepName}</div>
                    </div>
                    {/* Status — colored pill */}
                    <div className="col-span-2">
                      <LoanStatusPill status={l.status} />
                    </div>
                    {/* Progress bar */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              l.status === 'Returned' ? 'bg-accent' :
                              l.status === 'Delivered' ? 'bg-emerald-500' :
                              l.status === 'Dispatched' ? 'bg-purple-500' :
                              l.status === 'Dispatching' ? 'bg-amber-500' :
                              l.status === 'Queued' ? 'bg-rose-500' :
                              'bg-primary'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                          {l.totalDispatched}/{l.totalRequested}
                        </span>
                        {l.returnedItems > 0 && (
                          <span className="text-[10px] text-accent whitespace-nowrap">↩{l.returnedItems}</span>
                        )}
                      </div>
                    </div>
                    {/* Due date */}
                    <div className="col-span-1 text-right">
                      <div className={`text-[10px] tabular-nums ${
                        isOverdue ? 'text-rose-600 font-semibold' :
                        isDueSoon ? 'text-amber-600 font-semibold' :
                        'text-muted-foreground'
                      }`}>
                        {isOverdue ? `${Math.abs(days)}d` : formatThaiDate(l.expectedReturnDate)}
                      </div>
                    </div>
                  </div>

                  {/* Mobile: card */}
                  <div className="md:hidden p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-8 w-8 rounded-full bg-primary/8 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                        {l.customerName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-semibold text-xs">{l.docNo}</div>
                        <div className="text-xs truncate">{l.customerName}</div>
                      </div>
                      <LoanStatusPill status={l.status} />
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span>{l.salesRepName}</span>
                      <span>•</span>
                      <span className={isOverdue ? 'text-rose-600 font-medium' : ''}>
                        {isOverdue ? `เกิน ${Math.abs(days)}d` : `คืน ${formatThaiDate(l.expectedReturnDate)}`}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Sheets */}
      <LoanDetailSheet
        open={!!detailDocNo}
        onOpenChange={(o) => !o && setDetailDocNo(null)}
        docNo={detailDocNo}
        onDispatch={(loan) => { setDetailDocNo(null); setDispatchLoan(loan) }}
        onDeliver={(loan) => { setDetailDocNo(null); setDeliverLoan(loan) }}
        onReturn={(loan) => { setDetailDocNo(null); setReturnLoan(loan) }}
      />
      <DispatchSheet
        open={!!dispatchLoan}
        onOpenChange={(o) => !o && setDispatchLoan(null)}
        loan={dispatchLoan}
        onDone={() => { load() }}
      />
      <DeliverSheet
        open={!!deliverLoan}
        onOpenChange={(o) => !o && setDeliverLoan(null)}
        loan={deliverLoan}
        onDone={() => { load() }}
      />
      <ReturnLoanSheet
        open={!!returnLoan}
        onOpenChange={(o) => !o && setReturnLoan(null)}
        loan={returnLoan}
        onDone={() => { load() }}
      />
    </div>
  )
}

// ===== Loan Card (for Kanban) =====
function LoanCard({ loan, onClick }: { loan: LoanListItem; onClick: () => void }) {
  const days = daysUntil(loan.expectedReturnDate)
  const isOverdue = ['Delivered', 'Partially_Returned'].includes(loan.status) && days < 0
  const isDueSoon = ['Delivered', 'Partially_Returned'].includes(loan.status) && days >= 0 && days <= 3

  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-3 rounded-xl bg-card border border-border/50 shadow-premium hover-lift transition-smooth"
    >
      {/* Header — doc no + overdue badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono font-semibold text-xs">{loan.docNo}</span>
        {isOverdue && (
          <Badge variant="outline" className="text-[10px] text-rose-700 bg-rose-50 border-rose-200 animate-pulse">
            เกิน {Math.abs(days)}d
          </Badge>
        )}
        {isDueSoon && (
          <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
            {days}d
          </Badge>
        )}
      </div>

      {/* Customer */}
      <div className="text-sm font-medium truncate mb-0.5">{loan.customerName}</div>
      {loan.customerCompany && (
        <div className="text-xs text-muted-foreground truncate mb-1.5">{loan.customerCompany}</div>
      )}

      {/* Items summary — visual chips */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {loan.requestLines.slice(0, 3).map((rl) => (
          <span key={rl.id} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
            {rl.brand} {rl.model} ×{rl.quantity}
          </span>
        ))}
        {loan.requestLines.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{loan.requestLines.length - 3}</span>
        )}
      </div>

      {/* Footer — progress + dates */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <Package className="h-3 w-3" />
            <span className="tabular-nums">{loan.totalDispatched}/{loan.totalRequested}</span>
          </span>
          {loan.returnedItems > 0 && (
            <span className="flex items-center gap-0.5 text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              <span className="tabular-nums">{loan.returnedItems}</span>
            </span>
          )}
          {loan.customerSignedAt && (
            <span className="text-blue-500" title="ลูกค้าเซ็นแล้ว">✓</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatThaiDate(loan.expectedReturnDate)}</span>
        </div>
      </div>
    </button>
  )
}

// ===== Sub-Status Stack — กลุ่มย่อยในแต่ละคอลัมน์ (collapsible) =====
function SubStatusStack({
  label, count, cs, items, onItemClick,
}: {
  label: string
  count: number
  cs: { header: string; dot: string; count: string; subBadge: string }
  items: LoanListItem[]
  onItemClick: (docNo: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-xl bg-muted/20 border border-border/30 overflow-hidden">
      {/* Sub-header — clickable to collapse */}
      <button
        className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-muted/40 transition-smooth"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${cs.header}`}>{label}</span>
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cs.count}`}>
          {count}
        </span>
      </button>

      {/* Cards — collapsible */}
      {expanded && (
        <div className="space-y-1.5 p-1.5 pt-0">
          {items.map((l) => (
            <LoanCard key={l.docNo} loan={l} onClick={() => onItemClick(l.docNo)} />
          ))}
        </div>
      )}

      {/* Collapsed preview — show top card peeking */}
      {!expanded && items.length > 0 && (
        <div className="px-1.5 pb-1.5 -mt-0.5">
          <div className="p-2 rounded-lg bg-card/50 border border-border/30 opacity-60">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold">{items[0].docNo}</span>
              <span className="text-[10px] text-muted-foreground">+{items.length - 1} อื่นๆ</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Velzon-style Status Pill =====
function LoanStatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    Queued: { bg: 'bg-rose-500/10', text: 'text-rose-600', dot: 'bg-rose-500', label: 'ติดคิว' },
    Requested: { bg: 'bg-blue-500/10', text: 'text-blue-600', dot: 'bg-blue-500', label: 'รอจัด' },
    Dispatching: { bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500', label: 'กำลังจัด' },
    Dispatched: { bg: 'bg-purple-500/10', text: 'text-purple-600', dot: 'bg-purple-500', label: 'รอส่งมอบ' },
    Delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500', label: 'กำลังยืม' },
    Partially_Returned: { bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500', label: 'คืนบางส่วน' },
    Returned: { bg: 'bg-slate-400/10', text: 'text-slate-500', dot: 'bg-slate-400', label: 'คืนครบ' },
  }
  const s = styles[status] || { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: status }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-[10px] font-medium whitespace-nowrap`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
