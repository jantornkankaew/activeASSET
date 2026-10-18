'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  LoadingState, EmptyState,
} from './shared'
import {
  TrendingUp, BarChart3, Users, Package, AlertTriangle,
  CheckCircle2, FileText, PieChart as PieIcon, Sparkles, ArrowUpRight,
  ChevronDown, ChevronRight,
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

// Velzon color tokens (CRM palette)
const VZ = { primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548', purple: '#a071f0', slate: '#74788d' }
const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64,81,137,0.10)', teal: 'rgba(10,179,156,0.10)',
  amber: 'rgba(247,184,75,0.12)', rose: 'rgba(240,101,72,0.10)',
  purple: 'rgba(160,113,240,0.10)', slate: 'rgba(116,120,141,0.12)',
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
  // Sort dropdowns (Velzon CRM signature)
  const [sortByTrend, setSortByTrend] = useState('6 เดือนล่าสุด')
  const [sortBySource, setSortBySource] = useState('ทั้งหมด')
  const [sortByDemand, setSortByDemand] = useState('ขาดสต็อกก่อน')
  const [sortByCustomers, setSortByCustomers] = useState('ครั้งยืมมากสุด')

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
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon CRM page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            วิเคราะห์การใช้งานและเชิงลึก
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">ข้อมูลเชิงลึกเพื่อการวางแผนการตลาดและบริหารสต็อก</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Reports</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium">Analytics</span>
        </div>
      </div>

      {/* ===== Velzon CRM crm-widget (5 mini stats horizontal) ===== */}
      <div className="vz-crm-widget">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 g-0">
          <CrmStat
            label="ยืมทั้งหมด"
            value={data.summary.totalLoans}
            icon={<FileText className="h-6 w-6" />}
            trend="up"
            trendText="ตลอดกาล"
          />
          <CrmStat
            label="กำลังยืม"
            value={data.summary.activeLoans}
            icon={<TrendingUp className="h-6 w-6" />}
            trend="up"
            trendText="ใบปัจจุบัน"
          />
          <CrmStat
            label="คืนครบแล้ว"
            value={data.summary.completedLoans}
            icon={<CheckCircle2 className="h-6 w-6" />}
            trend="up"
            trendText={`${completionRate}% สำเร็จ`}
          />
          <CrmStat
            label="ติดคิว"
            value={data.summary.queuedLoans}
            icon={<AlertTriangle className="h-6 w-6" />}
            trend={data.summary.queuedLoans > 0 ? 'down' : 'up'}
            trendText="รอสต็อก"
          />
          <CrmStat
            label="อัตราสำเร็จ"
            value={`${completionRate}%`}
            icon={<BarChart3 className="h-6 w-6" />}
            trend="up"
            trendText="คืนสำเร็จ"
          />
        </div>
      </div>

      {/* ===== Velzon CRM — 3-col charts (Sales Forecast / Deal Type / Balance Overview) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1 — Trend chart (Balance Overview pattern with 3 inline stats) */}
        <div className="lg:col-span-2 vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <TrendingUp className="h-4 w-4" style={{ color: VZ.primary }} />
              แนวโน้มการยืม
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByTrend} onChange={setSortByTrend} options={['6 เดือนล่าสุด', '3 เดือนล่าสุด', 'เดือนนี้']} />
            </div>
          </div>
          <div className="px-4 py-3">
            {/* 3 inline stats — Velzon Balance Overview pattern */}
            <div className="vz-crm-inline-stats">
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.primary }}>{data.trend.reduce((s, t) => s + t.count, 0)}</div>
                <div className="vz-crm-inline-label">รวม 6 เดือน</div>
              </div>
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.teal }}>{data.trend[0]?.count || 0}</div>
                <div className="vz-crm-inline-label">{data.trend[0]?.label || '-'}</div>
              </div>
              <div className="vz-crm-inline-stat">
                <div className="vz-crm-inline-num" style={{ color: VZ.amber }}>{maxTrend}</div>
                <div className="vz-crm-inline-label">สูงสุด</div>
              </div>
            </div>
            {/* Area chart */}
            <VelzonTrendChart data={data.trend} maxTrend={maxTrend} />
          </div>
        </div>

        {/* Card 2 — Source Donut (Deal Type pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <PieIcon className="h-4 w-4" style={{ color: VZ.purple }} />
              Source สินค้า
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortBySource} onChange={setSortBySource} options={['ทั้งหมด', 'เดือนนี้', 'ไตรมาสนี้']} />
            </div>
          </div>
          <div className="p-4">
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

      {/* ===== Velzon CRM — 2-col (Deals Status table + My Tasks list) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Top Customers (Deals Status pattern) */}
        <div className="lg:col-span-2 vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <Users className="h-4 w-4" style={{ color: VZ.amber }} />
              ลูกค้าที่ยืมบ่อย
            </h5>
            <div className="flex-shrink-0">
              <SortDropdown value={sortByCustomers} onChange={setSortByCustomers} options={['ครั้งยืมมากสุด', 'อุตสาหกรรม', 'ล่าสุด']} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="vz-crm-table">
              <thead>
                <tr>
                  <th>บริษัท</th>
                  <th>อุตสาหกรรม</th>
                  <th className="text-right">ครั้งยืม</th>
                  <th className="text-right">โอกาสขาย</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">ยังไม่มีข้อมูล</td></tr>
                )}
                {data.topCustomers.slice(0, 8).map((c, i) => {
                  const color = TREND_COLORS[i % TREND_COLORS.length]
                  return (
                    <tr key={c.company}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="vz-avatar h-7 w-7 text-[10px] text-white" style={{ backgroundColor: color }}>
                            {i + 1}
                          </div>
                          <span className="text-foreground font-medium truncate">{c.company}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">
                        {INDUSTRY_LABELS[c.industry || ''] || c.industry || '-'}
                      </td>
                      <td className="text-right tabular-nums font-medium">{c.count}</td>
                      <td className="text-right">
                        {c.count >= 3 && (
                          <span className="vz-pill vz-pill-warning">
                            <ArrowUpRight className="h-2.5 w-2.5" /> โอกาสขาย
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — Top Models (My Tasks pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <Package className="h-4 w-4" style={{ color: VZ.primary }} />
              รุ่นยอดนิยม
            </h5>
            <div className="flex-shrink-0">
              <span className="vz-pill vz-pill-muted">Top 10</span>
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 flex items-center justify-between">
            <div className="text-[11px] text-muted-foreground">
              <b className="text-foreground">{data.topModels.length}</b> รุ่นแตกต่าง
            </div>
            <span className="text-[10px] text-muted-foreground">เรียงตามครั้งยืม</span>
          </div>
          <div className="vz-crm-tasks" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {data.topModels.map((m, i) => {
              const color = TREND_COLORS[i % TREND_COLORS.length]
              return (
                <div key={m.model} className="vz-crm-task">
                  <div className="vz-icon-soft h-7 w-7 text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: color, borderRadius: '4px' }}>
                    {i + 1}
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="text-[11px] font-medium text-foreground truncate">{m.brand} {m.model}</div>
                    <div className="mt-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(m.count / maxModel) * 100}%`,
                            background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-[11px] font-semibold tabular-nums" style={{ color }}>{m.count}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ===== Velzon CRM — Bottom row (Demand vs Supply + Purpose/Industry) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Demand vs Supply (Deals Status table pattern) */}
        <div className="lg:col-span-2 vz-card overflow-hidden">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex-grow-1 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <AlertTriangle className="h-4 w-4" style={{ color: VZ.amber }} />
              Demand vs Supply รายรุ่น
            </h5>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="vz-pill vz-pill-danger">{data.demandSupply.filter(d => d.status === 'shortage').length} ขาด</span>
              <span className="vz-pill vz-pill-warning">{data.demandSupply.filter(d => d.status === 'tight').length} ใกล้</span>
              <SortDropdown value={sortByDemand} onChange={setSortByDemand} options={['ขาดสต็อกก่อน', 'ใกล้หมดก่อน', 'ล่าสุด']} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="vz-crm-table">
              <thead>
                <tr>
                  <th>รุ่น</th>
                  <th className="text-right">สต็อก</th>
                  <th className="text-right">ว่าง</th>
                  <th className="text-right">คิว</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {data.demandSupply.slice(0, 10).map((d) => {
                  const statusColor = d.status === 'shortage' ? VZ.rose : d.status === 'tight' ? VZ.amber : VZ.teal
                  const statusSoft = d.status === 'shortage' ? VZ_SOFT.rose : d.status === 'tight' ? VZ_SOFT.amber : VZ_SOFT.teal
                  const statusLabel = d.status === 'shortage' ? 'ขาดสต็อก' : d.status === 'tight' ? 'ใกล้หมด' : 'พอเพียง'
                  return (
                    <tr key={d.model}>
                      <td>
                        <div className="text-foreground font-medium truncate">{d.brand} {d.model}</div>
                        <div className="text-[10px] text-muted-foreground">Util {d.utilization}</div>
                      </td>
                      <td className="text-right tabular-nums font-medium text-foreground">{d.totalUnits}</td>
                      <td className="text-right tabular-nums" style={{ color: VZ.teal }}>{d.available}</td>
                      <td className="text-right tabular-nums" style={{ color: d.totalWaiting > 0 ? VZ.rose : VZ.slate }}>{d.totalWaiting}</td>
                      <td>
                        <span className="vz-pill" style={{ backgroundColor: statusSoft, color: statusColor }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — Purpose + Industry (My Tasks pattern) */}
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider">
            <h5 className="text-sm font-semibold text-foreground mb-0 flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              <BarChart3 className="h-4 w-4" style={{ color: VZ.primary }} />
              วัตถุประสงค์ + อุตสาหกรรม
            </h5>
          </div>
          <div className="vz-crm-tasks">
            {data.purposes.slice(0, 5).map((p, i) => {
              const max = Math.max(...data.purposes.map((x) => x.count), 1)
              const pct = (p.count / max) * 100
              const color = TREND_COLORS[i % TREND_COLORS.length]
              return (
                <div key={p.purpose} className="vz-crm-task">
                  <div className="flex-grow-1 min-w-0">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-medium text-foreground">{PURPOSE_LABELS[p.purpose] || p.purpose}</span>
                      <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{p.count}</b> ครั้ง</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {data.purposes.length === 0 && <div className="py-4 text-center text-xs text-muted-foreground">ยังไม่มีข้อมูล</div>}
          </div>
          <div className="border-t border-dashed border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">อุตสาหกรรมลูกค้า</div>
            <div className="flex flex-wrap gap-1">
              {data.industries.map((ind, i) => {
                const color = TREND_COLORS[i % TREND_COLORS.length]
                return (
                  <span
                    key={ind.industry}
                    className="vz-pill"
                    style={{ backgroundColor: `${color}11`, color }}
                  >
                    {INDUSTRY_LABELS[ind.industry] || ind.industry} · {ind.count}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== CRM Mini Stat component (same as OverviewTab) =====
function CrmStat({
  label, value, icon, trend, trendText, pulse,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  trend: 'up' | 'down'
  trendText: string
  pulse?: boolean
}) {
  return (
    <div className={`vz-crm-stat ${pulse ? 'animate-pulse' : ''}`}>
      <div className="vz-crm-label">
        <span>{label}</span>
        {trend === 'up' ? (
          <ArrowUpRight className="h-3 w-3" style={{ color: VZ.teal }} />
        ) : (
          <ArrowUpRight className="h-3 w-3" style={{ color: VZ.rose }} />
        )}
      </div>
      <div className="vz-crm-value-row">
        <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
        <div className="flex-grow-1">
          <span className="vz-crm-num vz-crm-counter">{value}</span>
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

// ===== Sort Dropdown — Velzon CRM pattern (same as OverviewTab) =====
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

// ===== Trend chart — Velzon Balance Overview pattern (smooth area chart) =====
function VelzonTrendChart({
  data, maxTrend,
}: {
  data: Array<{ month: string; count: number; label: string }>
  maxTrend: number
}) {
  const W = 100
  const H = 180
  const chartH = 150
  const slot = W / data.length
  const points = data.map((d, i) => {
    const x = i * slot + slot / 2
    const y = chartH - (d.count / maxTrend) * chartH
    return { x, y, count: d.count, label: d.label }
  })
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="vz-trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((t, i) => (
        <line
          key={i}
          x1="0" x2={W}
          y1={chartH - t * chartH}
          y2={chartH - t * chartH}
          stroke="currentColor"
          strokeWidth="0.2"
          className="text-muted-foreground"
          strokeDasharray="1 1.5"
          opacity="0.4"
        />
      ))}
      <path d={pathStr} fill="url(#vz-trend-grad)" />
      <path d={lineStr} fill="none" stroke={lineColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="1.5" fill={lineColor} />
          <circle cx={p.x} cy={p.y} r="3" fill={lineColor} fillOpacity="0.15" />
          <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize="4.5" fontWeight="600" fill="currentColor" className="text-foreground">{p.count}</text>
          <text x={p.x} y={chartH + 8} textAnchor="middle" fontSize="3.5" fill="currentColor" className="text-muted-foreground" fontWeight="500">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ===== Donut chart — Velzon Deal Type pattern =====
function VelzonDonutChart({
  segments, centerValue, centerLabel,
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
