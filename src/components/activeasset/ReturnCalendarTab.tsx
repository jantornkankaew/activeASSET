'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, AlertTriangle,
  Clock, Package, Tag, CheckCircle2, User, Building, Eye, ArrowRight,
  Filter
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LoadingState } from './shared'
import { formatThaiDate, daysUntil } from '@/lib/activeasset-constants'

// Velzon Color Tokens
const VZ_COLORS = {
  primary: '#405189', // Indigo/Navy
  teal: '#0ab39c',    // Success/Teal
  amber: '#f7b84b',   // Warning/Amber
  rose: '#f06548',    // Danger/Rose
  purple: '#6559cc',  // Info/Purple
  cyan: '#299cdb',    // Sky/Cyan
  slate: '#74788d',   // Secondary/Slate
}

export type CalendarViewType = 'month' | 'week' | 'day' | 'list'

export interface CalendarLoan {
  docNo: string
  customerName: string
  customerCompany: string | null
  customerIndustry?: string | null
  salesRepName: string
  purpose: string
  status: string
  expectedReturnDate: string
  requestedAt: string
  lineItems: Array<{ tagId: string; brand: string; model: string }>
}

interface ReturnCalendarTabProps {
  onOpenLoan: (docNo: string | null) => void
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]
const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
const THAI_DAYS_FULL = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']

interface CategoryMeta {
  key: string
  label: string
  shortLabel: string
  color: string
  bgSubtle: string
  borderSubtle: string
  icon: typeof AlertTriangle
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: 'overdue',
    label: 'เกินกำหนด (Overdue)',
    shortLabel: 'เกินกำหนด',
    color: '#f06548',
    bgSubtle: 'rgba(240, 101, 72, 0.12)',
    borderSubtle: 'rgba(240, 101, 72, 0.35)',
    icon: AlertTriangle,
  },
  {
    key: 'due_soon',
    label: 'ใกล้ครบ (≤ 3 วัน)',
    shortLabel: 'ใกล้ครบ',
    color: '#f7b84b',
    bgSubtle: 'rgba(247, 184, 75, 0.15)',
    borderSubtle: 'rgba(247, 184, 75, 0.40)',
    icon: Clock,
  },
  {
    key: 'on_loan',
    label: 'ยืมตามกำหนด (On Loan)',
    shortLabel: 'ยืมตามกำหนด',
    color: '#299cdb',
    bgSubtle: 'rgba(41, 156, 219, 0.12)',
    borderSubtle: 'rgba(41, 156, 219, 0.35)',
    icon: Package,
  },
  {
    key: 'standby',
    label: 'เครื่องสำรอง (Standby)',
    shortLabel: 'เครื่องสำรอง',
    color: '#6559cc',
    bgSubtle: 'rgba(101, 89, 204, 0.12)',
    borderSubtle: 'rgba(101, 89, 204, 0.35)',
    icon: Tag,
  },
  {
    key: 'returned',
    label: 'คืนแล้ว (Returned)',
    shortLabel: 'คืนแล้ว',
    color: '#0ab39c',
    bgSubtle: 'rgba(10, 179, 156, 0.12)',
    borderSubtle: 'rgba(10, 179, 156, 0.35)',
    icon: CheckCircle2,
  },
]

