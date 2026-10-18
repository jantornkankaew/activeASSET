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

// === Velzon color tokens (matched to brand palette) ===
const VZ = {
  primary: '#405189',   // Velzon indigo
  teal:    '#0ab39c',  // Velzon growth teal
  amber:   '#f7b84b',  // Velzon warning amber
  rose:    '#f06548',  // Velzon danger coral
  purple:  '#a071f0',  // Velzon accent purple
  slate:   '#74788d',  // Velzon muted slate
}

// Velzon soft bg map (rgba of the brand color)
const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64, 81, 137, 0.10)',
  teal:    'rgba(10, 179, 156, 0.10)',
  amber:   'rgba(247, 184, 75, 0.12)',
  rose:    'rgba(240, 101, 72, 0.10)',
  purple:  'rgba(160, 113, 240, 0.10)',
  slate:   'rgba(116, 120, 141, 0.12)',
}

export function OverviewTab({ onNavigate, onCreateLoan, onStartAudit, onOpenLoan }: OverviewTabProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ===== Velzon gradient hero banner ===== */}
      <div className="vz-banner p-5 lg:p-6">
        <div className="vz-banner-pattern" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/80" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85">{greeting}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">ภาพรวมระบบบริหารทรัพย์สิน</h2>
            <p className="text-xs text-white/75 max-w-lg leading-relaxed">
              ติดตามสถานะทรัพย์สิน ใบยืม และคิวการยืมแบบเรียลไทม์ — ข้อมูลอัปเดตล่าสุดทุกการรีเฟรช
            </p>
          </div>

          {/* Right — Velzon-style stat summary on banner */}
          <div className="flex items-center gap-5">
            <VelzonRingMini label="สุขภาพคลัง" value={healthScore} color={VZ.teal} />
            <div className="h-12 w-px bg-white/15" />
            <VelzonRingMini label="อัตราใช้งาน" value={utilization} color="#fff" />
            <div className="h-12 w-px bg-white/15 hidden lg:block" />
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/15 hover:bg-white/25 text-white border-0 shadow-none text-xs"
              onClick={() => setWidgetEditorOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" /> จัดวิดเจ็ต
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Quick Actions — Velzon button bar ===== */}
      <div className="flex flex-wrap gap-2">
        <button
          className="group relative overflow-hidden inline-flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-semibold shadow-sm transition-smooth hover:shadow-md hover:-translate-y-0.5"
          style={{ background: `linear-gradient(135deg, ${VZ.primary} 0%, ${VZ.purple} 100%)` }}
          onClick={onCreateLoan}
        >
          <ShoppingCart className="h-4 w-4" />
          ขอยืมใหม่
        </button>
        {[
          { icon: Truck, label: 'จัดของ', color: VZ.amber, action: () => onNavigate('loans') },
          { icon: ScanLine, label: 'รับคืน', color: VZ.teal, action: () => onNavigate('loans') },
          { icon: ClipboardCheck, label: 'ตรวจนับ', color: VZ.primary, action: onStartAudit },
          { icon: TrendingUp, label: 'Analytics', color: VZ.purple, action: () => onNavigate('analytics') },
        ].map((a, i) => (
          <button
            key={i}
            className="group vz-card inline-flex items-center gap-2 px-3.5 py-2 transition-smooth hover:-translate-y-0.5"
            onClick={a.action}
          >
            <span
              className="vz-icon-soft h-7 w-7"
              style={{ backgroundColor: VZ_SOFT[i % 6 === 0 ? 'amber' : i === 1 ? 'teal' : i === 2 ? 'primary' : 'purple'] }}
            >
              <a.icon className="h-4 w-4" style={{ color: a.color }} />
            </span>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ===== KPI stat cards — Velzon signature pattern ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <VelzonStatCard
          label="ทรัพย์สินทั้งหมด"
          value={s.totalAssets}
          icon={<Package className="h-5 w-5" />}
          color="primary"
          trend={{ delta: '+3', label: 'เพิ่มเดือนนี้', up: true }}
          onClick={() => onNavigate('assets')}
        />
        <VelzonStatCard
          label="พร้อมใช้"
          value={s.available}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="teal"
          trend={{ delta: `${availablePct}%`, label: 'ของทั้งหมด', up: availablePct >= 50 }}
          onClick={() => onNavigate('assets')}
        />
        <VelzonStatCard
          label="กำลังยืม"
          value={s.onLoan}
          icon={<Boxes className="h-5 w-5" />}
          color="amber"
          trend={{ delta: `${s.activeLoans}`, label: 'ใบยืม', up: true }}
          onClick={() => onNavigate('loans')}
        />
        <VelzonStatCard
          label="ส่งซ่อม"
          value={s.inRepair}
          icon={<Wrench className="h-5 w-5" />}
          color="purple"
          trend={{ delta: s.openTickets > 0 ? `${s.openTickets}` : '0', label: s.openTickets > 0 ? 'tickets' : 'ไม่มี', up: s.openTickets === 0 }}
          onClick={() => onNavigate('assets')}
        />
        <VelzonStatCard
          label="เกินกำหนด"
          value={s.overdueLoans}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="rose"
          pulse={s.overdueLoans > 0}
          trend={{ delta: s.overdueLoans > 0 ? 'ด่วน' : 'ปกติ', label: '', up: s.overdueLoans === 0 }}
          onClick={() => onNavigate('loans')}
        />
        <VelzonStatCard
          label="Dead Stock"
          value={s.deadStockCount}
          icon={<Clock className="h-5 w-5" />}
          color="slate"
          trend={{ delta: s.deadStockCount > 0 ? 'พิจารณา' : '—', label: '', up: s.deadStockCount === 0 }}
          onClick={() => onNavigate('assets')}
        />
      </div>

      {/* ===== Overdue + Standby — Velzon card pattern ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue */}
        <div className="vz-card overflow-hidden" style={{ borderColor: 'rgba(240, 101, 72, 0.20)' }}>
          <div className="px-4 py-3 vz-divider" style={{ background: 'linear-gradient(90deg, rgba(240, 101, 72, 0.06), transparent)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="vz-icon-soft h-9 w-9" style={{ backgroundColor: VZ_SOFT.rose, boxShadow: 'inset 0 0 0 1px rgba(240, 101, 72, 0.18)' }}>
                  <AlertTriangle className="h-4 w-4" style={{ color: VZ.rose }} />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">เกินกำหนดคืน</div>
                  <div className="text-[10px] text-muted-foreground">ต้องติดตามด่วน</div>
                </div>
              </div>
              <span className="vz-pill vz-pill-danger">
                {data.overdueLoans.length} ใบ
              </span>
            </div>
          </div>
          <div>
            {data.overdueLoans.length === 0 && (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: VZ.teal }} />
                <div className="text-sm font-medium text-foreground">ไม่มีใบยืมเกินกำหนด</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">ระบบปกติดี</div>
              </div>
            )}
            {data.overdueLoans.map((l, i) => {
              const days = daysUntil(l.expectedReturnDate)
              return (
                <button
                  key={l.docNo}
                  onClick={() => onOpenLoan(l.docNo)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-rose-500/4 transition-smooth flex items-center gap-3 group ${i < data.overdueLoans.length - 1 ? 'vz-divider' : ''}`}
                >
                  <div
                    className="vz-avatar h-9 w-9 text-xs"
                    style={{ backgroundColor: VZ_SOFT.rose, color: VZ.rose, boxShadow: 'inset 0 0 0 1px rgba(240, 101, 72, 0.18)' }}
                  >
                    {l.customerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{l.docNo}</span>
                      <span className="vz-pill vz-pill-danger">เกิน {Math.abs(days)}d</span>
                    </div>
                    <div className="text-xs truncate mt-0.5 font-medium text-foreground">{l.customerName} {l.customerCompany ? `· ${l.customerCompany}` : ''}</div>
                    <div className="text-[10px] text-muted-foreground">โดย {l.salesRepName} • {l.items.length} ชิ้น</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-smooth" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Standby */}
        <div className="vz-card overflow-hidden" style={{ borderColor: 'rgba(247, 184, 75, 0.20)' }}>
          <div className="px-4 py-3 vz-divider" style={{ background: 'linear-gradient(90deg, rgba(247, 184, 75, 0.06), transparent)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="vz-icon-soft h-9 w-9" style={{ backgroundColor: VZ_SOFT.amber, boxShadow: 'inset 0 0 0 1px rgba(247, 184, 75, 0.20)' }}>
                  <Wrench className="h-4 w-4" style={{ color: VZ.amber }} />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">เครื่องสำรองซ่อม</div>
                  <div className="text-[10px] text-muted-foreground">ที่ยังไม่คืนของจริง</div>
                </div>
              </div>
              <span className="vz-pill vz-pill-warning">
                {data.standbyLoans.length} ใบ
              </span>
            </div>
          </div>
          <div>
            {data.standbyLoans.length === 0 && (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: VZ.teal }} />
                <div className="text-sm font-medium text-foreground">ไม่มีเครื่องสำรองค้าง</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">ทุกใบคืนครบแล้ว</div>
              </div>
            )}
            {data.standbyLoans.map((l, i) => {
              const days = daysUntil(l.expectedReturnDate)
              return (
                <button
                  key={l.docNo}
                  onClick={() => onOpenLoan(l.docNo)}
                  className={`w-full text-left px-4 py-2.5 hover:bg-amber-500/4 transition-smooth flex items-center gap-3 group ${i < data.standbyLoans.length - 1 ? 'vz-divider' : ''}`}
                >
                  <div
                    className="vz-avatar h-9 w-9 text-xs"
                    style={{ backgroundColor: VZ_SOFT.amber, color: VZ.amber, boxShadow: 'inset 0 0 0 1px rgba(247, 184, 75, 0.20)' }}
                  >
                    {l.customerName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{l.docNo}</span>
                      {days < 0 && <span className="vz-pill vz-pill-danger">เกิน {Math.abs(days)}d</span>}
                      {days >= 0 && <span className="vz-pill vz-pill-warning">{days}d left</span>}
                    </div>
                    <div className="text-xs truncate mt-0.5 font-medium text-foreground">{l.customerName} {l.customerCompany ? `· ${l.customerCompany}` : ''}</div>
                    <div className="text-[10px] text-muted-foreground">คืน {formatThaiDate(l.expectedReturnDate)}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-smooth" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Brand + Dead Stock — Velzon pattern ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brand distribution */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.primary }}>
                <TrendingUp className="h-4 w-4" style={{ color: VZ.primary }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">สัดส่วนแบรนด์</div>
                <div className="text-[10px] text-muted-foreground">การกระจายตามยี่ห้อ</div>
              </div>
            </div>
            <span className="vz-pill vz-pill-muted">{data.brandDistribution.length} แบรนด์</span>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-3">
              {data.brandDistribution.map((b, i) => {
                const pct = s.totalAssets > 0 ? (b.count / s.totalAssets) * 100 : 0
                const colorHex = [VZ.primary, VZ.teal, VZ.amber, VZ.purple, VZ.rose, VZ.slate][i % 6]
                return (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorHex }} />
                        {b.brand}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        <b className="text-foreground">{b.count}</b> ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${colorHex}, ${colorHex}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dead stock */}
        <div className="vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.slate }}>
                <Clock className="h-4 w-4" style={{ color: VZ.slate }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">ของดอง — ไม่เคยถูกยืม</div>
                <div className="text-[10px] text-muted-foreground">รอการพิจารณาตัดออก</div>
              </div>
            </div>
            <span className="vz-pill vz-pill-muted">{data.deadStockAssets.length}</span>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {data.deadStockAssets.length === 0 && (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2" style={{ color: VZ.teal }} />
                <div className="text-sm font-medium text-foreground">ไม่มีของดอง</div>
              </div>
            )}
            {data.deadStockAssets.slice(0, 10).map((a, i) => {
              const age = a.purchaseDate ? daysUntil(a.purchaseDate) : null
              return (
                <div
                  key={a.tagId}
                  className={`px-4 py-2 flex items-center gap-2.5 text-xs hover:bg-muted/30 transition-smooth ${i < Math.min(data.deadStockAssets.length, 10) - 1 ? 'vz-divider' : ''}`}
                >
                  <span className="vz-icon-soft h-7 w-7 flex-shrink-0" style={{ backgroundColor: VZ_SOFT.slate }}>
                    <Package className="h-3.5 w-3.5" style={{ color: VZ.slate }} />
                  </span>
                  <span className="font-mono font-semibold text-foreground">{a.tagId}</span>
                  <span className="text-muted-foreground truncate flex-1">{a.brand} {a.model}</span>
                  {age !== null && (
                    <span className="vz-pill vz-pill-muted">{Math.abs(age)}d</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Activity Feed — Velzon card ===== */}
      <div className="vz-card">
        <div className="px-4 py-3 vz-divider flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.primary }}>
              <Activity className="h-4 w-4" style={{ color: VZ.primary }} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">กิจกรรมล่าสุด</div>
              <div className="text-[10px] text-muted-foreground">จากทุกโมดูลในระบบ</div>
            </div>
          </div>
        </div>
        <ActivityFeed embedded />
      </div>

      <WidgetEditor
        open={widgetEditorOpen}
        onOpenChange={setWidgetEditorOpen}
        onChanged={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}

// ===== Velzon ring gauge (mini, for banner) =====
function VelzonRingMini({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-10 w-10">
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} className="fill-none" strokeWidth="3" stroke="rgba(255,255,255,0.20)" />
          <circle
            cx="20" cy="20" r={r}
            className="fill-none transition-all duration-700"
            strokeWidth="3"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-white">
          {value}
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-[10px] text-white/75 font-medium">{label}</div>
        <div className="text-[10px] text-white/55">%</div>
      </div>
    </div>
  )
}

// ===== Velzon stat card — signature pattern =====
// Layout: icon avatar LEFT + (eyebrow label + big number + trend pill) RIGHT
const VZ_COLORS: Record<string, { fg: string; soft: string }> = {
  primary: { fg: VZ.primary, soft: VZ_SOFT.primary },
  teal:    { fg: VZ.teal,    soft: VZ_SOFT.teal },
  amber:   { fg: VZ.amber,   soft: VZ_SOFT.amber },
  rose:    { fg: VZ.rose,    soft: VZ_SOFT.rose },
  purple:  { fg: VZ.purple,  soft: VZ_SOFT.purple },
  slate:    { fg: VZ.slate,    soft: VZ_SOFT.slate },
}

function VelzonStatCard({
  label, value, icon, color, onClick, pulse, trend,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  onClick?: () => void
  pulse?: boolean
  trend?: { delta: string; label: string; up: boolean }
}) {
  const c = VZ_COLORS[color] || VZ_COLORS.primary
  return (
    <div
      className={`vz-card p-4 transition-smooth ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span
          className={`vz-icon-soft h-10 w-10 ${pulse ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: c.soft }}
        >
          <span style={{ color: c.fg }}>{icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="vz-eyebrow truncate">{label}</div>
          <div className="vz-stat-num mt-1 mb-1.5">{value}</div>
          {trend && (
            <div className="flex items-center gap-1.5">
              <span className={`vz-pill ${trend.up ? 'vz-pill-success' : 'vz-pill-danger'}`}>
                {trend.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {trend.delta}
              </span>
              {trend.label && (
                <span className="text-[10px] text-muted-foreground truncate">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
