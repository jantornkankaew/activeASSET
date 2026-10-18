'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  EmptyState, LoadingState,
} from './shared'
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, AlertTriangle,
  Clock, Package, Info, MapPin, CheckCircle2,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil,
} from '@/lib/activeasset-constants'

// Velzon color tokens
const VZ = { primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548', purple: '#a071f0', slate: '#74788d' }

// Event categories — Velzon external-events pattern
const EVENT_CATEGORIES = [
  { label: 'เกินกำหนด', color: VZ.rose, bg: 'rgba(240,101,72,0.10)', icon: AlertTriangle },
  { label: 'ใกล้ครบกำหนด', color: VZ.amber, bg: 'rgba(247,184,75,0.12)', icon: Clock },
  { label: 'กำลังยืม', color: VZ.primary, bg: 'rgba(64,81,137,0.10)', icon: Package },
  { label: 'เครื่องสำรอง', color: VZ.purple, bg: 'rgba(160,113,240,0.10)', icon: Clock },
]

interface CalendarLoan {
  docNo: string
  customerName: string
  customerCompany: string | null
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

const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export function ReturnCalendarTab({ onOpenLoan }: ReturnCalendarTabProps) {
  const [loans, setLoans] = useState<CalendarLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  useEffect(() => {
    fetch('/api/loans')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.loans || []).map((l: Record<string, unknown>) => ({
          docNo: l.docNo as string,
          customerName: l.customerName as string,
          customerCompany: l.customerCompany as string | null,
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

  // Determine event category for a loan
  const getLoanCategory = (loan: CalendarLoan) => {
    const days = daysUntil(loan.expectedReturnDate)
    if (loan.status === 'Dispatched' || loan.status === 'Delivered' || loan.status === 'Partially_Returned') {
      if (days < 0) return 0 // Overdue (เกินกำหนด)
      if (days <= 3) return 1 // Due soon (ใกล้ครบกำหนด)
      return 2 // Normal (กำลังยืม)
    }
    if (loan.purpose === 'Standby_Repair') return 3 // Standby (เครื่องสำรอง)
    return 2 // Default: active loan
  }

  // Group loans by date (YYYY-MM-DD)
  const loansByDate: Record<string, CalendarLoan[]> = {}
  for (const l of loans) {
    const dateStr = l.expectedReturnDate.split('T')[0]
    if (!loansByDate[dateStr]) loansByDate[dateStr] = []
    loansByDate[dateStr].push(l)
  }

  // Upcoming returns — sorted by date, only active loans
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = loans
    .filter(l => ['Dispatched', 'Delivered', 'Partially_Returned'].includes(l.status))
    .filter(l => new Date(l.expectedReturnDate) >= today)
    .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime())
    .slice(0, 15)

  // Calendar grid generation
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay()) // Start from Sunday
  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((daysInMonth + firstDay.getDay()) / 7) * 7

  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = []
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    cells.push({ date, isCurrentMonth: date.getMonth() === month })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))
  const goToday = () => setCurrentMonth(new Date())

  // Count stats for current month
  const monthLoans = loans.filter(l => {
    const d = new Date(l.expectedReturnDate)
    return d.getMonth() === month && d.getFullYear() === year
  })
  const overdueCount = monthLoans.filter(l => daysUntil(l.expectedReturnDate) < 0).length
  const dueSoonCount = monthLoans.filter(l => {
    const d = daysUntil(l.expectedReturnDate)
    return d >= 0 && d <= 3
  }).length

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            ปฏิทินการคืน
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">ติดตามและเตรียมตัวสำหรับการรับคืนทรัพย์สิน</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Apps</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Calendar</span>
        </div>
      </div>

      {/* ===== Velzon calendar 2-col layout: col-3 sidebar + col-9 main ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === LEFT sidebar (col-1) === */}
        <div className="lg:col-span-1 space-y-4">
          {/* Create New Event button — Velzon pattern */}
          <div className="vz-card p-4">
            <button
              className="w-full px-3 py-2 rounded-md text-sm font-semibold text-white shadow-sm transition-smooth hover:shadow-md"
              style={{ background: `linear-gradient(135deg, ${VZ.primary}, ${VZ.teal})` }}
              onClick={() => onOpenLoan(null)}
            >
              <Plus className="h-4 w-4 inline mr-1" /> สร้างใบยืมใหม่
            </button>

            {/* External Events — Velzon legend pattern */}
            <p className="text-[11px] text-muted-foreground mt-3 mb-2">หมวดหมู่การคืน</p>
            <div className="space-y-1.5">
              {EVENT_CATEGORIES.map((cat, i) => {
                const Icon = cat.icon
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-default"
                    style={{ backgroundColor: cat.bg, color: cat.color }}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="font-medium">{cat.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Upcoming Events — Velzon pattern */}
          <div>
            <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              การคืนที่กำลังจะมาถึง
            </h5>
            <p className="text-[11px] text-muted-foreground mb-2">อย่าพลาดกำหนดคืน</p>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="space-y-2 pr-1">
              {upcoming.length === 0 && (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-1 text-muted-foreground/30" />
                  ไม่มีการคืนที่กำลังจะมาถึง
                </div>
              )}
              {upcoming.map((l) => {
                const catIdx = getLoanCategory(l)
                const cat = EVENT_CATEGORIES[catIdx]
                const days = daysUntil(l.expectedReturnDate)
                return (
                  <button
                    key={l.docNo}
                    className="w-full text-left p-2.5 rounded-md border border-border hover:bg-muted/30 transition-smooth"
                    onClick={() => onOpenLoan(l.docNo)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-[11px] font-semibold text-foreground truncate">{l.docNo}</span>
                      <span className="ml-auto text-[10px] font-medium" style={{ color: cat.color }}>
                        {days === 0 ? 'วันนี้' : days > 0 ? `${days}d` : `เกิน ${Math.abs(days)}d`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{l.customerName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatThaiDate(l.expectedReturnDate)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Welcome card — Velzon info card pattern */}
          <div className="vz-card p-4" style={{ backgroundColor: 'rgba(10,179,156,0.06)' }}>
            <div className="flex items-start gap-2.5">
              <div className="vz-icon-soft h-8 w-8 flex-shrink-0" style={{ backgroundColor: 'rgba(10,179,156,0.10)' }}>
                <Info className="h-4 w-4" style={{ color: VZ.teal }} />
              </div>
              <div>
                <h6 className="text-xs font-semibold text-foreground mb-0.5">ยินดีต้อนรับสู่ปฏิทินการคืน</h6>
                <p className="text-[10px] text-muted-foreground mb-0">คลิกที่ใบยืมในปฏิทินเพื่อดูรายละเอียดและจัดเตรียมการรับคืน</p>
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT main calendar (col-2) === */}
        <div className="lg:col-span-2">
          <div className="vz-card overflow-hidden">
            {/* Calendar header — month navigation */}
            <div className="px-4 py-3 vz-divider flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h5 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                  {THAI_MONTHS[month]} {year + 543}
                </h5>
                {/* Month stats */}
                <div className="flex items-center gap-2">
                  {overdueCount > 0 && (
                    <span className="vz-pill vz-pill-danger">{overdueCount} เกิน</span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="vz-pill vz-pill-warning">{dueSoonCount} ใกล้</span>
                  )}
                  <span className="vz-pill vz-pill-info">{monthLoans.length} ทั้งหมด</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="vz-icon-soft h-8 w-8 border border-border rounded hover:bg-muted/30 transition-smooth"
                  onClick={prevMonth}
                  title="เดือนก่อนหน้า"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  className="px-2.5 py-1 text-xs font-medium border border-border rounded hover:bg-muted/30 transition-smooth"
                  onClick={goToday}
                >
                  วันนี้
                </button>
                <button
                  className="vz-icon-soft h-8 w-8 border border-border rounded hover:bg-muted/30 transition-smooth"
                  onClick={nextMonth}
                  title="เดือนถัดไป"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Calendar grid — month view */}
            <div className="p-2">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {THAI_DAYS_SHORT.map((day, i) => (
                  <div
                    key={i}
                    className={`text-center text-[11px] font-semibold py-1.5 ${i === 0 ? 'text-rose-500' : 'text-muted-foreground'}`}
                  >
                    {day}
                  </div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map(({ date, isCurrentMonth }, i) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const dayLoans = loansByDate[dateStr] || []
                  const isToday = dateStr === todayStr
                  const isWeekend = date.getDay() === 0

                  return (
                    <div
                      key={i}
                      className={`min-h-[70px] p-1 rounded-md border transition-smooth ${
                        isCurrentMonth
                          ? `border-border/50 ${isWeekend ? 'bg-rose-500/5' : 'bg-card'}`
                          : 'border-border/20 bg-muted/10 opacity-50'
                      } ${isToday ? 'ring-2 ring-primary/40' : ''} ${dayLoans.length > 0 ? 'cursor-pointer hover:border-primary/30 hover:bg-muted/20' : ''}`}
                      onClick={() => dayLoans.length > 0 && onOpenLoan(dayLoans[0].docNo)}
                    >
                      {/* Date number */}
                      <div className={`text-[11px] font-medium mb-0.5 ${
                        !isCurrentMonth ? 'text-muted-foreground/40'
                        : isToday ? 'text-primary font-bold'
                        : isWeekend ? 'text-rose-500/70'
                        : 'text-foreground'
                      }`}>
                        {date.getDate()}
                      </div>
                      {/* Events */}
                      <div className="space-y-0.5">
                        {dayLoans.slice(0, 3).map((l) => {
                          const catIdx = getLoanCategory(l)
                          const cat = EVENT_CATEGORIES[catIdx]
                          return (
                            <div
                              key={l.docNo}
                              className="text-[9px] font-medium px-1 py-0.5 rounded truncate"
                              style={{ backgroundColor: cat.bg, color: cat.color }}
                            >
                              {l.docNo}
                            </div>
                          )
                        })}
                        {dayLoans.length > 3 && (
                          <div className="text-[9px] text-muted-foreground px-1">
                            +{dayLoans.length - 3} รายการ
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