export function ReturnCalendarTab({ onOpenLoan }: ReturnCalendarTabProps) {
  const [loans, setLoans] = useState<CalendarLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<CalendarViewType>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarLoan | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [upcomingModalOpen, setUpcomingModalOpen] = useState(false)

  useEffect(() => {
    fetch('/api/loans')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.loans || []).map((l: Record<string, unknown>) => ({
          docNo: l.docNo as string,
          customerName: l.customerName as string,
          customerCompany: l.customerCompany as string | null,
          customerIndustry: l.customerIndustry as string | null,
          salesRepName: l.salesRepName as string,
          purpose: l.purpose as string,
          status: l.status as string,
          expectedReturnDate: l.expectedReturnDate as string,
          requestedAt: l.requestedAt as string,
          lineItems: (l.lines as Array<{ assetTagId: string; asset: { catalog: { brand: string; model: string } } }>)?.map(li => ({
            tagId: li.assetTagId,
            brand: li.asset?.catalog?.brand || '',
            model: li.asset?.catalog?.model || '',
          })) || [],
        }))
        setLoans(mapped)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Identify loan category
  const getLoanCategory = (loan: CalendarLoan): CategoryMeta => {
    if (loan.status === 'Returned') return CATEGORIES[4]
    const days = daysUntil(loan.expectedReturnDate)
    if (['Dispatched', 'Delivered', 'Partially_Returned', 'Requested'].includes(loan.status)) {
      if (days < 0) return CATEGORIES[0] // Overdue
      if (days <= 3) return CATEGORIES[1] // Due soon
      if (loan.purpose === 'Standby_Repair') return CATEGORIES[3] // Standby
      return CATEGORIES[2] // Normal on-loan
    }
    return CATEGORIES[2]
  }

  // Filtered loans based on category filter
  const filteredLoans = useMemo(() => {
    if (!categoryFilter) return loans
    return loans.filter(l => getLoanCategory(l).key === categoryFilter)
  }, [loans, categoryFilter])

  // Group by date (YYYY-MM-DD)
  const loansByDate = useMemo(() => {
    const map: Record<string, CalendarLoan[]> = {}
    for (const l of filteredLoans) {
      if (!l.expectedReturnDate) continue
      const dateStr = l.expectedReturnDate.split('T')[0]
      if (!map[dateStr]) map[dateStr] = []
      map[dateStr].push(l)
    }
    return map
  }, [filteredLoans])

  // Upcoming returns list (sorted upcoming within 30 days)
  const upcomingEvents = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    return loans
      .filter(l => ['Dispatched', 'Delivered', 'Partially_Returned'].includes(l.status))
      .filter(l => new Date(l.expectedReturnDate) >= startOfToday)
      .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())
      .slice(0, 20)
  }, [loans])

  // Date Navigation Handlers
  const handlePrev = () => {
    const d = new Date(currentDate)
    if (viewType === 'month' || viewType === 'list') {
      d.setMonth(d.getMonth() - 1)
    } else if (viewType === 'week') {
      d.setDate(d.getDate() - 7)
    } else if (viewType === 'day') {
      d.setDate(d.getDate() - 1)
    }
    setCurrentDate(d)
  }

  const handleNext = () => {
    const d = new Date(currentDate)
    if (viewType === 'month' || viewType === 'list') {
      d.setMonth(d.getMonth() + 1)
    } else if (viewType === 'week') {
      d.setDate(d.getDate() + 7)
    } else if (viewType === 'day') {
      d.setDate(d.getDate() + 1)
    }
    setCurrentDate(d)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Monthly stats
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthLoans = useMemo(() => {
    return loans.filter(l => {
      if (!l.expectedReturnDate) return false
      const d = new Date(l.expectedReturnDate)
      return d.getMonth() === month && d.getFullYear() === year
    })
  }, [loans, month, year])

  const overdueCount = monthLoans.filter(l => daysUntil(l.expectedReturnDate) < 0 && l.status !== 'Returned').length
  const dueSoonCount = monthLoans.filter(l => {
    const d = daysUntil(l.expectedReturnDate)
    return d >= 0 && d <= 3 && l.status !== 'Returned'
  }).length

  if (loading) return <LoadingState />

  return (
    <div className="w-full animate-fade-in flex flex-col">
      {/* ===== FULL-WIDTH & FULL-HEIGHT CALENDAR CARD ===== */}
      <div className="vz-card p-3 sm:p-4 w-full shadow-sm flex flex-col bg-card">
        
        {/* ===== TOP TOOLBAR (Velzon FullCalendar Header) ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pb-2.5 border-b border-border flex-shrink-0">
          
          {/* Left: Prev / Today / Next & Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handlePrev}
                title="ย้อนกลับ"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs font-semibold"
                onClick={handleToday}
              >
                วันนี้
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleNext}
                title="ถัดไป"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-1.5 ml-1">
              {overdueCount > 0 && (
                <span className="vz-pill vz-pill-danger font-semibold">{overdueCount} เกิน</span>
              )}
              {dueSoonCount > 0 && (
                <span className="vz-pill vz-pill-warning font-semibold">{dueSoonCount} ใกล้ครบ</span>
              )}
              <span className="vz-pill vz-pill-info font-semibold">{monthLoans.length} ทั้งหมด</span>
            </div>
          </div>

          {/* Center: Month/Year Title */}
          <div className="text-center">
            <h2
              className="text-lg sm:text-2xl font-bold text-foreground mb-0 tracking-tight"
              style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
            >
              {viewType === 'day' ? (
                `${currentDate.getDate()} ${THAI_MONTHS[month]} ${year + 543}`
              ) : (
                `${THAI_MONTHS[month]} ${year + 543}`
              )}
            </h2>
          </div>

          {/* Right: Actions + View Switchers */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            {/* Upcoming Events quick button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => setUpcomingModalOpen(true)}
            >
              <Clock className="h-3.5 w-3.5 mr-1 text-primary" />
              กำหนดคืนเร็วๆ นี้ ({upcomingEvents.length})
            </Button>

            {/* Create Loan Button */}
            <Button
              size="sm"
              className="h-8 text-xs font-semibold text-white shadow-sm"
              style={{
                backgroundColor: VZ_COLORS.primary,
                background: `linear-gradient(135deg, ${VZ_COLORS.primary} 0%, #303e68 100%)`,
              }}
              onClick={() => onOpenLoan(null)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> สร้างใบยืมใหม่
            </Button>

            {/* View Switchers: Month, Week, Day, List */}
            <div className="flex items-center rounded-md bg-muted p-1 text-xs">
              <button
                onClick={() => setViewType('month')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewType === 'month'
                    ? 'bg-card text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewType('week')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewType === 'week'
                    ? 'bg-card text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewType('day')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewType === 'day'
                    ? 'bg-card text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`px-3 py-1 rounded font-medium transition-all ${
                  viewType === 'list'
                    ? 'bg-card text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                List
              </button>
            </div>
          </div>

        </div>

        {/* ===== STATUS CATEGORY FILTER BAR (Velzon Legend) ===== */}
        <div className="flex items-center justify-between flex-wrap gap-2 py-1.5 flex-shrink-0 border-b border-border/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1 mr-1">
              <Filter className="h-3 w-3" /> ตัวกรองสถานะ:
            </span>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              const active = categoryFilter === cat.key
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(active ? null : cat.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium transition-all border ${
                    active
                      ? 'border-primary ring-1 ring-primary shadow-sm font-bold scale-105'
                      : 'border-transparent hover:border-border/60 opacity-90 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: cat.bgSubtle,
                    color: cat.color,
                  }}
                  title={`คลิกเพื่อกรอง ${cat.label}`}
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.shortLabel}</span>
                </button>
              )
            })}

            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter(null)}
                className="text-[11px] text-primary hover:underline font-semibold ml-1"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground hidden sm:block">
            คลิกที่รายการใบยืมเพื่อเปิดดูข้อมูลสรุปและจัดการรับคืน
          </div>
        </div>

        {/* ===== CALENDAR BODY (Stretches to Full Height) ===== */}
        <div className="pt-2 flex flex-col w-full">
          {viewType === 'month' && (
            <MonthGridView
              currentDate={currentDate}
              loansByDate={loansByDate}
              onSelectLoan={setSelectedEvent}
              getLoanCategory={getLoanCategory}
              onSelectDate={d => {
                setCurrentDate(d)
                setViewType('day')
              }}
            />
          )}

          {viewType === 'week' && (
            <WeekGridView
              currentDate={currentDate}
              loansByDate={loansByDate}
              onSelectLoan={setSelectedEvent}
              getLoanCategory={getLoanCategory}
            />
          )}

          {viewType === 'day' && (
            <DayGridView
              currentDate={currentDate}
              loansByDate={loansByDate}
              onSelectLoan={setSelectedEvent}
              getLoanCategory={getLoanCategory}
              onOpenLoan={onOpenLoan}
            />
          )}

          {viewType === 'list' && (
            <ListMonthView
              currentDate={currentDate}
              loans={monthLoans}
              onSelectLoan={setSelectedEvent}
              getLoanCategory={getLoanCategory}
              onOpenLoan={onOpenLoan}
            />
          )}
        </div>

      </div>

      {/* ===== UPCOMING EVENTS MODAL ===== */}
      <Dialog open={upcomingModalOpen} onOpenChange={setUpcomingModalOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-bold text-foreground">
                กำหนดการคืนที่กำลังจะมาถึง ({upcomingEvents.length} รายการ)
              </DialogTitle>
            </div>
          </div>
          <ScrollArea className="max-h-[60vh] p-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                ไม่มีรายการรอรับคืนในเร็วๆ นี้
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(l => {
                  const cat = getLoanCategory(l)
                  const d = new Date(l.expectedReturnDate)
                  const dayNum = d.getDate()
                  const monthText = THAI_MONTHS_SHORT[d.getMonth()]
                  const days = daysUntil(l.expectedReturnDate)

                  return (
                    <div
                      key={l.docNo}
                      onClick={() => {
                        setUpcomingModalOpen(false)
                        setSelectedEvent(l)
                      }}
                      className="p-3 rounded-lg border border-border/80 hover:border-primary/50 hover:bg-muted/40 transition-all cursor-pointer flex gap-3 items-center group bg-card"
                    >
                      <div
                        className="flex-shrink-0 w-12 h-12 rounded-md flex flex-col items-center justify-center border font-medium"
                        style={{
                          backgroundColor: cat.bgSubtle,
                          borderColor: cat.borderSubtle,
                          color: cat.color,
                        }}
                      >
                        <span className="text-sm font-bold leading-none">{dayNum}</span>
                        <span className="text-[10px] uppercase font-semibold leading-none mt-1">{monthText}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {l.docNo}
                          </span>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded"
                            style={{ backgroundColor: cat.bgSubtle, color: cat.color }}
                          >
                            {days === 0 ? 'ครบกำหนดวันนี้' : days > 0 ? `เหลืออีก ${days} วัน` : `เลยกำหนด ${Math.abs(days)} วัน`}
                          </span>
                        </div>
                        <p className="text-xs text-foreground font-medium truncate mt-0.5">
                          {l.customerName} {l.customerCompany ? `(${l.customerCompany})` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {l.lineItems.length > 0 ? l.lineItems.map(i => `${i.brand} ${i.model}`).join(', ') : l.purpose}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="p-3 border-t bg-muted/20">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setUpcomingModalOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Velzon Event Details MODAL ===== */}
      <Dialog open={!!selectedEvent} onOpenChange={open => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-border">
          {selectedEvent && (() => {
            const cat = getLoanCategory(selectedEvent)
            const days = daysUntil(selectedEvent.expectedReturnDate)
            const isOverdue = days < 0 && selectedEvent.status !== 'Returned'

            return (
              <div>
                {/* Modal Header */}
                <div
                  className="px-5 py-3.5 flex items-center justify-between border-b"
                  style={{ backgroundColor: cat.bgSubtle, borderColor: cat.borderSubtle }}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <DialogTitle className="text-sm font-bold text-foreground">
                      ใบยืม {selectedEvent.docNo}
                    </DialogTitle>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: cat.bgSubtle, color: cat.color }}
                  >
                    {cat.label}
                  </span>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4 text-xs">
                  
                  {/* Status & Timing Banner */}
                  <div className="flex items-center justify-between p-2.5 rounded bg-muted/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-[11px] text-muted-foreground">กำหนดคืน</div>
                        <div className="font-semibold text-foreground">
                          {formatThaiDate(selectedEvent.expectedReturnDate)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">สถานะกำหนด</div>
                      <div className={`font-semibold ${isOverdue ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {days === 0 ? 'ครบกำหนดวันนี้' : days > 0 ? `เหลืออีก ${days} วัน` : `เลยกำหนด ${Math.abs(days)} วัน`}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-1.5">
                    <span className="vz-eyebrow">ข้อมูลลูกค้า</span>
                    <div className="p-3 rounded-lg border border-border/70 space-y-1.5">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{selectedEvent.customerName}</span>
                      </div>
                      {selectedEvent.customerCompany && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building className="h-3.5 w-3.5" />
                          <span>{selectedEvent.customerCompany}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="vz-eyebrow text-[9px]">ผู้ดูแล:</span>
                        <span>{selectedEvent.salesRepName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Loan Assets */}
                  <div className="space-y-1.5">
                    <span className="vz-eyebrow">ทรัพย์สินที่ยืม ({selectedEvent.lineItems.length} รายการ)</span>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {selectedEvent.lineItems.length > 0 ? (
                        selectedEvent.lineItems.map(item => (
                          <div
                            key={item.tagId}
                            className="p-2 rounded bg-muted/30 border border-border/50 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Package className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium text-foreground">{item.brand} {item.model}</span>
                            </div>
                            <span className="font-mono text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                              {item.tagId}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-muted-foreground text-[11px]">
                          วัตถุประสงค์: {selectedEvent.purpose}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Modal Footer */}
                <DialogFooter className="px-5 py-3 border-t bg-muted/20 flex flex-row justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedEvent(null)}
                  >
                    ปิด
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs text-white"
                    style={{ backgroundColor: VZ_COLORS.primary }}
                    onClick={() => {
                      const doc = selectedEvent.docNo
                      setSelectedEvent(null)
                      onOpenLoan(doc)
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> ดูใบยืมตัวเต็ม
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =========================================================================
// VIEW 1: MONTH GRID VIEW (Full Width & Stretched to the Bottom of Screen)
// =========================================================================
interface MonthGridViewProps {
  currentDate: Date
  loansByDate: Record<string, CalendarLoan[]>
  onSelectLoan: (l: CalendarLoan) => void
  getLoanCategory: (l: CalendarLoan) => CategoryMeta
  onSelectDate: (d: Date) => void
}

function MonthGridView({ currentDate, loansByDate, onSelectLoan, getLoanCategory, onSelectDate }: MonthGridViewProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((daysInMonth + firstDay.getDay()) / 7) * 7
  const weeksCount = totalCells / 7

  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    cells.push({ date: d, isCurrentMonth: d.getMonth() === month })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card w-full shadow-sm flex flex-col">
      {/* Day Headers (Sun - Sat) */}
      <div
        className="vz-calendar-grid border-b border-border bg-muted/50 flex-shrink-0"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', width: '100%', height: '36px' }}
      >
        {THAI_DAYS_SHORT.map((day, i) => (
          <div
            key={i}
            className={`text-center text-xs font-bold py-2 border-r border-border/40 last:border-r-0 flex items-center justify-center ${
              i === 0 || i === 6 ? 'text-rose-500' : 'text-foreground/80'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Cells Grid - Explicitly stretched to full remaining screen height */}
      <div
        className="vz-calendar-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridTemplateRows: `repeat(${weeksCount}, minmax(0, 1fr))`,
          width: '100%',
          height: 'calc(100vh - 240px)',
          minHeight: '620px',
        }}
      >
        {cells.map(({ date, isCurrentMonth }, i) => {
          const dateStr = date.toISOString().split('T')[0]
          const dayLoans = loansByDate[dateStr] || []
          const isToday = dateStr === todayStr
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const rowIdx = Math.floor(i / 7)
          const colIdx = i % 7

          return (
            <div
              key={i}
              className={`p-2 transition-all relative flex flex-col justify-between overflow-hidden h-full ${
                colIdx < 6 ? 'border-r border-border/40' : ''
              } ${rowIdx < weeksCount - 1 ? 'border-b border-border/40' : ''} ${
                !isCurrentMonth ? 'bg-muted/15 opacity-55' : isWeekend ? 'bg-rose-500/[0.015]' : 'bg-card'
              } ${isToday ? 'bg-primary/[0.06]' : ''}`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground/80 font-medium">
                  {dayLoans.length > 0 ? `${dayLoans.length} คืน` : ''}
                </span>
                <button
                  onClick={() => onSelectDate(date)}
                  className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                    isToday
                      ? 'bg-primary text-primary-foreground shadow-sm scale-110'
                      : isWeekend
                      ? 'text-rose-500 hover:bg-muted'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {date.getDate()}
                </button>
              </div>

              {/* Event Chips (Scrollable if many events in one day) */}
              <div className="space-y-1 flex-1 overflow-y-auto pr-0.5">
                {dayLoans.slice(0, 4).map(l => {
                  const cat = getLoanCategory(l)
                  return (
                    <div
                      key={l.docNo}
                      onClick={() => onSelectLoan(l)}
                      className="px-2 py-1 rounded text-[11px] font-medium truncate cursor-pointer hover:opacity-85 transition-all flex items-center justify-between gap-1 border-l-2 shadow-2xs"
                      style={{
                        backgroundColor: cat.bgSubtle,
                        color: cat.color,
                        borderLeftColor: cat.color,
                      }}
                      title={`${l.docNo} - ${l.customerName} (${l.customerCompany || ''})`}
                    >
                      <span className="font-mono font-bold truncate">{l.docNo.replace('LOAN-', '')}</span>
                      <span className="truncate opacity-90 text-[10px] text-right">{l.customerName}</span>
                    </div>
                  )
                })}
                {dayLoans.length > 4 && (
                  <button
                    onClick={() => onSelectDate(date)}
                    className="text-[10px] text-primary hover:underline px-1 font-semibold block text-left"
                  >
                    +{dayLoans.length - 4} รายการเพิ่มเติม
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =========================================================================
// VIEW 2: WEEK GRID VIEW
// =========================================================================
interface WeekGridViewProps {
  currentDate: Date
  loansByDate: Record<string, CalendarLoan[]>
  onSelectLoan: (l: CalendarLoan) => void
  getLoanCategory: (l: CalendarLoan) => CategoryMeta
}

function WeekGridView({ currentDate, loansByDate, onSelectLoan, getLoanCategory }: WeekGridViewProps) {
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()) // Sunday

  const weekDays: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + i)
    weekDays.push(d)
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="border border-border rounded-md overflow-hidden bg-card w-full shadow-sm flex flex-col">
      <div
        className="vz-calendar-grid border-b border-border bg-muted/30 flex-shrink-0"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', width: '100%', height: '48px' }}
      >
        {weekDays.map((d, i) => {
          const isToday = d.toISOString().split('T')[0] === todayStr
          return (
            <div
              key={i}
              className={`p-2 text-center border-r border-border/40 last:border-r-0 flex flex-col items-center justify-center ${
                isToday ? 'bg-primary/10' : ''
              }`}
            >
              <div className="text-[11px] font-semibold text-muted-foreground">{THAI_DAYS_SHORT[i]}</div>
              <div
                className={`text-xs font-bold inline-flex items-center justify-center h-6 w-6 rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="vz-calendar-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          width: '100%',
          height: 'calc(100vh - 240px)',
          minHeight: '620px',
        }}
      >
        {weekDays.map((d, i) => {
          const dateStr = d.toISOString().split('T')[0]
          const dayLoans = loansByDate[dateStr] || []
          return (
            <div
              key={i}
              className="p-2 border-r border-border/40 last:border-r-0 space-y-1.5 bg-card overflow-y-auto h-full"
            >
              {dayLoans.length === 0 ? (
                <div className="text-center py-8 text-[10px] text-muted-foreground/50">ไม่มีกำหนดคืน</div>
              ) : (
                dayLoans.map(l => {
                  const cat = getLoanCategory(l)
                  return (
                    <div
                      key={l.docNo}
                      onClick={() => onSelectLoan(l)}
                      className="p-2 rounded text-xs border cursor-pointer hover:shadow-sm transition-all"
                      style={{
                        backgroundColor: cat.bgSubtle,
                        borderColor: cat.borderSubtle,
                        color: cat.color,
                      }}
                    >
                      <div className="font-mono font-bold text-[11px] truncate">{l.docNo}</div>
                      <div className="text-[10px] font-medium truncate mt-0.5 opacity-90">{l.customerName}</div>
                      <div className="text-[9px] opacity-75 truncate">{l.lineItems.length} เครื่อง</div>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =========================================================================
// VIEW 3: DAY VIEW
// =========================================================================
interface DayGridViewProps {
  currentDate: Date
  loansByDate: Record<string, CalendarLoan[]>
  onSelectLoan: (l: CalendarLoan) => void
  getLoanCategory: (l: CalendarLoan) => CategoryMeta
  onOpenLoan: (docNo: string | null) => void
}

function DayGridView({ currentDate, loansByDate, onSelectLoan, getLoanCategory, onOpenLoan }: DayGridViewProps) {
  const dateStr = currentDate.toISOString().split('T')[0]
  const dayLoans = loansByDate[dateStr] || []
  const dayIndex = currentDate.getDay()

  return (
    <div
      className="border border-border rounded-md p-4 bg-card space-y-4 w-full shadow-sm overflow-y-auto"
      style={{ height: 'calc(100vh - 240px)', minHeight: '620px' }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-border flex-shrink-0">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            {THAI_DAYS_FULL[dayIndex]} ที่ {currentDate.getDate()} {THAI_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
          </h4>
          <p className="text-xs text-muted-foreground">รายการที่มีกำหนดคืนในวันนี้ทั้งหมด {dayLoans.length} รายการ</p>
        </div>
        <span className="vz-pill vz-pill-info font-semibold">{dayLoans.length} รายการ</span>
      </div>

      {dayLoans.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-xs flex items-center justify-center">
          ไม่มีรายการที่มีกำหนดคืนในวันนี้
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dayLoans.map(l => {
            const cat = getLoanCategory(l)
            return (
              <div
                key={l.docNo}
                className="p-3.5 rounded-lg border border-border hover:shadow-sm transition-all space-y-2 bg-card h-fit"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-foreground">{l.docNo}</span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: cat.bgSubtle, color: cat.color }}
                  >
                    {cat.label}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <div className="font-medium text-foreground">{l.customerName} {l.customerCompany ? `(${l.customerCompany})` : ''}</div>
                  <div className="text-muted-foreground text-[11px]">ผู้ดูแล: {l.salesRepName}</div>
                  <div className="text-muted-foreground text-[11px]">
                    อุปกรณ์: {l.lineItems.map(li => `${li.brand} ${li.model}`).join(', ') || l.purpose}
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => onSelectLoan(l)}
                  >
                    ข้อมูลสรุป
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7 text-white"
                    style={{ backgroundColor: VZ_COLORS.primary }}
                    onClick={() => onOpenLoan(l.docNo)}
                  >
                    เปิดใบยืม <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// =========================================================================
// VIEW 4: LIST MONTH VIEW
// =========================================================================
interface ListMonthViewProps {
  currentDate: Date
  loans: CalendarLoan[]
  onSelectLoan: (l: CalendarLoan) => void
  getLoanCategory: (l: CalendarLoan) => CategoryMeta
  onOpenLoan: (docNo: string | null) => void
}

function ListMonthView({ currentDate, loans, onSelectLoan, getLoanCategory, onOpenLoan }: ListMonthViewProps) {
  const sorted = useMemo(() => {
    return [...loans].sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())
  }, [loans])

  return (
    <div
      className="border border-border rounded-md overflow-hidden bg-card w-full shadow-sm flex flex-col"
      style={{ height: 'calc(100vh - 240px)', minHeight: '620px' }}
    >
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold sticky top-0 bg-muted/80 backdrop-blur-xs">
            <tr>
              <th className="py-2.5 px-3">กำหนดคืน</th>
              <th className="py-2.5 px-3">เลขที่ใบยืม</th>
              <th className="py-2.5 px-3">ลูกค้า / บริษัท</th>
              <th className="py-2.5 px-3">ทรัพย์สิน</th>
              <th className="py-2.5 px-3">ผู้ดูแล</th>
              <th className="py-2.5 px-3">สถานะ</th>
              <th className="py-2.5 px-3 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  ไม่มีรายการยืม-คืนในเดือนนี้
                </td>
              </tr>
            ) : (
              sorted.map(l => {
                const cat = getLoanCategory(l)
                return (
                  <tr key={l.docNo} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-foreground">
                      {formatThaiDate(l.expectedReturnDate)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                      {l.docNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-foreground">{l.customerName}</div>
                      {l.customerCompany && (
                        <div className="text-[11px] text-muted-foreground">{l.customerCompany}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 max-w-[240px] truncate text-muted-foreground">
                      {l.lineItems.length > 0
                        ? l.lineItems.map(i => `${i.brand} ${i.model}`).join(', ')
                        : l.purpose}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {l.salesRepName}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded inline-block"
                        style={{ backgroundColor: cat.bgSubtle, color: cat.color }}
                      >
                        {cat.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => onSelectLoan(l)}
                      >
                        ดูสรุป
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => onOpenLoan(l.docNo)}
                      >
                        เปิดใบยืม
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
