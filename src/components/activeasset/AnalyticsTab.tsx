'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  LoadingState, EmptyState,
} from './shared'
import {
  TrendingUp, BarChart3, Users, Package, AlertTriangle,
  CheckCircle2, FileText, PieChart as PieIcon, Sparkles, ArrowUpRight,
} from 'lucide-react'
import {
  PURPOSE_LABELS, INDUSTRY_LABELS,
} from '@/lib/activeasset-constants'

interface AnalyticsData {
  summary: {
    totalLoans: number
    activeLoans: number
    completedLoans: number
    queuedLoans: number
  }
  topModels: Array<{ model: string; count: number; brand: string; category: string }>
  categories: Array<{ category: string; count: number }>
  brands: Array<{ brand: string; count: number }>
  purposes: Array<{ purpose: string; count: number }>
  industries: Array<{ industry: string; count: number }>
  topCustomers: Array<{ company: string; count: number; industry: string | null }>
  demandSupply: Array<{
    model: string; brand: string; category: string
    totalUnits: number; available: number; onLoan: number; inRepair: number; supplierUnits: number
    totalRequested: number; totalWaiting: number
    utilization: string; demandScore: string
    status: 'sufficient' | 'tight' | 'shortage'
  }>
  trend: Array<{ month: string; count: number; label: string }>
  sourceStats: { Demo_Stock: number; Sales_Stock: number; Supplier: number }
}

