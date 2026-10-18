'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  EmptyState, LoadingState,
} from './shared'
import { WidgetEditor } from './WidgetEditor'
import { ActivityFeed } from '@/components/notifications/ActivityFeed'
import {
  Package, CheckCircle2, Boxes, Wrench, Clock, AlertTriangle,
  ClipboardCheck, TrendingUp, ShoppingCart, ScanLine, Truck, Settings2,
  ChevronRight, ArrowUpRight, ArrowDownRight, Activity, Sparkles,
  ChevronDown, FileText, History,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil,
} from '@/lib/activeasset-constants'

interface DashboardData {
  summary: {
    totalAssets: number
    available: number
    onLoan: number
    inRepair: number
    inInspection: number
    lost: number
    disposed: number
    activeLoans: number
    overdueLoans: number
    partialLoans: number
    openTickets: number
    deadStockCount: number
  }
  overdueLoans: Array<{
    docNo: string
    customerName: string
    customerCompany: string | null
    salesRepName: string
    purpose: string
    requestedAt: string
    expectedReturnDate: string
    status: string
    items: Array<{ tagId: string; serialNo: string; model: string; brand: string }>
  }>
  standbyLoans: Array<{
    docNo: string
    customerName: string
    customerCompany: string | null
    requestedAt: string
    expectedReturnDate: string
    items: Array<{ tagId: string; serialNo: string; model: string; brand: string }>
  }>
  brandDistribution: Array<{ brand: string; count: number }>
  deadStockAssets: Array<{
    tagId: string
    serialNo: string
    purchaseDate: string | null
    model: string
    brand: string
  }>
}

interface OverviewTabProps {
  onNavigate: (tab: 'assets' | 'loans' | 'audit' | 'waiting' | 'analytics') => void
  onCreateLoan: () => void
  onStartAudit: () => void
  onOpenLoan: (docNo: string) => void
}

// Velzon color tokens (CRM palette)
const VZ = { primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548', purple: '#a071f0', slate: '#74788d' }
const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64,81,137,0.10)', teal: 'rgba(10,179,156,0.10)',
  amber: 'rgba(247,184,75,0.12)', rose: 'rgba(240,101,72,0.10)',
  purple: 'rgba(160,113,240,0.10)', slate: 'rgba(116,120,141,0.12)',
}

