'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSimpleAuth } from '@/components/auth/SimpleAuth'
import { EmptyState, LoadingState } from './shared'
import { WidgetEditor } from './WidgetEditor'
import { ActivityFeed } from '@/components/notifications/ActivityFeed'
import {
  Package, CheckCircle2, Boxes, Wrench, Clock, AlertTriangle,
  ClipboardCheck, TrendingUp, ShoppingCart, ScanLine, Truck, Settings2,
  ChevronRight, ArrowUpRight, ArrowDownRight, Activity, Sparkles,
  ChevronDown, FileText, History, Calendar, Plus, ExternalLink, Eye,
  ArrowRight, Smartphone, Printer, Tablet, Star, DollarSign,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil, getLoanStatusLabel,
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
  recentLoans: Array<{
    docNo: string
    customerName: string
    customerCompany: string | null
    salesRepName: string
    purpose: string
    requestedAt: string
    expectedReturnDate: string
    status: string
    itemCount: number
    firstModel: string
    firstBrand: string
    category: string
  }>
  bestSellingProducts: Array<{
    id: string
    model: string
    brand: string
    category: string
    total: number
    available: number
    onLoan: number
    inRepair: number
    demandCount: number
  }>
  topBorrowers: Array<{
    name: string
    count: number
    active: number
    company?: string
  }>
  monthlyActivity: Array<{
    month: string
    loans: number
    returns: number
    utilization: number
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
  onNavigate: (tab: 'assets' | 'loans' | 'audit' | 'waiting' | 'analytics' | 'store-counter') => void
  onCreateLoan: () => void
  onStartAudit: () => void
  onOpenLoan: (docNo: string) => void
}

// Velzon official palette
const VZ = {
  primary: '#405189',
  teal: '#0ab39c',
  amber: '#f7b84b',
  rose: '#f06548',
  info: '#299cdb',
  purple: '#a071f0',
  slate: '#74788d',
}

const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64,81,137,0.10)',
  teal: 'rgba(10,179,156,0.10)',
  amber: 'rgba(247,184,75,0.12)',
  rose: 'rgba(240,101,72,0.10)',
  info: 'rgba(41,156,219,0.10)',
  purple: 'rgba(160,113,240,0.10)',
  slate: 'rgba(116,120,141,0.12)',
}

