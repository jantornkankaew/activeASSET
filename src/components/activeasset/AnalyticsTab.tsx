'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

const TREND_COLORS = ['#405189', '#0ab39c', '#f7b84b', '#f06548', '#a071f0']
const DONUT_COLORS: Record<string, string> = {
  Demo_Stock: '#0ab39c',
  Sales_Stock: '#405189',
  Supplier: '#a071f0',
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
      {/* ===== Hero header — analytics premium banner ===== */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-purple-500/8 via-card to-primary/6 p-5 shadow-sm">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-500">Analytics</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">วิเคราะห์การใช้งานและเชิงลึก</h2>
            <p className="text-xs text-muted-foreground">
              ข้อมูลเชิงลึกเพื่อการวางแผนการตลาดและบริหารสต็อก
            </p>
          </div>

          {/* Right — completion ring + summary */}
          <div className="flex items-center gap-4">
            <DonutMini
              segments={[
                { value: data.summary.completedLoans, color: '#0ab39c', label: 'คืนครบ' },
                { value: data.summary.activeLoans, color: '#f7b84b', label: 'กำลังยืม' },
                { value: data.summary.queuedLoans, color: '#f06548', label: 'ติดคิว' },
              ]}
              centerValue={`${completionRate}%`}
              centerLabel="อัตราคืนสำเร็จ"
            />
          </div>
        </div>
      </div>

      {/* ===== Summary KPI — premium cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="ยืมทั้งหมด" value={data.summary.totalLoans} icon={<FileText className="h-5 w-5" />} color="primary" sub="ตลอดกาล" />
        <SummaryCard label="กำลังยืม" value={data.summary.activeLoans} icon={<TrendingUp className="h-5 w-5" />} color="accent" sub="ใบปัจจุบัน" />
        <SummaryCard label="คืนครบแล้ว" value={data.summary.completedLoans} icon={<CheckCircle2 className="h-5 w-5" />} color="emerald" sub={`${completionRate}% สำเร็จ`} />
        <SummaryCard label="ติดคิว" value={data.summary.queuedLoans} icon={<AlertTriangle className="h-5 w-5" />} color="rose" sub="รอสต็อก" />
      </div>

      {/* ===== Trend + Source Donut ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend — Velzon gradient bars */}
        <Card className="shadow-sm lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span>แนวโน้มการยืม 6 เดือนล่าสุด</span>
              </CardTitle>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                {data.trend.reduce((s, t) => s + t.count, 0)} ครั้ง
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="flex items-end gap-3 h-44">
              {data.trend.map((t, i) => {
                const h = Math.max((t.count / maxTrend) * 100, 4)
                return (
                  <div key={t.month} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="text-xs font-bold tabular-nums opacity-70 group-hover:opacity-100 transition-smooth">{t.count}</div>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md transition-all duration-500 group-hover:opacity-90"
                        style={{
                          height: `${h}%`,
                          background: `linear-gradient(180deg, ${TREND_COLORS[i % TREND_COLORS.length]} 0%, ${TREND_COLORS[i % TREND_COLORS.length]}99 100%)`,
                          boxShadow: `0 2px 8px -2px ${TREND_COLORS[i % TREND_COLORS.length]}66`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium">{t.label}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Source Donut */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                <PieIcon className="h-4 w-4 text-purple-500" />
              </div>
              <span>Source สินค้า</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <DonutChart
              segments={[
                { value: data.sourceStats.Demo_Stock, color: DONUT_COLORS.Demo_Stock, label: 'คลังเดโม' },
                { value: data.sourceStats.Sales_Stock, color: DONUT_COLORS.Sales_Stock, label: 'คลังขาย' },
                { value: data.sourceStats.Supplier, color: DONUT_COLORS.Supplier, label: 'ยืม Supplier' },
              ]}
              centerValue={totalAssets}
              centerLabel="รวม"
            />
          </CardContent>
        </Card>
      </div>

      {/* ===== Top Models + Demand vs Supply ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top models */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <span>รุ่นยอดนิยม (Top 10)</span>
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">ครั้งการยืม</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-2.5">
              {data.topModels.map((m, i) => (
                <div key={m.model} className="group">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span className={`h-5 w-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white tabular-nums`} style={{ backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }}>
                        {i + 1}
                      </span>
                      <span className="truncate">{m.brand} {m.model}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums font-semibold">{m.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                      style={{
                        width: `${(m.count / maxModel) * 100}%`,
                        background: `linear-gradient(90deg, ${TREND_COLORS[i % TREND_COLORS.length]}, ${TREND_COLORS[i % TREND_COLORS.length]}aa)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Demand vs Supply */}
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <span>Demand vs Supply รายรุ่น</span>
              </CardTitle>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] bg-rose-500/8 text-rose-600 border-rose-500/20">
                  {data.demandSupply.filter(d => d.status === 'shortage').length} ขาด
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-amber-500/8 text-amber-600 border-amber-500/20">
                  {data.demandSupply.filter(d => d.status === 'tight').length} ใกล้
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
              {data.demandSupply.map((d) => {
                const utilPct = parseFloat(d.utilization) || 0
                return (
                  <div key={d.model} className="px-4 py-2.5 hover:bg-muted/30 transition-smooth">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{d.brand} {d.model}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        d.status === 'shortage' ? 'bg-rose-500/10 text-rose-600' :
                        d.status === 'tight' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-accent/10 text-accent'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          d.status === 'shortage' ? 'bg-rose-500' :
                          d.status === 'tight' ? 'bg-amber-500' : 'bg-accent'
                        }`} />
                        {d.status === 'shortage' ? 'ขาดสต็อก' : d.status === 'tight' ? 'ใกล้หมด' : 'พอเพียง'}
                      </span>
                    </div>
                    {/* Mini bar — 4 segments stacked */}
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted mb-1.5">
                      <div className="bg-accent" style={{ width: `${d.totalUnits > 0 ? (d.available / d.totalUnits) * 100 : 0}%` }} title={`ว่าง ${d.available}`} />
                      <div className="bg-amber-500" style={{ width: `${d.totalUnits > 0 ? (d.onLoan / d.totalUnits) * 100 : 0}%` }} title={`ยืม ${d.onLoan}`} />
                      <div className="bg-rose-500" style={{ width: `${d.totalUnits > 0 ? (d.inRepair / d.totalUnits) * 100 : 0}%` }} title={`ซ่อม ${d.inRepair}`} />
                      {d.supplierUnits > 0 && (
                        <div className="bg-purple-500" style={{ width: `${d.totalUnits > 0 ? (d.supplierUnits / d.totalUnits) * 100 : 0}%` }} title={`Supplier ${d.supplierUnits}`} />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>สต็อก <b className="text-foreground">{d.totalUnits}</b></span>
                        <span className="text-accent">ว่าง <b>{d.available}</b></span>
                        <span className="text-amber-600">ยืม <b>{d.onLoan}</b></span>
                        <span className="text-rose-600">คิว <b>{d.totalWaiting}</b></span>
                      </div>
                      <span className="font-medium">Util {d.utilization}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Purpose + Industry — 2 columns with rich bars ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purpose distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <span>วัตถุประสงค์การยืม</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-3">
              {data.purposes.map((p, i) => {
                const max = Math.max(...data.purposes.map((x) => x.count), 1)
                const pct = (p.count / max) * 100
                return (
                  <div key={p.purpose}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{PURPOSE_LABELS[p.purpose] || p.purpose}</span>
                      <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{p.count}</b> ครั้ง</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${TREND_COLORS[i % TREND_COLORS.length]}, ${TREND_COLORS[i % TREND_COLORS.length]}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Industry distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-accent" />
              </div>
              <span>อุตสาหกรรมลูกค้า</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-3">
              {data.industries.map((ind, i) => {
                const max = Math.max(...data.industries.map((x) => x.count), 1)
                const pct = (ind.count / max) * 100
                return (
                  <div key={ind.industry}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{INDUSTRY_LABELS[ind.industry] || ind.industry}</span>
                      <span className="text-muted-foreground tabular-nums"><b className="text-foreground">{ind.count}</b> ครั้ง</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${TREND_COLORS[(i + 2) % TREND_COLORS.length]}, ${TREND_COLORS[(i + 2) % TREND_COLORS.length]}aa)`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Top Customers — sales opportunity table ===== */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="pb-3 px-4 pt-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <span>ลูกค้าที่ยืมบ่อย (Top 10)</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-amber-500/8 text-amber-600 border-amber-500/20">
              โอกาสการขาย
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
            {data.topCustomers.map((c, i) => (
              <div key={c.company} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-smooth">
                <div className={`h-8 w-8 rounded-md flex items-center justify-center text-xs font-bold text-white tabular-nums flex-shrink-0`} style={{ backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{c.company}</div>
                  <div className="text-[10px] text-muted-foreground">{INDUSTRY_LABELS[c.industry || ''] || c.industry || 'Unknown'}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold tabular-nums">{c.count}</div>
                  <div className="text-[10px] text-muted-foreground">ครั้ง</div>
                </div>
                {c.count >= 3 && (
                  <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/15">
                    <ArrowUpRight className="h-3 w-3 mr-0.5" /> โอกาสขาย
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Donut Chart — premium SVG donut =====
function DonutChart({
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
          <circle cx="60" cy="60" r={r} className="stroke-muted fill-none" strokeWidth={stroke} />
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
          <div className="text-2xl font-bold tabular-nums tracking-tight">{centerValue}</div>
          <div className="text-[10px] text-muted-foreground">{centerLabel}</div>
        </div>
      </div>
      <div className="space-y-1.5 flex-1">
        {segments.map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="font-medium flex-1 truncate">{seg.label}</span>
              <span className="text-muted-foreground tabular-nums">{seg.value}</span>
              <span className="text-muted-foreground/70 tabular-nums text-[10px] w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ===== Donut Mini — for hero header (smaller, no legend) =====
function DonutMini({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: Array<{ value: number; color: string; label: string }>
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
        <circle cx="40" cy="40" r={r} className="stroke-muted fill-none" strokeWidth={stroke} />
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
        <div className="text-base font-bold tabular-nums tracking-tight leading-none">{centerValue}</div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground font-medium">
        {centerLabel}
      </div>
    </div>
  )
}

// ===== Summary Card — premium KPI =====
const SUMMARY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/20' },
  accent: { bg: 'bg-accent/10', text: 'text-accent', ring: 'ring-accent/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', ring: 'ring-emerald-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', ring: 'ring-rose-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500', ring: 'ring-amber-500/20' },
}

function SummaryCard({
  label, value, icon, color, sub,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  sub: string
}) {
  const c = SUMMARY_COLORS[color] || SUMMARY_COLORS.primary
  return (
    <div className="p-4 rounded-lg bg-card border border-border shadow-sm transition-smooth hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`h-11 w-11 rounded-full ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <span className={c.text}>{icon}</span>
        </div>
      </div>
      <div className="text-3xl font-bold tabular-nums tracking-tight leading-none mb-1">{value}</div>
      <div className="text-xs font-medium text-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  )
}