// === Velzon color palette ===
const VZ = {
  primary: '#405189',
  teal:    '#0ab39c',
  amber:   '#f7b84b',
  rose:    '#f06548',
  purple:  '#a071f0',
  slate:   '#74788d',
}
const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64, 81, 137, 0.10)',
  teal:    'rgba(10, 179, 156, 0.10)',
  amber:   'rgba(247, 184, 75, 0.12)',
  rose:    'rgba(240, 101, 72, 0.10)',
  purple:  'rgba(160, 113, 240, 0.10)',
  slate:   'rgba(116, 120, 141, 0.12)',
}
const TREND_COLORS = [VZ.primary, VZ.teal, VZ.amber, VZ.rose, VZ.purple]
const DONUT_COLORS: Record<string, string> = {
  Demo_Stock: VZ.teal,
  Sales_Stock: VZ.primary,
  Supplier: VZ.purple,
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState message="ไม่สามารถโหลดข้อมูล analytics" />

  const maxModel = Math.max(...data.topModels.map((m) => m.count), 1)
  const maxTrend = Math.max(...data.trend.map((t) => t.count), 1)
  const totalAssets = data.sourceStats.Demo_Stock + data.sourceStats.Sales_Stock + data.sourceStats.Supplier

  const completionRate = data.summary.totalLoans > 0
    ? Math.round((data.summary.completedLoans / data.summary.totalLoans) * 100)
    : 0

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ===== Velzon gradient hero banner ===== */}
      <div className="vz-banner p-5 lg:p-6">
        <div className="vz-banner-pattern" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/80" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85">Analytics</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">วิเคราะห์การใช้งานและเชิงลึก</h2>
            <p className="text-xs text-white/75 max-w-lg leading-relaxed">
              ข้อมูลเชิงลึกเพื่อการวางแผนการตลาดและบริหารสต็อก — Demand vs Supply, Trend, และโอกาสการขาย
            </p>
          </div>
          <div className="flex items-center">
            <VelzonDonutBanner
              segments={[
                { value: data.summary.completedLoans, color: '#0ab39c' },
                { value: data.summary.activeLoans, color: '#f7b84b' },
                { value: data.summary.queuedLoans, color: '#f06548' },
              ]}
              centerValue={`${completionRate}%`}
              centerLabel="อัตราคืนสำเร็จ"
            />
          </div>
        </div>
      </div>

      {/* ===== KPI — Velzon stat cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <VelzonStatCard label="ยืมทั้งหมด" value={data.summary.totalLoans} icon={<FileText className="h-5 w-5" />} color="primary" sub="ตลอดกาล" trend={{ delta: `${completionRate}%`, label: 'สำเร็จ', up: true }} />
        <VelzonStatCard label="กำลังยืม" value={data.summary.activeLoans} icon={<TrendingUp className="h-5 w-5" />} color="teal" sub="ใบปัจจุบัน" trend={{ delta: `${data.summary.activeLoans}`, label: 'คงค้าง', up: data.summary.activeLoans > 0 }} />
        <VelzonStatCard label="คืนครบแล้ว" value={data.summary.completedLoans} icon={<CheckCircle2 className="h-5 w-5" />} color="teal" sub={`${completionRate}% สำเร็จ`} trend={{ delta: `${completionRate}%`, label: 'rate', up: completionRate >= 50 }} />
        <VelzonStatCard label="ติดคิว" value={data.summary.queuedLoans} icon={<AlertTriangle className="h-5 w-5" />} color="rose" sub="รอสต็อก" trend={{ delta: `${data.summary.queuedLoans}`, label: 'คิว', up: data.summary.queuedLoans === 0 }} />
      </div>

      {/* ===== Trend chart + Source donut ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend — Velzon area chart */}
        <div className="vz-card lg:col-span-2 overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.primary }}>
                <TrendingUp className="h-4 w-4" style={{ color: VZ.primary }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">แนวโน้มการยืม 6 เดือนล่าสุด</div>
                <div className="text-[10px] text-muted-foreground">รายเดือน</div>
              </div>
            </div>
            <span className="vz-pill vz-pill-info">
              {data.trend.reduce((s, t) => s + t.count, 0)} ครั้ง
            </span>
          </div>
          <div className="px-4 py-4">
            <VelzonTrendChart data={data.trend} maxTrend={maxTrend} />
          </div>
        </div>

        {/* Source Donut */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.purple }}>
                <PieIcon className="h-4 w-4" style={{ color: VZ.purple }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">Source สินค้า</div>
                <div className="text-[10px] text-muted-foreground">แหล่งที่มาทรัพย์สิน</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <VelzonDonutChart
              segments={[
                { value: data.sourceStats.Demo_Stock, color: DONUT_COLORS.Demo_Stock, label: 'คลังเดโม' },
                { value: data.sourceStats.Sales_Stock, color: DONUT_COLORS.Sales_Stock, label: 'คลังขาย' },
                { value: data.sourceStats.Supplier, color: DONUT_COLORS.Supplier, label: 'ยืม Supplier' },
              ]}
              centerValue={totalAssets}
              centerLabel="รวม"
            />
          </div>
        </div>
      </div>

      {/* ===== Top Models + Demand vs Supply ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top models */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.primary }}>
                <Package className="h-4 w-4" style={{ color: VZ.primary }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">รุ่นยอดนิยม (Top 10)</div>
                <div className="text-[10px] text-muted-foreground">เรียงตามจำนวนครั้งยืม</div>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">ครั้ง</span>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-2.5">
              {data.topModels.map((m, i) => {
                const color = TREND_COLORS[i % TREND_COLORS.length]
                return (
                  <div key={m.model} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground flex items-center gap-2">
                        <span
                          className="vz-icon-soft h-5 w-5 text-[10px] font-bold text-white tabular-nums"
                          style={{ backgroundColor: color, borderRadius: '4px' }}
                        >
                          {i + 1}
                        </span>
                        <span className="truncate">{m.brand} {m.model}</span>
                      </span>
                      <span className="text-muted-foreground tabular-nums font-semibold">{m.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                        style={{
                          width: `${(m.count / maxModel) * 100}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Demand vs Supply */}
        <div className="vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.amber }}>
                <AlertTriangle className="h-4 w-4" style={{ color: VZ.amber }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">Demand vs Supply รายรุ่น</div>
                <div className="text-[10px] text-muted-foreground">เปรียบเทียบสต็อกกับความต้องการ</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="vz-pill vz-pill-danger">
                {data.demandSupply.filter(d => d.status === 'shortage').length} ขาด
              </span>
              <span className="vz-pill vz-pill-warning">
                {data.demandSupply.filter(d => d.status === 'tight').length} ใกล้
              </span>
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {data.demandSupply.map((d, i) => {
              const utilPct = parseFloat(d.utilization) || 0
              const statusColor = d.status === 'shortage' ? VZ.rose : d.status === 'tight' ? VZ.amber : VZ.teal
              const statusSoft = d.status === 'shortage' ? VZ_SOFT.rose : d.status === 'tight' ? VZ_SOFT.amber : VZ_SOFT.teal
              return (
                <div key={d.model} className={`px-4 py-2.5 hover:bg-muted/30 transition-smooth ${i < data.demandSupply.length - 1 ? 'vz-divider' : ''}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-foreground">{d.brand} {d.model}</span>
                    <span className="vz-pill" style={{ backgroundColor: statusSoft, color: statusColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                      {d.status === 'shortage' ? 'ขาดสต็อก' : d.status === 'tight' ? 'ใกล้หมด' : 'พอเพียง'}
                    </span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted mb-1.5">
                    <div style={{ width: `${d.totalUnits > 0 ? (d.available / d.totalUnits) * 100 : 0}%`, backgroundColor: VZ.teal }} title={`ว่าง ${d.available}`} />
                    <div style={{ width: `${d.totalUnits > 0 ? (d.onLoan / d.totalUnits) * 100 : 0}%`, backgroundColor: VZ.amber }} title={`ยืม ${d.onLoan}`} />
                    <div style={{ width: `${d.totalUnits > 0 ? (d.inRepair / d.totalUnits) * 100 : 0}%`, backgroundColor: VZ.rose }} title={`ซ่อม ${d.inRepair}`} />
                    {d.supplierUnits > 0 && (
                      <div style={{ width: `${d.totalUnits > 0 ? (d.supplierUnits / d.totalUnits) * 100 : 0}%`, backgroundColor: VZ.purple }} title={`Supplier ${d.supplierUnits}`} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>สต็อก <b className="text-foreground">{d.totalUnits}</b></span>
                      <span style={{ color: VZ.teal }}>ว่าง <b>{d.available}</b></span>
                      <span style={{ color: VZ.amber }}>ยืม <b>{d.onLoan}</b></span>
                      <span style={{ color: VZ.rose }}>คิว <b>{d.totalWaiting}</b></span>
                    </div>
                    <span className="font-medium text-foreground">Util {d.utilization}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Purpose + Industry ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purpose distribution */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.primary }}>
                <BarChart3 className="h-4 w-4" style={{ color: VZ.primary }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">วัตถุประสงค์การยืม</div>
                <div className="text-[10px] text-muted-foreground">แยกตามประเภท</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-3">
              {data.purposes.map((p, i) => {
                const max = Math.max(...data.purposes.map((x) => x.count), 1)
                const pct = (p.count / max) * 100
                const color = TREND_COLORS[i % TREND_COLORS.length]
                return (
                  <div key={p.purpose}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{PURPOSE_LABELS[p.purpose] || p.purpose}</span>
                      <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{p.count}</b> ครั้ง</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Industry distribution */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider">
            <div className="flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.teal }}>
                <BarChart3 className="h-4 w-4" style={{ color: VZ.teal }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">อุตสาหกรรมลูกค้า</div>
                <div className="text-[10px] text-muted-foreground">แยกตามภาคอุตสาหกรรม</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="space-y-3">
              {data.industries.map((ind, i) => {
                const max = Math.max(...data.industries.map((x) => x.count), 1)
                const pct = (ind.count / max) * 100
                const color = TREND_COLORS[(i + 2) % TREND_COLORS.length]
                return (
                  <div key={ind.industry}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{INDUSTRY_LABELS[ind.industry] || ind.industry}</span>
                      <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{ind.count}</b> ครั้ง</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Top Customers — Velzon table ===== */}
      <div className="vz-card overflow-hidden">
        <div className="px-4 py-3 vz-divider flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: VZ_SOFT.amber }}>
              <Users className="h-4 w-4" style={{ color: VZ.amber }} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">ลูกค้าที่ยืมบ่อย (Top 10)</div>
              <div className="text-[10px] text-muted-foreground">เป้าหมายเชิงโอกาสการขาย</div>
            </div>
          </div>
          <span className="vz-pill vz-pill-warning">โอกาสขาย</span>
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {data.topCustomers.map((c, i) => {
            const color = TREND_COLORS[i % TREND_COLORS.length]
            return (
              <div
                key={c.company}
                className={`px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-smooth ${i < data.topCustomers.length - 1 ? 'vz-divider' : ''}`}
              >
                <div
                  className="vz-icon-soft h-8 w-8 text-xs font-bold text-white tabular-nums"
                  style={{ backgroundColor: color, borderRadius: '4px' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{c.company}</div>
                  <div className="text-[10px] text-muted-foreground">{INDUSTRY_LABELS[c.industry || ''] || c.industry || 'Unknown'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-foreground tabular-nums">{c.count}</div>
                  <div className="text-[10px] text-muted-foreground">ครั้ง</div>
                </div>
                {c.count >= 3 && (
                  <span className="vz-pill vz-pill-warning">
                    <ArrowUpRight className="h-2.5 w-2.5" /> โอกาสขาย
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===== Velzon trend chart — gradient area + bars =====
function VelzonTrendChart({
  data, maxTrend,
}: {
  data: Array<{ month: string; count: number; label: string }>
  maxTrend: number
}) {
  const W = 100  // viewBox width per bar slot
  const H = 180  // chart height in viewBox units
  const chartH = 150  // plot area height
  const padBottom = 30
  const slot = W / data.length

  // Build smooth area path
  const points = data.map((d, i) => {
    const x = i * slot + slot / 2
    const y = chartH - (d.count / maxTrend) * chartH
    return { x, y, count: d.count, label: d.label }
  })

  // Smooth path using cubic-bezier between points
  let pathStr = `M ${points[0].x} ${chartH} L ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx1 = prev.x + (curr.x - prev.x) / 2
    const cpx2 = prev.x + (curr.x - prev.x) / 2
    pathStr += ` C ${cpx1} ${prev.y} ${cpx2} ${curr.y} ${curr.x} ${curr.y}`
  }
  pathStr += ` L ${points[points.length - 1].x} ${chartH} Z`

  const lineStr = pathStr.replace(/ Z$/, '').replace(/^M [^ ]+ [^ ]+ L/, 'M')

  const lineColor = VZ.primary
  const fillGradId = 'vz-trend-grad'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1="0"
          x2={W}
          y1={chartH - t * chartH}
          y2={chartH - t * chartH}
          stroke="currentColor"
          strokeWidth="0.2"
          className="text-muted-foreground"
          strokeDasharray="1 1.5"
          opacity="0.4"
        />
      ))}
      {/* Area fill */}
      <path d={pathStr} fill={`url(#${fillGradId})`} />
      {/* Line stroke */}
      <path
        d={lineStr}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="1.5" fill={lineColor} />
          <circle cx={p.x} cy={p.y} r="3" fill={lineColor} fillOpacity="0.15" />
          <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize="4.5" fontWeight="600" fill="currentColor" className="text-foreground">
            {p.count}
          </text>
          <text x={p.x} y={chartH + 8} textAnchor="middle" fontSize="3.5" fill="currentColor" className="text-muted-foreground" fontWeight="500">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ===== Velzon donut chart — refined style =====
function VelzonDonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Array<{ value: number; color: string; label: string }>
  centerValue: number | string
  centerLabel: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
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
            const pct = seg.value / total
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
                strokeLinecap="butt"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground">{centerValue}</div>
          <div className="text-[10px] text-muted-foreground">{centerLabel}</div>
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

// ===== Donut for hero banner — small, white strokes on gradient =====
function VelzonDonutBanner({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Array<{ value: number; color: string }>
  centerValue: string
  centerLabel: string
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = 32
  const stroke = 8
  const circ = 2 * Math.PI * r
  let offsetAcc = 0

  return (
    <div className="relative h-20 w-20">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} className="fill-none" stroke="rgba(255,255,255,0.20)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circ
          const gap = circ - dash
          const offset = -offsetAcc * circ
          offsetAcc += pct
          return (
            <circle
              key={i}
              cx="40" cy="40" r={r}
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
        <div className="text-base font-bold tabular-nums tracking-tight leading-none text-white">{centerValue}</div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/75 font-medium">
        {centerLabel}
      </div>
    </div>
  )
}

// ===== Velzon stat card =====
const VZ_COLORS: Record<string, { fg: string; soft: string }> = {
  primary: { fg: VZ.primary, soft: VZ_SOFT.primary },
  teal:    { fg: VZ.teal,    soft: VZ_SOFT.teal },
  amber:   { fg: VZ.amber,   soft: VZ_SOFT.amber },
  rose:    { fg: VZ.rose,    soft: VZ_SOFT.rose },
  purple:  { fg: VZ.purple,  soft: VZ_SOFT.purple },
  slate:    { fg: VZ.slate,    soft: VZ_SOFT.slate },
}

function VelzonStatCard({
  label, value, icon, color, sub, trend,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  sub: string
  trend?: { delta: string; label: string; up: boolean }
}) {
  const c = VZ_COLORS[color] || VZ_COLORS.primary
  return (
    <div className="vz-card p-4 transition-smooth hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <span className="vz-icon-soft h-10 w-10" style={{ backgroundColor: c.soft }}>
          <span style={{ color: c.fg }}>{icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="vz-eyebrow truncate">{label}</div>
          <div className="vz-stat-num mt-1 mb-1.5">{value}</div>
          {trend ? (
            <div className="flex items-center gap-1.5">
              <span className={`vz-pill ${trend.up ? 'vz-pill-success' : 'vz-pill-danger'}`}>
                {trend.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
                {trend.delta}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">{trend.label}</span>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
          )}
        </div>
      </div>
    </div>
  )
}