export function OverviewTab({ onNavigate, onCreateLoan, onStartAudit, onOpenLoan }: OverviewTabProps) {
  const { user } = useSimpleAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartRange, setChartRange] = useState<'ALL' | '1M' | '6M' | '1Y'>('ALL')
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (!data) return <EmptyState message="ไม่สามารถโหลดข้อมูลแดชบอร์ดได้" />

  const s = data.summary
  const utilization = s.totalAssets > 0 ? Math.round((s.onLoan / s.totalAssets) * 100) : 0
  const availablePct = s.totalAssets > 0 ? Math.round((s.available / s.totalAssets) * 100) : 0

  return (
    <div className="space-y-4 pb-8">
      {/* ============================================================== */}
      {/* 1. VELZON PAGE TITLE & GREETING BOX                           */}
      {/* ============================================================== */}
      <div className="vz-card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4
              className="text-base font-semibold text-foreground mb-0.5 tracking-tight"
              style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
            >
              สวัสดีครับ, {user?.name || 'ผู้ดูแลระบบ'}!
            </h4>
            <p className="text-xs text-muted-foreground mb-0">
              สรุปภาพรวมความเคลื่อนไหวทรัพย์สิน ใบยืม และสถานะคลังวันนี้ (Velzon Master Dashboard)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background text-xs font-medium text-muted-foreground shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>01 ต.ค. 2026 ถึง 31 ต.ค. 2026</span>
            </div>
            <Button
              onClick={onCreateLoan}
              className="px-3.5 py-1.5 h-8 text-xs font-medium text-white shadow-xs rounded-lg gap-1.5 transition-all hover:opacity-95"
              style={{ backgroundColor: VZ.primary }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>ขอยืมเครื่องใหม่</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. VELZON 4 KPI STAT CARDS (col-xl-3 col-md-6)                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 — Total Assets */}
        <VelzonKpiCard
          label="ทรัพย์สินทั้งหมด"
          value={s.totalAssets}
          suffix="เครื่อง"
          trend="+16.24%"
          trendType="up"
          linkText="ดูรายการทรัพย์สินทั้งหมด"
          onClickLink={() => onNavigate('assets')}
          icon={<Package className="h-6 w-6" />}
          colorHex={VZ.teal}
          softBgHex={VZ_SOFT.teal}
        />

        {/* KPI 2 — On Loan */}
        <VelzonKpiCard
          label="กำลังยืมอยู่"
          value={s.onLoan}
          suffix={`เครื่อง (${utilization}%)`}
          trend={`${s.activeLoans} ใบยืม`}
          trendType="neutral"
          linkText="ดูใบยืมทั้งหมด"
          onClickLink={() => onNavigate('loans')}
          icon={<Boxes className="h-6 w-6" />}
          colorHex={VZ.info}
          softBgHex={VZ_SOFT.info}
        />

        {/* KPI 3 — Overdue */}
        <VelzonKpiCard
          label="เกินกำหนดส่งคืน"
          value={s.overdueLoans}
          suffix="รายการ"
          trend={s.overdueLoans > 0 ? 'ต้องติดตามด่วน' : 'ปกติ'}
          trendType={s.overdueLoans > 0 ? 'down' : 'up'}
          pulse={s.overdueLoans > 0}
          linkText="ไปที่เคาน์เตอร์รับคืน"
          onClickLink={() => onNavigate('store-counter')}
          icon={<AlertTriangle className="h-6 w-6" />}
          colorHex={VZ.rose}
          softBgHex={VZ_SOFT.rose}
        />

        {/* KPI 4 — Available in Stock */}
        <VelzonKpiCard
          label="พร้อมใช้งานในคลัง"
          value={s.available}
          suffix={`เครื่อง (${availablePct}%)`}
          trend={`${availablePct}%`}
          trendType="up"
          linkText="สร้างคำขอยืมทันที"
          onClickLink={onCreateLoan}
          icon={<CheckCircle2 className="h-6 w-6" />}
          colorHex={VZ.primary}
          softBgHex={VZ_SOFT.primary}
        />
      </div>

      {/* ============================================================== */}
      {/* 3. ROW 2: REVENUE/ACTIVITY CHART (8 cols) + BRANDS (4 cols)    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (2 cols): Velzon Revenue / Asset Utilization Chart */}
        <div className="lg:col-span-2 vz-card overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-3.5 vz-divider flex items-center justify-between flex-wrap gap-2">
              <h5
                className="text-sm font-semibold text-foreground mb-0"
                style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
              >
                สถิติการใช้งานทรัพย์สิน & การเบิกยืม (Asset Flow & Activity)
              </h5>
              <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 text-[11px] font-medium">
                {(['ALL', '1M', '6M', '1Y'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      chartRange === r
                        ? 'bg-primary text-white shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    style={chartRange === r ? { backgroundColor: VZ.primary } : undefined}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Velzon Signature Dashed Mini Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-dashed border-border/80 bg-muted/10 text-center divide-x divide-dashed divide-border/80">
              <div className="p-3">
                <h5 className="text-base font-bold text-foreground mb-0.5 tabular-nums">
                  {s.totalAssets}
                </h5>
                <p className="text-[11px] text-muted-foreground mb-0">ทรัพย์สินทั้งหมด</p>
              </div>
              <div className="p-3">
                <h5 className="text-base font-bold mb-0.5 tabular-nums" style={{ color: VZ.teal }}>
                  {utilization}%
                </h5>
                <p className="text-[11px] text-muted-foreground mb-0">อัตราใช้งาน (Utilization)</p>
              </div>
              <div className="p-3">
                <h5 className="text-base font-bold mb-0.5 tabular-nums" style={{ color: VZ.amber }}>
                  {s.activeLoans}
                </h5>
                <p className="text-[11px] text-muted-foreground mb-0">ใบยืมที่เปิดอยู่</p>
              </div>
              <div className="p-3">
                <h5 className="text-base font-bold mb-0.5 tabular-nums" style={{ color: VZ.primary }}>
                  98.5%
                </h5>
                <p className="text-[11px] text-muted-foreground mb-0">ส่งมอบตรงเวลา</p>
              </div>
            </div>

            {/* Interactive SVG Smooth Area Chart */}
            <div className="p-4 sm:p-5">
              <VelzonAreaChart
                data={data.monthlyActivity}
                hoveredIdx={hoveredMonthIdx}
                setHoveredIdx={setHoveredMonthIdx}
              />
            </div>
          </div>

          <div className="px-5 py-2.5 bg-muted/15 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: VZ.primary }} />
              <span>ยอดเบิกยืม (Loans)</span>
              <span className="inline-block h-2 w-2 rounded-full ml-2" style={{ backgroundColor: VZ.teal }} />
              <span>ยอดรับคืน (Returns)</span>
            </span>
            <span className="text-[11px]">อัปเดตอัตโนมัติแบบเรียลไทม์</span>
          </div>
        </div>

        {/* Right (1 col): Velzon Sales by Locations / Top Brands */}
        <div className="lg:col-span-1 vz-card flex flex-col justify-between overflow-hidden">
          <div>
            <div className="px-5 py-3.5 vz-divider flex items-center justify-between">
              <h5
                className="text-sm font-semibold text-foreground mb-0"
                style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
              >
                สัดส่วนแบรนด์ยอดนิยม
              </h5>
              <button
                onClick={() => onNavigate('assets')}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
                style={{ color: VZ.primary }}
              >
                ดูทั้งหมด <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5">
              {data.brandDistribution.slice(0, 5).map((b, i) => {
                const pct = s.totalAssets > 0 ? Math.round((b.count / s.totalAssets) * 100) : 0
                const colors = [VZ.primary, VZ.teal, VZ.amber, VZ.info, VZ.purple]
                const colorHex = colors[i % colors.length]
                return (
                  <div key={b.brand} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorHex }} />
                        {b.brand}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        <b className="text-foreground">{b.count}</b> เครื่อง ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: colorHex }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sources Summary Footer */}
          <div className="p-4 bg-muted/20 border-t border-border/60">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              แหล่งที่มาทรัพย์สิน (Sources)
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-card border border-border/70">
                <div className="text-xs font-bold text-foreground">คลังเดโม</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Demo (85%)</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/70">
                <div className="text-xs font-bold text-foreground">เซลล์ยืม</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Sales (10%)</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border/70">
                <div className="text-xs font-bold text-foreground">ซัพพลายเออร์</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Supplier (5%)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. ROW 3: BEST SELLING PRODUCTS (1 col) + TOP BORROWERS (1 col) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Best Selling Products (Most Borrowed Models) */}
        <div className="vz-card overflow-hidden">
          <div className="px-5 py-3.5 vz-divider flex items-center justify-between">
            <h5
              className="text-sm font-semibold text-foreground mb-0"
              style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
            >
              สินค้ายอดนิยมที่มีการขอยืมมากที่สุด (Most Borrowed)
            </h5>
            <button
              onClick={() => onNavigate('assets')}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
              style={{ color: VZ.primary }}
            >
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4">รุ่น / แบรนด์</th>
                  <th className="py-2.5 px-3">หมวดหมู่</th>
                  <th className="py-2.5 px-3 text-center">ยอดคงเหลือ</th>
                  <th className="py-2.5 px-4 text-right">สถานะคลัง</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.bestSellingProducts.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onNavigate('assets')}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                            {p.category.includes('Printer') ? (
                              <Printer className="h-4 w-4" />
                            ) : p.category.includes('Tablet') ? (
                              <Tablet className="h-4 w-4" />
                            ) : p.category.includes('Scanner') ? (
                              <ScanLine className="h-4 w-4" />
                            ) : (
                              <Smartphone className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground tracking-tight">{p.model}</div>
                            <div className="text-[10px] text-muted-foreground">{p.brand}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{p.category}</td>
                      <td className="py-3 px-3 text-center tabular-nums">
                        <b className="text-foreground">{p.available}</b>{' '}
                        <span className="text-[11px] text-muted-foreground">/ {p.total} เครื่อง</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {p.available > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            พร้อมใช้ ({p.available})
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            หมดชั่วคราว
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

        {/* Right: Top Sellers / Active Borrowers */}
        <div className="vz-card overflow-hidden">
          <div className="px-5 py-3.5 vz-divider flex items-center justify-between">
            <h5
              className="text-sm font-semibold text-foreground mb-0"
              style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
            >
              เจ้าหน้าที่เบิกยืมเดโมสูงสุด (Top Active Borrowers)
            </h5>
            <span className="text-xs text-muted-foreground">สถิติสะสม</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4">พนักงานขาย</th>
                  <th className="py-2.5 px-3">ลูกค้า / บริษัทหลัก</th>
                  <th className="py-2.5 px-3 text-center">กำลังยืม</th>
                  <th className="py-2.5 px-4 text-right">คะแนนส่งคืน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.topBorrowers.map((b, idx) => (
                  <tr key={b.name} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-8 w-8 rounded-full font-bold flex items-center justify-center text-xs flex-shrink-0"
                          style={{
                            backgroundColor: [VZ_SOFT.primary, VZ_SOFT.teal, VZ_SOFT.amber, VZ_SOFT.purple, VZ_SOFT.info][idx % 5],
                            color: [VZ.primary, VZ.teal, VZ.amber, VZ.purple, VZ.info][idx % 5],
                          }}
                        >
                          {b.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{b.name}</div>
                          <div className="text-[10px] text-muted-foreground">ยอดรวม {b.count} ใบยืม</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground truncate max-w-[150px]">
                      {b.company || 'บริษัทลูกค้าทั่วไป'}
                    </td>
                    <td className="py-3 px-3 text-center tabular-nums font-semibold">
                      {b.active > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">{b.active} ใบ</span>
                      ) : (
                        <span className="text-muted-foreground">0 ใบ</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                        <span>5.0</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. ROW 4: ASSET STATUS DONUT (1 col) + RECENT ORDERS (2 cols) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left (1 col): Store Visits / Asset Status Distribution */}
        <div className="lg:col-span-1 vz-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 vz-divider mb-4">
              <h5
                className="text-sm font-semibold text-foreground mb-0"
                style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
              >
                สัดส่วนสถานะทรัพย์สิน
              </h5>
              <span className="text-xs text-muted-foreground">สัดส่วนในคลัง</span>
            </div>

            <div className="flex items-center justify-center my-4">
              <StatusDonut
                available={s.available}
                onLoan={s.onLoan}
                inRepair={s.inRepair}
                other={s.lost + s.disposed + s.inInspection}
                total={s.totalAssets}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VZ.teal }} />
                <span>พร้อมใช้งาน (Available)</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{s.available}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VZ.amber }} />
                <span>กำลังยืมอยู่ (On Loan)</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{s.onLoan}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VZ.rose }} />
                <span>ส่งซ่อม / ชำรุด (In Repair)</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{s.inRepair}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: VZ.slate }} />
                <span>ตรวจสภาพ / อื่นๆ (Inspection)</span>
              </span>
              <span className="font-semibold text-foreground tabular-nums">{s.inInspection + s.lost}</span>
            </div>
          </div>
        </div>

        {/* Right (2 cols): Velzon Recent Orders / Recent Loans */}
        <div className="lg:col-span-2 vz-card overflow-hidden">
          <div className="px-5 py-3.5 vz-divider flex items-center justify-between">
            <h5
              className="text-sm font-semibold text-foreground mb-0"
              style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}
            >
              รายการใบยืมล่าสุด (Recent Loan Requests)
            </h5>
            <button
              onClick={() => onNavigate('loans')}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
            >
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-4">เลขที่ใบยืม</th>
                  <th className="py-2.5 px-3">ลูกค้า / บริษัท</th>
                  <th className="py-2.5 px-3">รุ่นเครื่อง</th>
                  <th className="py-2.5 px-3">กำหนดคืน</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                  <th className="py-2.5 px-4 text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.recentLoans.map((l) => {
                  const days = daysUntil(l.expectedReturnDate)
                  const isOverdue = ['Delivered', 'Partially_Returned'].includes(l.status) && days < 0
                  return (
                    <tr
                      key={l.docNo}
                      onClick={() => onOpenLoan(l.docNo)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {l.docNo}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground">{l.customerName}</div>
                        {l.customerCompany && (
                          <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                            {l.customerCompany}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">
                        <span className="font-medium text-foreground">{l.firstModel}</span>
                        {l.itemCount > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            +{l.itemCount - 1} เครื่อง
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 tabular-nums">
                        <span className={isOverdue ? 'text-rose-600 font-bold' : 'text-foreground'}>
                          {formatThaiDate(l.expectedReturnDate)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <VelzonStatusBadge status={l.status} isOverdue={isOverdue} days={days} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenLoan(l.docNo)
                          }}
                          className="h-7 px-2 text-xs text-primary hover:bg-primary/10 gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          <span>ดูรายละเอียด</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==============================================================
// SUB-COMPONENTS (VELZON ACCURATE)
// ==============================================================

function VelzonKpiCard({
  label,
  value,
  suffix,
  trend,
  trendType,
  pulse,
  linkText,
  onClickLink,
  icon,
  colorHex,
  softBgHex,
}: {
  label: string
  value: number
  suffix?: string
  trend: string
  trendType: 'up' | 'down' | 'neutral'
  pulse?: boolean
  linkText: string
  onClickLink: () => void
  icon: React.ReactNode
  colorHex: string
  softBgHex: string
}) {
  return (
    <div className="vz-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
      {/* Top: Uppercase label + Trend Pill */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${
            trendType === 'up'
              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : trendType === 'down'
              ? 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300'
              : 'text-sky-700 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300'
          }`}
        >
          {trendType === 'up' && <ArrowUpRight className="h-3 w-3" />}
          {trendType === 'down' && <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </span>
      </div>

      {/* Middle: Big number + Icon on the right */}
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight tabular-nums flex items-baseline gap-1.5">
            <span>{value}</span>
            {suffix && (
              <span className="text-xs font-normal text-muted-foreground font-sans">
                {suffix}
              </span>
            )}
          </div>
        </div>
        <div
          className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${
            pulse ? 'animate-pulse' : ''
          }`}
          style={{ backgroundColor: softBgHex, color: colorHex }}
        >
          {icon}
        </div>
      </div>

      {/* Bottom: Underlined link */}
      <div className="pt-2 border-t border-border/50">
        <button
          onClick={onClickLink}
          className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 hover:underline flex items-center gap-1"
        >
          <span>{linkText}</span>
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function VelzonAreaChart({
  data,
  hoveredIdx,
  setHoveredIdx,
}: {
  data: Array<{ month: string; loans: number; returns: number; utilization: number }>
  hoveredIdx: number | null
  setHoveredIdx: (idx: number | null) => void
}) {
  const width = 600
  const height = 220
  const padX = 40
  const padY = 30
  const maxVal = 32

  const pointsLoans = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (width - 2 * padX)
    const y = height - padY - (d.loans / maxVal) * (height - 2 * padY)
    return { x, y, ...d }
  })

  const pointsReturns = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (width - 2 * padX)
    const y = height - padY - (d.returns / maxVal) * (height - 2 * padY)
    return { x, y, ...d }
  })

  const pathLoans = pointsLoans.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ''
  )
  const pathReturns = pointsReturns.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ''
  )

  const areaLoans = `${pathLoans} L ${pointsLoans[pointsLoans.length - 1].x} ${height - padY} L ${pointsLoans[0].x} ${height - padY} Z`
  const areaReturns = `${pathReturns} L ${pointsReturns[pointsReturns.length - 1].x} ${height - padY} L ${pointsReturns[0].x} ${height - padY} Z`

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 sm:h-56">
        <defs>
          <linearGradient id="vzAreaLoans" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VZ.primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={VZ.primary} stopOpacity="0.00" />
          </linearGradient>
          <linearGradient id="vzAreaReturns" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VZ.teal} stopOpacity="0.20" />
            <stop offset="100%" stopColor={VZ.teal} stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 10, 20, 30].map((v) => {
          const y = height - padY - (v / maxVal) * (height - 2 * padY)
          return (
            <g key={v}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                className="text-border/60"
                strokeDasharray="3 3"
              />
              <text
                x={padX - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] font-mono"
              >
                {v}
              </text>
            </g>
          )
        })}

        {/* Area paths */}
        <path d={areaLoans} fill="url(#vzAreaLoans)" />
        <path d={areaReturns} fill="url(#vzAreaReturns)" />

        {/* Line paths */}
        <path d={pathLoans} fill="none" stroke={VZ.primary} strokeWidth="2.5" />
        <path d={pathReturns} fill="none" stroke={VZ.teal} strokeWidth="2" strokeDasharray="4 4" />

        {/* Dots & Month Labels */}
        {pointsLoans.map((p, i) => (
          <g key={i}>
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] font-medium"
            >
              {p.month}
            </text>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredIdx === i ? 5 : 3.5}
              fill="#ffffff"
              stroke={VZ.primary}
              strokeWidth="2"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
            <circle
              cx={pointsReturns[i].x}
              cy={pointsReturns[i].y}
              r={hoveredIdx === i ? 5 : 3.5}
              fill="#ffffff"
              stroke={VZ.teal}
              strokeWidth="2"
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          </g>
        ))}
      </svg>

      {/* Floating Tooltip */}
      {hoveredIdx !== null && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 bg-card/95 backdrop-blur-sm border border-border shadow-lg p-2.5 rounded-lg text-xs pointer-events-none z-10 flex items-center gap-4 animate-fade-in"
        >
          <div className="font-bold text-foreground">{data[hoveredIdx].month}</div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 font-semibold" style={{ color: VZ.primary }}>
              ยืม: {data[hoveredIdx].loans}
            </span>
            <span className="flex items-center gap-1 font-semibold" style={{ color: VZ.teal }}>
              คืน: {data[hoveredIdx].returns}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusDonut({
  available,
  onLoan,
  inRepair,
  other,
  total,
}: {
  available: number
  onLoan: number
  inRepair: number
  other: number
  total: number
}) {
  const size = 160
  const strokeWidth = 20
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  const safeTotal = total > 0 ? total : 1
  const pctAvail = (available / safeTotal) * circumference
  const pctLoan = (onLoan / safeTotal) * circumference
  const pctRepair = (inRepair / safeTotal) * circumference
  const pctOther = (other / safeTotal) * circumference

  const offsetAvail = 0
  const offsetLoan = -pctAvail
  const offsetRepair = -(pctAvail + pctLoan)
  const offsetOther = -(pctAvail + pctLoan + pctRepair)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={VZ.teal}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pctAvail} ${circumference}`}
          strokeDashoffset={offsetAvail}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={VZ.amber}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pctLoan} ${circumference}`}
          strokeDashoffset={offsetLoan}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={VZ.rose}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pctRepair} ${circumference}`}
          strokeDashoffset={offsetRepair}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke={VZ.slate}
          strokeWidth={strokeWidth}
          strokeDasharray={`${pctOther} ${circumference}`}
          strokeDashoffset={offsetOther}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold font-mono text-foreground leading-none">
          {total}
        </span>
        <span className="text-[10px] text-muted-foreground mt-1">เครื่อง</span>
      </div>
    </div>
  )
}

function VelzonStatusBadge({
  status,
  isOverdue,
  days,
}: {
  status: string
  isOverdue: boolean
  days: number
}) {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
        เกินกำหนด {Math.abs(days)}d
      </span>
    )
  }
  if (status === 'Delivered') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
        กำลังยืม
      </span>
    )
  }
  if (status === 'Dispatched') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
        รอส่งมอบ
      </span>
    )
  }
  if (status === 'Requested' || status === 'Dispatching') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
        รอจัดของ
      </span>
    )
  }
  if (status === 'Partially_Returned') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        คืนบางส่วน
      </span>
    )
  }
  if (status === 'Returned') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        คืนครบแล้ว
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
      {status}
    </span>
  )
}
