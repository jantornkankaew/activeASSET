'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ===== Hero header — Velzon premium gradient banner ===== */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/8 via-card to-accent/6 p-5 shadow-sm">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">{greeting}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">ภาพรวมระบบบริหารทรัพย์สิน</h2>
            <p className="text-xs text-muted-foreground">
              ติดตามสถานะทรัพย์สิน ใบยืม และคิวการยืมแบบเรียลไทม์
            </p>
          </div>

          {/* Right — health score + utilization mini gauges */}
          <div className="flex items-center gap-3">
            <GaugeMini label="สุขภาพคลัง" value={healthScore} color="accent" />
            <div className="h-12 w-px bg-border" />
            <GaugeMini label="อัตราใช้งาน" value={utilization} color="primary" />
            <div className="h-12 w-px bg-border" />
            <Button size="sm" variant="soft" className="text-xs" onClick={() => setWidgetEditorOpen(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> จัดวิดเจ็ต
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Quick Actions — Velzon-style horizontal icon buttons ===== */}
      <div className="flex flex-wrap gap-2">
        <button
          className="group relative overflow-hidden flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm transition-smooth hover:shadow-md hover:-translate-y-0.5 shimmer"
          onClick={onCreateLoan}
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="text-sm font-semibold">ขอยืมใหม่</span>
        </button>
        {[
          { icon: Truck, label: 'จัดของ', color: 'text-amber-500', bg: 'bg-amber-500/10', action: () => onNavigate('loans') },
          { icon: ScanLine, label: 'รับคืน', color: 'text-accent', bg: 'bg-accent/10', action: () => onNavigate('loans') },
          { icon: ClipboardCheck, label: 'ตรวจนับ', color: 'text-primary', bg: 'bg-primary/10', action: onStartAudit },
          { icon: TrendingUp, label: 'Analytics', color: 'text-purple-500', bg: 'bg-purple-500/10', action: () => onNavigate('analytics') },
        ].map((a, i) => (
          <button
            key={i}
            className="group flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border shadow-sm transition-smooth hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
            onClick={a.action}
          >
            <span className={`h-7 w-7 rounded-md ${a.bg} flex items-center justify-center transition-smooth`}>
              <a.icon className={`h-4 w-4 ${a.color}`} />
            </span>
            <span className="text-sm font-medium text-foreground">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ===== Primary KPI row — Velzon premium stat cards with trend deltas ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatWidget
          label="ทรัพย์สินทั้งหมด"
          value={s.totalAssets}
          icon={<Package className="h-5 w-5" />}
          color="primary"
          trend={{ delta: '+3', label: 'เดือนนี้', up: true }}
          onClick={() => onNavigate('assets')}
        />
        <StatWidget
          label="พร้อมใช้"
          value={s.available}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="accent"
          trend={{ delta: `${s.totalAssets > 0 ? Math.round((s.available / s.totalAssets) * 100) : 0}%`, label: 'ของทั้งหมด', up: true }}
          onClick={() => onNavigate('assets')}
        />
        <StatWidget
          label="กำลังยืม"
          value={s.onLoan}
          icon={<Boxes className="h-5 w-5" />}
          color="amber"
          trend={{ delta: `${s.activeLoans}`, label: 'ใบยืม', up: true }}
          onClick={() => onNavigate('loans')}
        />
        <StatWidget
          label="ส่งซ่อม"
          value={s.inRepair}
          icon={<Wrench className="h-5 w-5" />}
          color="purple"
          trend={{ delta: s.openTickets > 0 ? `${s.openTickets} tickets` : '—', label: 'เปิดอยู่', up: false }}
        />
        <StatWidget
          label="เกินกำหนด"
          value={s.overdueLoans}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="rose"
          pulse={s.overdueLoans > 0}
          trend={{ delta: s.overdueLoans > 0 ? 'ต้องดำเนินการ' : 'ปกติ', label: '', up: s.overdueLoans === 0 }}
          onClick={() => onNavigate('loans')}
        />
        <StatWidget
          label="Dead Stock"
          value={s.deadStockCount}
          icon={<Clock className="h-5 w-5" />}
          color="slate"
          trend={{ delta: s.deadStockCount > 0 ? 'พิจารณาตัด' : '—', label: '', up: s.deadStockCount === 0 }}
          onClick={() => onNavigate('assets')}
        />
      </div>

      {/* ===== Secondary row — Overdue + Standby with Velzon depth ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue */}
        <Card className="shadow-sm overflow-hidden border-rose-200/60 dark:border-rose-900/30">
          <CardHeader className="pb-2 px-4 pt-3 bg-gradient-to-r from-rose-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center ring-1 ring-rose-500/20">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                </div>
                <div>
                  <span className="block">เกินกำหนดคืน</span>
                  <span className="text-[10px] font-normal text-muted-foreground">ต้องติดตามด่วน</span>
                </div>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-rose-500/8 text-rose-600 border-rose-500/20">
                {data.overdueLoans.length} ใบ
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.overdueLoans.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-accent" />
                  <div className="font-medium">ไม่มีใบยืมเกินกำหนด</div>
                  <div className="text-[10px] mt-0.5">ระบบปกติดี</div>
                </div>
              )}
              {data.overdueLoans.map((l) => {
                const days = daysUntil(l.expectedReturnDate)
                return (
                  <button
                    key={l.docNo}
                    onClick={() => onOpenLoan(l.docNo)}
                    className="w-full text-left px-4 py-2.5 hover:bg-rose-500/4 transition-smooth flex items-center gap-3 group"
                  >
                    <div className="h-9 w-9 rounded-full bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-600 flex-shrink-0">
                      {l.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{l.docNo}</span>
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-full tabular-nums">เกิน {Math.abs(days)}d</span>
                      </div>
                      <div className="text-xs truncate mt-0.5 font-medium">{l.customerName} {l.customerCompany ? `· ${l.customerCompany}` : ''}</div>
                      <div className="text-[10px] text-muted-foreground">โดย {l.salesRepName} • {l.items.length} ชิ้น</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-smooth" />
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Standby */}
        <Card className="shadow-sm overflow-hidden border-amber-200/60 dark:border-amber-900/30">
          <CardHeader className="pb-2 px-4 pt-3 bg-gradient-to-r from-amber-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center ring-1 ring-amber-500/20">
                  <Wrench className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <span className="block">เครื่องสำรองซ่อม</span>
                  <span className="text-[10px] font-normal text-muted-foreground">ที่ยังไม่คืนของจริง</span>
                </div>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-amber-500/8 text-amber-600 border-amber-500/20">
                {data.standbyLoans.length} ใบ
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.standbyLoans.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-accent" />
                  <div className="font-medium">ไม่มีเครื่องสำรองค้าง</div>
                  <div className="text-[10px] mt-0.5">ทุกใบคืนครบแล้ว</div>
                </div>
              )}
              {data.standbyLoans.map((l) => {
                const days = daysUntil(l.expectedReturnDate)
                return (
                  <button
                    key={l.docNo}
                    onClick={() => onOpenLoan(l.docNo)}
                    className="w-full text-left px-4 py-2.5 hover:bg-amber-500/4 transition-smooth flex items-center gap-3 group"
                  >
                    <div className="h-9 w-9 rounded-full bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-600 flex-shrink-0">
                      {l.customerName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{l.docNo}</span>
                        {days < 0 && <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-full tabular-nums">เกิน {Math.abs(days)}d</span>}
                        {days >= 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full tabular-nums">{days}d left</span>}
                      </div>
                      <div className="text-xs truncate mt-0.5 font-medium">{l.customerName} {l.customerCompany ? `· ${l.customerCompany}` : ''}</div>
                      <div className="text-[10px] text-muted-foreground">คืน {formatThaiDate(l.expectedReturnDate)}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-smooth" />
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Brand + Dead Stock ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brand distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span>สัดส่วนแบรนด์</span>
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">{data.brandDistribution.length} แบรนด์</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-3">
              {data.brandDistribution.map((b, i) => {
                const pct = s.totalAssets > 0 ? (b.count / s.totalAssets) * 100 : 0
                const colors = ['bg-primary', 'bg-accent', 'bg-amber-500', 'bg-purple-500', 'bg-rose-500', 'bg-slate-400']
                const color = colors[i % colors.length]
                return (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${color}`} />
                        {b.brand}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        <b className="text-foreground">{b.count}</b> ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dead stock */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-slate-400/10 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-slate-400" />
                </div>
                <span>ของดอง — ไม่เคยถูกยืม</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">{data.deadStockAssets.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[220px] overflow-y-auto">
              {data.deadStockAssets.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-accent" />
                  <div className="font-medium">ไม่มีของดอง</div>
                </div>
              )}
              {data.deadStockAssets.slice(0, 10).map((a) => {
                const age = a.purchaseDate ? daysUntil(a.purchaseDate) : null
                return (
                  <div key={a.tagId} className="px-4 py-2 flex items-center gap-2.5 text-xs hover:bg-muted/30 transition-smooth">
                    <div className="h-7 w-7 rounded-md bg-slate-400/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <span className="font-mono font-semibold">{a.tagId}</span>
                    <span className="text-muted-foreground truncate flex-1">{a.brand} {a.model}</span>
                    {age !== null && (
                      <span className="text-[10px] text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                        {Math.abs(age)}d
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Activity Feed ===== */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span>กิจกรรมล่าสุด</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ActivityFeed embedded />
        </CardContent>
      </Card>

      <WidgetEditor
        open={widgetEditorOpen}
        onOpenChange={setWidgetEditorOpen}
        onChanged={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}

// ===== Gauge Mini — premium circular gauge =====
function GaugeMini({ label, value, color }: { label: string; value: number; color: 'primary' | 'accent' }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  const colorClass = color === 'primary' ? 'text-primary' : 'text-accent'
  const strokeClass = color === 'primary' ? 'stroke-primary' : 'stroke-accent'

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} className="stroke-muted fill-none" strokeWidth="3.5" />
          <circle
            cx="22" cy="22" r={r}
            className={`${strokeClass} fill-none transition-all duration-700`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums ${colorClass}`}>
          {value}
        </div>
      </div>
      <div>
        <div className="text-[10px] text-muted-foreground font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground/70">%</div>
      </div>
    </div>
  )
}

// ===== Premium Stat Widget with trend delta =====
const STAT_COLORS: Record<string, { bg: string; text: string; value: string; ring: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', value: '', ring: 'ring-primary/20' },
  accent: { bg: 'bg-accent/10', text: 'text-accent', value: 'text-accent', ring: 'ring-accent/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', value: 'text-amber-600', ring: 'ring-amber-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', value: 'text-purple-600', ring: 'ring-purple-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', value: 'text-rose-600', ring: 'ring-rose-500/20' },
  slate: { bg: 'bg-slate-400/10', text: 'text-slate-500', value: '', ring: 'ring-slate-400/20' },
}

function StatWidget({
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
  const c = STAT_COLORS[color] || STAT_COLORS.primary
  return (
    <div
      className={`group relative p-3.5 rounded-lg bg-card border border-border shadow-sm transition-smooth ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={`h-10 w-10 rounded-full ${c.bg} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}>
          <span className={c.text}>{icon}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${trend.up ? 'text-accent' : 'text-rose-500'}`}>
            {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            <span>{trend.delta}</span>
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums tracking-tight leading-none mb-1">{value}</div>
        <div className="text-[11px] text-muted-foreground font-medium truncate">{label}</div>
        {trend?.label && <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{trend.label}</div>}
      </div>
    </div>
  )
}