export function OverviewTab({ onNavigate, onCreateLoan, onStartAudit, onOpenLoan }: OverviewTabProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  // Sort dropdowns for each card (Velzon CRM signature)
  const [sortByTrend, setSortByTrend] = useState('6 เดือนล่าสุด')
  const [sortByBrand, setSortByBrand] = useState('ทั้งหมด')
  const [sortByOverdue, setSortByOverdue] = useState('ด่วนที่สุดก่อน')
  const [sortByStandby, setSortByStandby] = useState('ทั้งหมด')

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [refreshKey])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState message="ไม่สามารถโหลดข้อมูลได้" />

  const s = data.summary
  const utilization = s.totalAssets > 0 ? Math.round((s.onLoan / s.totalAssets) * 100) : 0
  const healthScore = s.totalAssets > 0
    ? Math.round(((s.available + s.inRepair) / s.totalAssets) * 100)
    : 0
  const availablePct = s.totalAssets > 0 ? Math.round((s.available / s.totalAssets) * 100) : 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon CRM page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            ภาพรวมระบบบริหารทรัพย์สิน
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">ติดตามสถานะทรัพย์สิน ใบยืม และคิวการยืมแบบเรียลไทม์</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Dashboards</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Overview</span>
        </div>
      </div>

      {/* ===== Velzon CRM crm-widget (5 mini stats horizontal in 1 card) ===== */}
      <div className="vz-crm-widget">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 g-0">
          {/* Stat 1 — Total Assets */}
          <CrmStat
            label="ทรัพย์สินทั้งหมด"
            value={s.totalAssets}
            icon={<Package className="h-6 w-6" />}
            trend="up"
            trendText="+3"
          />
          {/* Stat 2 — Available */}
          <CrmStat
            label="พร้อมใช้"
            value={s.available}
            valueSuffix={` (${availablePct}%)`}
            icon={<CheckCircle2 className="h-6 w-6" />}
            trend="up"
            trendText={`${availablePct}%`}
          />
          {/* Stat 3 — On Loan */}
          <CrmStat
            label="กำลังยืม"
            value={s.onLoan}
            icon={<Boxes className="h-6 w-6" />}
            trend="up"
            trendText={`${s.activeLoans} ใบ`}
          />
          {/* Stat 4 — Active Loans */}
          <CrmStat
            label="ใบยืมเปิดอยู่"
            value={s.activeLoans}
            icon={<FileText className="h-6 w-6" />}
            trend={s.overdueLoans > 0 ? 'down' : 'up'}
            trendText={s.overdueLoans > 0 ? `${s.overdueLoans} เกิน` : 'ปกติ'}
          />
          {/* Stat 5 — Overdue */}
          <CrmStat
            label="เกินกำหนด"
            value={s.overdueLoans}
            icon={<AlertTriangle className="h-6 w-6" />}
            trend={s.overdueLoans > 0 ? 'down' : 'up'}
            trendText={s.overdueLoans > 0 ? 'ด่วน' : 'ปกติ'}
            pulse={s.overdueLoans > 0}
          />
        </div>
      </div>

      {/* ===== Velzon CRM — 3-col charts (Sales Forecast / Deal Type / Balance Overview) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1 — Brand Distribution (Sales Forecast pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              สัดส่วนแบรนด์
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByBrand} onChange={setSortByBrand} options={['ทั้งหมด', 'Top 5', 'Top 10']} />
            </div>
          </div>
          <div className="p-4">
            <div className="space-y-2.5">
              {data.brandDistribution.slice(0, 6).map((b, i) => {
                const pct = s.totalAssets > 0 ? (b.count / s.totalAssets) * 100 : 0
                const colorHex = [VZ.primary, VZ.teal, VZ.amber, VZ.purple, VZ.rose, VZ.slate][i % 6]
                return (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorHex }} />
                        {b.brand}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        <b className="text-foreground">{b.count}</b> ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${colorHex}, ${colorHex}aa)` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Card 2 — Donut Status (Deal Type pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              สถานะทรัพย์สิน
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByTrend} onChange={setSortByTrend} options={['6 เดือนล่าสุด', '3 เดือนล่าสุด', 'เดือนนี้']} />
            </div>
          </div>
          <div className="p-4 flex items-center justify-center">
            <StatusDonut available={s.available} onLoan={s.onLoan} inRepair={s.inRepair} other={s.lost + s.disposed + s.inInspection} total={s.totalAssets} />
          </div>
        </div>

        {/* Card 3 — Balance Overview pattern (3 inline stats + bar) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              ภาพรวมการยืม
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByTrend} onChange={setSortByTrend} options={['ปีนี้', 'ไตรมาสนี้', 'เดือนนี้']} />
            </div>
          </div>
          <div className="px-4 py-3">
            {/* 3 inline stats — Velzon Balance Overview pattern */}
            <div className="vz-crm-inline-stats">
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.primary }}>{s.activeLoans}</div>
                <div className="vz-crm-inline-label">ใบยืมเปิดอยู่</div>
              </div>
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.teal }}>{healthScore}%</div>
                <div className="vz-crm-inline-label">สุขภาพคลัง</div>
              </div>
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.amber }}>{utilization}%</div>
                <div className="vz-crm-inline-label">อัตราใช้งาน</div>
              </div>
            </div>
            {/* Mini stacked bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-muted mt-2">
              <div style={{ width: `${availablePct}%`, backgroundColor: VZ.teal }} title={`ว่าง ${s.available}`} />
              <div style={{ width: `${s.totalAssets > 0 ? (s.onLoan / s.totalAssets) * 100 : 0}%`, backgroundColor: VZ.amber }} title={`ยืม ${s.onLoan}`} />
              <div style={{ width: `${s.totalAssets > 0 ? (s.inRepair / s.totalAssets) * 100 : 0}%`, backgroundColor: VZ.purple }} title={`ซ่อม ${s.inRepair}`} />
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: VZ.teal }} /> ว่าง {s.available}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: VZ.amber }} /> ยืม {s.onLoan}</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: VZ.purple }} /> ซ่อม {s.inRepair}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Velzon CRM — 2-col (Deals Status table + My Tasks list) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Overdue loans (Deals Status pattern) */}
        <div className="lg:col-span-2 vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <AlertTriangle className="h-4 w-4" style={{ color: VZ.rose }} />
              เกินกำหนดคืน
            </h5>
            <div className="flex-shrink-0 flex items-center gap-2">
              <SortDropdown value={sortByOverdue} onChange={setSortByOverdue} options={['ด่วนที่สุดก่อน', 'ล่าสุด', 'ลูกค้า']} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="vz-crm-table">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ลูกค้า</th>
                  <th>พนักงาน</th>
                  <th>เกิน</th>
                  <th className="text-right">ชิ้น</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueLoans.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-1" style={{ color: VZ.teal }} />
                    ไม่มีใบยืมเกินกำหนด
                  </td></tr>
                )}
                {data.overdueLoans.slice(0, 5).map((l) => {
                  const days = daysUntil(l.expectedReturnDate)
                  const overdueDays = Math.abs(days)
                  return (
                    <tr key={l.docNo} className="cursor-pointer" onClick={() => onOpenLoan(l.docNo)}>
                      <td>
                        <span className="font-mono font-semibold text-foreground">{l.docNo}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="vz-avatar h-7 w-7 text-[10px]" style={{ backgroundColor: VZ_SOFT.rose, color: VZ.rose }}>
                            {l.customerName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-foreground font-medium truncate">{l.customerName}</div>
                            {l.customerCompany && <div className="text-[10px] text-muted-foreground truncate">{l.customerCompany}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{l.salesRepName}</td>
                      <td>
                        <span className="vz-pill vz-pill-danger">{overdueDays}d</span>
                      </td>
                      <td className="text-right tabular-nums font-medium">{l.items.length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — Standby loans (My Tasks pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <Wrench className="h-4 w-4" style={{ color: VZ.amber }} />
              เครื่องสำรองซ่อม
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByStandby} onChange={setSortByStandby} options={['ทั้งหมด', 'เหลือ 7 วัน', 'เหลือ 3 วัน']} />
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">
              <b className="text-foreground">{data.standbyLoans.length}</b> ใบค้างส่งคืนของจริง
            </div>
            <button onClick={() => onNavigate('loans')} className="vz-pill vz-pill-info cursor-pointer">
              ดูทั้งหมด <ChevronRight className="h-2.5 w-2.5" />
            </button>
          </div>
          <div className="vz-crm-tasks" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {data.standbyLoans.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-1" style={{ color: VZ.teal }} />
                ไม่มีเครื่องสำรองค้าง
              </div>
            )}
            {data.standbyLoans.map((l) => {
              const days = daysUntil(l.expectedReturnDate)
              return (
                <div key={l.docNo} className="vz-crm-task cursor-pointer hover:bg-muted/20" onClick={() => onOpenLoan(l.docNo)}>
                  <div className="vz-avatar h-7 w-7 text-[10px] flex-shrink-0" style={{ backgroundColor: VZ_SOFT.amber, color: VZ.amber }}>
                    {l.customerName.charAt(0)}
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-foreground">{l.docNo}</span>
                      {days < 0 ? (
                        <span className="vz-pill vz-pill-danger">เกิน {Math.abs(days)}d</span>
                      ) : (
                        <span className="vz-pill vz-pill-warning">{days}d</span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground truncate mt-0.5">{l.customerName}</div>
                    <div className="text-[10px] text-muted-foreground">คืน {formatThaiDate(l.expectedReturnDate)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Velzon CRM — Bottom row (Dead stock + Recent activity) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Dead stock (Upcoming Activities pattern) */}
        <div className="lg:col-span-2 vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <Clock className="h-4 w-4" style={{ color: VZ.slate }} />
              ของดอง — ไม่เคยถูกยืม
            </h5>
            <div className="flex-shrink-0">
              <span className="vz-pill vz-pill-muted">{data.deadStockAssets.length} เครื่อง</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="vz-crm-table">
              <thead>
                <tr>
                  <th>Tag ID</th>
                  <th>รุ่น</th>
                  <th>ยี่ห้อ</th>
                  <th className="text-right">อายุ</th>
                </tr>
              </thead>
              <tbody>
                {data.deadStockAssets.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-1" style={{ color: VZ.teal }} />
                    ไม่มีของดอง
                  </td></tr>
                )}
                {data.deadStockAssets.slice(0, 6).map((a) => {
                  const age = a.purchaseDate ? daysUntil(a.purchaseDate) : null
                  return (
                    <tr key={a.tagId} className="cursor-pointer" onClick={() => onNavigate('assets')}>
                      <td><span className="font-mono font-semibold text-foreground">{a.tagId}</span></td>
                      <td className="text-muted-foreground">{a.model}</td>
                      <td className="text-muted-foreground">{a.brand}</td>
                      <td className="text-right">
                        {age !== null && (
                          <span className="vz-pill vz-pill-muted">{Math.abs(age)}d</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — Recent activity (Closing Deals pattern) */}
        <div className="vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
            <span className="vz-icon-soft h-7 w-7" style={{ backgroundColor: VZ_SOFT.primary }}>
              <Activity className="h-4 w-4" style={{ color: VZ.primary }} />
            </span>
            <div className="leading-tight flex-grow-1">
              <div className="text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>กิจกรรมล่าสุด</div>
              <div className="text-[10px] text-muted-foreground">จากทุกโมดูลในระบบ</div>
            </div>
          </div>
          <ActivityFeed embedded />
        </div>
      </div>

      <WidgetEditor
        open={widgetEditorOpen}
        onOpenChange={setWidgetEditorOpen}
        onChanged={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}

// ===== CRM Mini Stat component (5 in crm-widget) =====
function CrmStat({
  label, value, valueSuffix, icon, trend, trendText, pulse,
}: {
  label: string
  value: number | string
  valueSuffix?: string
  icon: React.ReactNode
  trend: 'up' | 'down'
  trendText: string
  pulse?: boolean
}) {
  const trendColor = trend === 'up' ? VZ.teal : VZ.rose
  return (
    <div className={`vz-crm-stat ${pulse ? 'animate-pulse' : ''}`}>
      <div className="vz-crm-label">
        <span>{label}</span>
        {trend === 'up' ? (
          <ArrowUpRight className="h-3 w-3" style={{ color: VZ.teal }} />
        ) : (
          <ArrowDownRight className="h-3 w-3" style={{ color: VZ.rose }} />
        )}
      </div>
      <div className="vz-crm-value-row">
        <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
        <div className="flex-grow-1">
          <span className="vz-crm-num vz-crm-counter">{value}</span>
          {valueSuffix && <span className="text-xs text-muted-foreground ml-1">{valueSuffix}</span>}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1">
        {trend === 'up' ? (
          <span style={{ color: VZ.teal }}>▲ {trendText}</span>
        ) : (
          <span style={{ color: VZ.rose }}>▼ {trendText}</span>
        )}
      </div>
    </div>
  )
}

// ===== Sort Dropdown — Velzon CRM "Sort by: <value> ▾" pattern =====
function SortDropdown({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="vz-crm-sort-btn" onClick={() => setOpen(!open)}>
        <span>Sort by:</span> <b>{value}</b> <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 bg-card border border-border rounded-md shadow-md z-20 min-w-[120px]">
            {options.map((opt) => (
              <button
                key={opt}
                className={`block w-full text-left px-3 py-1.5 text-[11px] hover:bg-muted/40 transition-smooth ${opt === value ? 'text-primary font-semibold' : 'text-foreground'}`}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ===== Status Donut Chart (Deal Type pattern) =====
function StatusDonut({
  available, onLoan, inRepair, other, total,
}: {
  available: number
  onLoan: number
  inRepair: number
  other: number
  total: number
}) {
  const segments = [
    { value: available, color: VZ.teal, label: 'พร้อมใช้' },
    { value: onLoan, color: VZ.amber, label: 'กำลังยืม' },
    { value: inRepair, color: VZ.purple, label: 'ส่งซ่อม' },
    { value: other, color: VZ.slate, label: 'อื่น ๆ' },
  ]
  const r = 50
  const stroke = 14
  const circ = 2 * Math.PI * r
  let offsetAcc = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} className="fill-none" stroke="currentColor" strokeWidth={stroke} opacity="0.15" />
          {segments.map((seg, i) => {
            const pct = total > 0 ? seg.value / total : 0
            const dash = pct * circ
            const gap = circ - dash
            const offset = -offsetAcc * circ
            offsetAcc += pct
            return (
              <circle
                key={i}
                cx="60" cy="60" r={r}
                className="fill-none transition-all duration-700"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{total}</div>
          <div className="text-[10px] text-muted-foreground">ทั้งหมด</div>
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="font-medium text-foreground flex-1 truncate">{seg.label}</span>
              <span className="text-muted-foreground tabular-nums">{seg.value}</span>
              <span className="text-muted-foreground/70 tabular-nums text-[10px] w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
