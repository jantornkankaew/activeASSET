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

      {/* ===== Inline legend bar + create button ===== */}
      <div className="vz-card p-3 flex items-center justify-between flex-wrap gap-2">
        {/* Event categories legend */}
        <div className="flex items-center gap-2 flex-wrap">
          {EVENT_CATEGORIES.map((cat, i) => {
            const Icon = cat.icon
            return (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]" style={{ backgroundColor: cat.bg, color: cat.color }}>
                <Icon className="h-3 w-3" />
                <span className="font-medium">{cat.label}</span>
              </div>
            )
          })}
        </div>
        <button
          className="px-3 py-1.5 rounded text-xs font-semibold text-white shadow-sm transition-smooth hover:shadow-md"
          style={{ background: `linear-gradient(135deg, ${VZ.primary}, ${VZ.teal})` }}
          onClick={() => onOpenLoan(null)}
        >
          <Plus className="h-3.5 w-3.5 inline mr-1" /> สร้างใบยืมใหม่
        </button>
      </div>

      {/* ===== FULL-WIDTH month calendar ===== */}
      <div className="vz-card overflow-hidden">
        {/* Calendar toolbar */}
        <div className="px-4 py-3 vz-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h5 className="text-lg font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              {THAI_MONTHS[month]} {year + 543}
            </h5>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && <span className="vz-pill vz-pill-danger">{overdueCount} เกิน</span>}
              {dueSoonCount > 0 && <span className="vz-pill vz-pill-warning">{dueSoonCount} ใกล้</span>}
              <span className="vz-pill vz-pill-info">{monthLoans.length} ทั้งหมด</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="vz-icon-soft h-9 w-9 border border-border rounded hover:bg-muted/30 transition-smooth" onClick={prevMonth} title="เดือนก่อนหน้า">
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <button className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/30 transition-smooth" onClick={goToday}>
              วันนี้
            </button>
            <button className="vz-icon-soft h-9 w-9 border border-border rounded hover:bg-muted/30 transition-smooth" onClick={nextMonth} title="เดือนถัดไป">
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {THAI_DAYS_SHORT.map((day, i) => (
            <div key={i} className={`text-center text-xs font-semibold py-2.5 ${i === 0 || i === 6 ? 'text-rose-500' : 'text-muted-foreground'}`}>
              {day}
            </div>
          ))}
        </div>

        {/* Day cells — full-width month grid */}
        <div className="grid grid-cols-7">
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
                className={`p-2 transition-smooth relative ${
                  colIdx < 6 ? 'border-r border-border/40' : ''
                } ${rowIdx < Math.floor(totalCells / 7) - 1 ? 'border-b border-border/40' : ''
                } ${
                  !isCurrentMonth ? 'bg-muted/5' : isWeekend ? 'bg-rose-500/[0.02]' : 'bg-card'
                } ${dayLoans.length > 0 ? 'cursor-pointer hover:bg-muted/20' : ''
                } ${isToday ? 'bg-primary/5' : ''}`}
                style={{ minHeight: '110px' }}
                onClick={() => dayLoans.length > 0 && onOpenLoan(dayLoans[0].docNo)}
              >
                {/* Date number */}
                <div className="flex items-center justify-end mb-1.5">
                  {isToday ? (
                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {date.getDate()}
                    </span>
                  ) : (
                    <span className={`text-sm font-medium ${
                      !isCurrentMonth ? 'text-muted-foreground/30'
                      : isWeekend ? 'text-rose-500/60'
                      : 'text-muted-foreground'
                    }`}>
                      {date.getDate()}
                    </span>
                  )}
                </div>
                {/* Events */}
                <div className="space-y-1">
                  {dayLoans.slice(0, 4).map((l) => {
                    const catIdx = getLoanCategory(l)
                    const cat = EVENT_CATEGORIES[catIdx]
                    return (
                      <div
                        key={l.docNo}
                        className="text-[10px] font-medium px-1.5 py-1 rounded truncate flex items-center gap-1 hover:opacity-80 transition-smooth"
                        style={{ backgroundColor: cat.bg, color: cat.color, borderLeft: `3px solid ${cat.color}` }}
                      >
                        <span className="font-mono">{l.docNo.replace('LOAN-', '')}</span>
                      </div>
                    )
                  })}
                  {dayLoans.length > 4 && (
                    <div className="text-[9px] text-muted-foreground px-1.5 font-medium">
                      +{dayLoans.length - 4} รายการ
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ===== Upcoming returns — horizontal strip below calendar ===== */}
      {upcoming.length > 0 && (
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              การคืนที่กำลังจะมาถึง ({upcoming.length})
            </h5>
            <p className="text-[10px] text-muted-foreground">อย่าพลาดกำหนดคืน</p>
          </div>
          <div className="p-3 overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: 'min-content' }}>
              {upcoming.map((l) => {
                const catIdx = getLoanCategory(l)
                const cat = EVENT_CATEGORIES[catIdx]
                const days = daysUntil(l.expectedReturnDate)
                return (
                  <button
                    key={l.docNo}
                    className="flex-shrink-0 w-48 p-2.5 rounded-md border border-border hover:bg-muted/30 transition-smooth text-left"
                    onClick={() => onOpenLoan(l.docNo)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-mono text-[11px] font-semibold text-foreground truncate">{l.docNo}</span>
                      <span className="ml-auto text-[10px] font-medium" style={{ color: cat.color }}>
                        {days === 0 ? 'วันนี้' : days > 0 ? `${days}d` : `เกิน ${Math.abs(days)}d`}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{l.customerName}</div>
                    <div className="text-[10px] text-muted-foreground">{formatThaiDate(l.expectedReturnDate)}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
