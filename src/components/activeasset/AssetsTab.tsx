'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  AssetStatusBadge, SourceBadge, GradeBadge, EmptyState, LoadingState,
} from './shared'
import { RegisterAssetView, SuppliersView } from './AssetsManagementViews'
import {
  Search, Package, ArrowLeft, Plus, Building2, Settings2, ChevronRight,
  Smartphone, Printer, ScanLine, Tablet, Boxes, History, Wrench,
  CheckCircle2, AlertTriangle, Clock, TrendingUp, FileText, Camera,
} from 'lucide-react'
import {
  ASSET_STATUS_LABELS, CATEGORY_LABELS, SOURCE_LABELS,
  formatThaiDate, formatThaiDateTime, daysUntil,
} from '@/lib/activeasset-constants'

// ===== Icons by category =====
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Mobile Computer': <Smartphone className="h-6 w-6" />,
  'Barcode Scanner': <ScanLine className="h-6 w-6" />,
  'Barcode Printer': <Printer className="h-6 w-6" />,
  'RFID Reader': <ScanLine className="h-6 w-6" />,
  'Tablet': <Tablet className="h-6 w-6" />,
}

// ===== Types =====
interface CatalogSummary {
  id: string
  model: string
  brand: string
  category: string
  defaultSpecs: string | null
  defaultAccessories: string[]
  total: number
  available: number
  onLoan: number
  inRepair: number
  other: number
  availabilityLevel: 'green' | 'yellow' | 'red'
}

interface AssetUnit {
  tagId: string
  serialNo: string
  model: string
  brand: string
  category: string
  source: string
  supplierName: string | null
  supplierLoanDue: string | null
  depositPrice: number | null
  maxLoanCount: number | null
  loanCount: number
  status: string
  conditionGrade: string | null
  location: { name: string; zone: string } | null
  defaultAccessories: string[]
}

interface AssetHistory {
  loanDocNo: string
  loanStatus: string
  customerName: string
  customerCompany: string | null
  salesRepName: string
  purpose: string
  source: string
  dispatchedAt: string | null
  expectedReturnDate: string
  deliveredAt: string | null
  returnedAt: string | null
  lineStatus: string
  conditionGrade: string | null
  isDamaged: boolean
  damageDescription: string | null
  sendToRepair: boolean
  inspectorName: string | null
  returnNotes: string | null
}

interface AssetDetail {
  asset: {
    tagId: string
    serialNo: string
    model: string
    brand: string
    category: string
    source: string
    supplierName: string | null
    supplierPhone: string | null
    supplierContact: string | null
    supplierLoanStart: string | null
    supplierLoanDue: string | null
    depositPrice: number | null
    maxLoanCount: number | null
    loanCount: number
    status: string
    conditionGrade: string | null
    location: { name: string; zone: string } | null
    purchaseDate: string | null
    warrantyExpireDate: string | null
    registeredAccessories: string[]
    defaultAccessories: string[]
  }
  history: AssetHistory[]
  stats: {
    totalLoans: number
    completedLoans: number
    activeLoan: AssetHistory | null
    damagedCount: number
    repairCount: number
  }
}

type View = 'catalog' | 'units' | 'detail' | 'register' | 'suppliers'

interface AssetsTabProps {
  onBorrow?: () => void
}

// ===== Main Component =====
export function AssetsTab({ onBorrow }: AssetsTabProps) {
  const { toast } = useToast()
  const [view, setView] = useState<View>('catalog')
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Drill-down state
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogSummary | null>(null)
  const [units, setUnits] = useState<AssetUnit[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [unitSearch, setUnitSearch] = useState('')

  // Detail state
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ===== Load catalogs (Level 1) =====
  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (brandFilter !== 'all') params.set('brand', brandFilter)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    const res = await fetch(`/api/catalog?${params.toString()}`)
    const data = await res.json()
    setCatalogs(data.catalogs || [])
    setLoading(false)
  }, [search, brandFilter, categoryFilter])

  useEffect(() => {
    const t = setTimeout(loadCatalogs, 250)
    return () => clearTimeout(t)
  }, [loadCatalogs])

  // ===== Load units (Level 2 — drill-down by model) =====
  const loadUnits = async (catalog: CatalogSummary) => {
    setSelectedCatalog(catalog)
    setView('units')
    setUnitSearch('')
    setUnitsLoading(true)
    const res = await fetch(`/api/assets?catalogModel=${encodeURIComponent(catalog.model)}`)
    const data = await res.json()
    setUnits(data.assets || [])
    setUnitsLoading(false)
  }

  // ===== Load detail (Level 3 — single asset history) =====
  const loadDetail = async (tagId: string) => {
    setView('detail')
    setDetailLoading(true)
    setDetail(null)
    const res = await fetch(`/api/assets/${tagId}/history`)
    const data = await res.json()
    setDetail(data)
    setDetailLoading(false)
  }

  // ===== Render =====
  if (view === 'register') {
    return <RegisterAssetView onDone={() => { setView('catalog'); loadCatalogs() }} onBack={() => setView('catalog')} />
  }
  if (view === 'suppliers') {
    return <SuppliersView onBack={() => setView('catalog')} />
  }
  if (view === 'detail') {
    return (
      <AssetDetailView
        detail={detail}
        loading={detailLoading}
        onBack={() => selectedCatalog ? setView('units') : setView('catalog')}
      />
    )
  }
  if (view === 'units' && selectedCatalog) {
    return (
      <UnitsView
        catalog={selectedCatalog}
        units={units}
        loading={unitsLoading}
        search={unitSearch}
        onSearch={setUnitSearch}
        onBack={() => setView('catalog')}
        onSelectUnit={loadDetail}
      />
    )
  }

  // ===== Level 1: Catalog Cards =====
  const brands = Array.from(new Set(catalogs.map((c) => c.brand)))
  const categories = Array.from(new Set(catalogs.map((c) => c.category)))

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">ทรัพย์สิน</h2>
          <p className="text-xs text-muted-foreground mt-0.5">เลือกรุ่นเพื่อดูเครื่องจริงและประวัติการยืม</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setView('suppliers')}>
            <Building2 className="h-4 w-4 mr-1.5" /> Suppliers
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setView('register')}>
            <Plus className="h-4 w-4 mr-1.5" /> ลงทะเบียน
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหารุ่นหรือยี่ห้อ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-card/50 border-border/50"
          />
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full md:w-36 rounded-xl"><SelectValue placeholder="ยี่ห้อ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ยี่ห้อทั้งหมด</SelectItem>
            {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-40 rounded-xl"><SelectValue placeholder="หมวด" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">หมวดทั้งหมด</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Catalog grid — premium cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        {loading && <div className="col-span-full"><LoadingState /></div>}
        {!loading && catalogs.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={<Package className="h-12 w-12" />} message="ไม่พบรุ่นสินค้า" />
          </div>
        )}
        {catalogs.map((c) => {
          const availColor = c.availabilityLevel === 'green' ? 'text-emerald-600 dark:text-emerald-400'
            : c.availabilityLevel === 'yellow' ? 'text-amber-600 dark:text-amber-400'
            : 'text-rose-600 dark:text-rose-400'
          const dotColor = c.availabilityLevel === 'green' ? 'bg-emerald-500'
            : c.availabilityLevel === 'yellow' ? 'bg-amber-500'
            : 'bg-rose-500'
          return (
            <button
              key={c.id}
              className="group text-left p-5 rounded-2xl bg-card border border-border/50 shadow-premium hover-lift transition-smooth"
              onClick={() => loadUnits(c)}
            >
              {/* Header — icon + brand */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-accent/10 transition-smooth">
                    <span className="text-muted-foreground group-hover:text-accent transition-smooth">
                      {CATEGORY_ICONS[c.category] || <Package className="h-6 w-6" />}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-base">{c.brand} {c.model}</div>
                    <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[c.category] || c.category}</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-smooth" />
              </div>

              {/* Stock summary — visual */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
                  <span className={`text-2xl font-bold tabular-nums ${availColor}`}>{c.available}</span>
                  <span className="text-xs text-muted-foreground">/ {c.total} ว่าง</span>
                </div>
              </div>

              {/* Mini status bars */}
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted/50">
                {c.available > 0 && <div className="bg-emerald-500" style={{ width: `${(c.available / c.total) * 100}%` }} />}
                {c.onLoan > 0 && <div className="bg-amber-500" style={{ width: `${(c.onLoan / c.total) * 100}%` }} />}
                {c.inRepair > 0 && <div className="bg-purple-500" style={{ width: `${(c.inRepair / c.total) * 100}%` }} />}
                {c.other > 0 && <div className="bg-slate-400" style={{ width: `${(c.other / c.total) * 100}%` }} />}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                {c.onLoan > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />ยืม {c.onLoan}</span>}
                {c.inRepair > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-purple-500" />ซ่อม {c.inRepair}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ===== Level 2: Units of a model =====
function UnitsView({
  catalog, units, loading, search, onSearch, onBack, onSelectUnit,
}: {
  catalog: CatalogSummary
  units: AssetUnit[]
  loading: boolean
  search: string
  onSearch: (v: string) => void
  onBack: () => void
  onSelectUnit: (tagId: string) => void
}) {
  const filtered = search
    ? units.filter(u =>
        u.tagId.toLowerCase().includes(search.toLowerCase()) ||
        u.serialNo.toLowerCase().includes(search.toLowerCase())
      )
    : units

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> ทรัพย์สิน
        </button>
        <span className="text-border">/</span>
        <span className="font-medium">{catalog.brand} {catalog.model}</span>
      </div>

      {/* Model header card */}
      <div className="p-5 rounded-2xl gradient-hero border border-border/50 shadow-premium">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-card/80 flex items-center justify-center shadow-lift">
            {CATEGORY_ICONS[catalog.category] || <Package className="h-7 w-7" />}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold tracking-tight">{catalog.brand} {catalog.model}</h2>
            <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[catalog.category] || catalog.category} · {catalog.defaultSpecs}</p>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{catalog.available}</div>
              <div className="text-[10px] text-muted-foreground">พร้อมใช้</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{catalog.onLoan}</div>
              <div className="text-[10px] text-muted-foreground">ยืมอยู่</div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{catalog.total}</div>
              <div className="text-[10px] text-muted-foreground">ทั้งหมด</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search + List */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหา Tag ID หรือ S/N..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9 rounded-xl bg-card/50 border-border/50"
        />
      </div>

      {/* Units — premium card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-children">
        {loading && <div className="col-span-full"><LoadingState /></div>}
        {!loading && filtered.length === 0 && <div className="col-span-full"><EmptyState message="ไม่พบเครื่อง" /></div>}
        {!loading && filtered.map((u) => {
          const overLoan = u.maxLoanCount && u.loanCount >= u.maxLoanCount
          const statusConfig = {
            Available: { icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />, bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'พร้อมใช้', labelColor: 'text-emerald-600 dark:text-emerald-400' },
            On_Loan: { icon: <Clock className="h-6 w-6 text-amber-500" />, bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'กำลังยืม', labelColor: 'text-amber-600 dark:text-amber-400' },
            In_Repair: { icon: <Wrench className="h-6 w-6 text-purple-500" />, bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'ส่งซ่อม', labelColor: 'text-purple-600 dark:text-purple-400' },
            In_Inspection: { icon: <Clock className="h-6 w-6 text-blue-500" />, bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'ตรวจสภาพ', labelColor: 'text-blue-600 dark:text-blue-400' },
            Lost: { icon: <AlertTriangle className="h-6 w-6 text-rose-500" />, bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'สูญหาย', labelColor: 'text-rose-600 dark:text-rose-400' },
            Disposed: { icon: <Package className="h-6 w-6 text-slate-400" />, bg: 'bg-muted/50', border: 'border-border/50', label: 'ตัดจำหน่าย', labelColor: 'text-slate-500' },
            Returned_To_Supplier: { icon: <Package className="h-6 w-6 text-slate-400" />, bg: 'bg-muted/50', border: 'border-border/50', label: 'คืน Supplier', labelColor: 'text-slate-500' },
          }
          const sc = statusConfig[u.status as keyof typeof statusConfig] || statusConfig.Disposed
          return (
            <button
              key={u.tagId}
              className={`group text-left p-4 rounded-2xl bg-card border ${sc.border} shadow-premium hover-lift transition-smooth`}
              onClick={() => onSelectUnit(u.tagId)}
            >
              {/* Top row — icon + status label + chevron */}
              <div className="flex items-start justify-between mb-3">
                <div className={`h-11 w-11 rounded-xl ${sc.bg} flex items-center justify-center group-hover:scale-110 transition-smooth`}>
                  {sc.icon}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${sc.labelColor}`}>{sc.label}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-smooth" />
                </div>
              </div>

              {/* Tag ID — prominent */}
              <div className="font-mono font-bold text-base tracking-tight mb-0.5">{u.tagId}</div>

              {/* S/N — subtle mono */}
              <div className="text-xs text-muted-foreground font-mono mb-2.5">{u.serialNo}</div>

              {/* Badges row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {u.conditionGrade && <GradeBadge grade={u.conditionGrade} />}
                {u.source !== 'Demo_Stock' && <SourceBadge source={u.source} />}
                {overLoan && (
                  <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                    <AlertTriangle className="h-3 w-3 mr-0.5" />{u.loanCount}/{u.maxLoanCount}
                  </Badge>
                )}
                {u.maxLoanCount && !overLoan && u.source === 'Supplier' && (
                  <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                    ยืม {u.loanCount}/{u.maxLoanCount}
                  </Badge>
                )}
              </div>

              {/* Footer — location + supplier */}
              {(u.location || (u.source === 'Supplier' && u.supplierName)) && (
                <div className="mt-2.5 pt-2.5 border-t border-border/30 text-[10px] text-muted-foreground space-y-0.5">
                  {u.location && (
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                      <span>{u.location.name}</span>
                    </div>
                  )}
                  {u.source === 'Supplier' && u.supplierName && (
                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <span className="h-1 w-1 rounded-full bg-purple-500" />
                      <span>{u.supplierName}</span>
                    </div>
                  )}
                  {u.supplierLoanDue && (
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <span className="h-1 w-1 rounded-full bg-amber-500" />
                      <span>คืน {formatThaiDate(u.supplierLoanDue)}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ===== Level 3: Asset Detail + History =====
function AssetDetailView({
  detail, loading, onBack,
}: {
  detail: AssetDetail | null
  loading: boolean
  onBack: () => void
}) {
  if (loading) return <div className="py-8"><LoadingState /></div>
  if (!detail) return <EmptyState message="ไม่พบข้อมูล" />

  const { asset, history, stats } = detail

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-smooth flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> กลับ
        </button>
      </div>

      {/* Asset header card */}
      <div className="p-5 rounded-2xl gradient-hero border border-border/50 shadow-premium">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-card/80 flex items-center justify-center shadow-lift flex-shrink-0">
            {CATEGORY_ICONS[asset.category] || <Package className="h-8 w-8" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight">{asset.brand} {asset.model}</h2>
              <AssetStatusBadge status={asset.status} />
              {asset.conditionGrade && <GradeBadge grade={asset.conditionGrade} />}
              <SourceBadge source={asset.source} />
            </div>
            <div className="text-sm font-mono text-muted-foreground mt-1">
              {asset.tagId} · S/N: {asset.serialNo}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="p-2.5 rounded-xl bg-card/60">
            <div className="text-[10px] text-muted-foreground">ยืมทั้งหมด</div>
            <div className="text-lg font-bold tabular-nums">{stats.totalLoans}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-card/60">
            <div className="text-[10px] text-muted-foreground">คืนแล้ว</div>
            <div className="text-lg font-bold tabular-nums text-emerald-600">{stats.completedLoans}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-card/60">
            <div className="text-[10px] text-muted-foreground">เสียหาย</div>
            <div className={`text-lg font-bold tabular-nums ${stats.damagedCount > 0 ? 'text-rose-600' : ''}`}>{stats.damagedCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-card/60">
            <div className="text-[10px] text-muted-foreground">ส่งซ่อม</div>
            <div className={`text-lg font-bold tabular-nums ${stats.repairCount > 0 ? 'text-purple-600' : ''}`}>{stats.repairCount}</div>
          </div>
          {asset.maxLoanCount && (
            <div className="p-2.5 rounded-xl bg-card/60">
              <div className="text-[10px] text-muted-foreground">ยืมครั้งที่</div>
              <div className={`text-lg font-bold tabular-nums ${asset.loanCount >= asset.maxLoanCount ? 'text-rose-600' : 'text-amber-600'}`}>
                {asset.loanCount}/{asset.maxLoanCount}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Asset details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ข้อมูลทรัพย์สิน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <DetailRow label="ที่ตั้ง" value={asset.location ? `${asset.location.name} (${asset.location.zone})` : 'ไม่ระบุ'} />
            <DetailRow label="วันที่ซื้อ" value={asset.purchaseDate ? formatThaiDate(asset.purchaseDate) : '-'} />
            <DetailRow label="รับประกันถึง" value={asset.warrantyExpireDate ? formatThaiDate(asset.warrantyExpireDate) : '-'} />
            {asset.source === 'Supplier' && (
              <>
                <DetailRow label="Supplier" value={asset.supplierName || '-'} />
                {asset.supplierContact && <DetailRow label="ผู้ติดต่อ" value={asset.supplierContact} />}
                {asset.supplierPhone && <DetailRow label="โทร" value={asset.supplierPhone} />}
                <DetailRow label="กำหนดคืน Supplier" value={asset.supplierLoanDue ? formatThaiDate(asset.supplierLoanDue) : '-'} />
                {asset.depositPrice && <DetailRow label="มัดจำ" value={`฿${asset.depositPrice.toLocaleString()}`} />}
              </>
            )}
          </CardContent>
        </Card>

        {/* Accessories */}
        <Card className="shadow-premium">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">อุปกรณ์เสริม ({asset.defaultAccessories.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {asset.defaultAccessories.map((a) => (
                <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loan history timeline */}
      <Card className="shadow-premium">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4" /> ประวัติการยืม-คืน ({history.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {history.length === 0 && <EmptyState message="ยังไม่มีประวัติการยืม" />}
              {history.map((h, i) => (
                <div key={i} className="p-3 flex items-start gap-3">
                  {/* Timeline dot */}
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    h.lineStatus === 'Returned' ? 'bg-emerald-500/10' :
                    h.lineStatus === 'Out' ? 'bg-amber-500/10' : 'bg-muted/50'
                  }`}>
                    {h.lineStatus === 'Returned' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                     h.lineStatus === 'Out' ? <Clock className="h-4 w-4 text-amber-500" /> :
                     <Package className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{h.loanDocNo}</span>
                      <Badge variant="outline" className={`text-xs ${
                        h.lineStatus === 'Returned' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {h.lineStatus === 'Returned' ? 'คืนแล้ว' : 'กำลังยืม'}
                      </Badge>
                      {h.conditionGrade && <GradeBadge grade={h.conditionGrade} />}
                      {h.isDamaged && <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50">เสียหาย</Badge>}
                      {h.sendToRepair && <Badge variant="outline" className="text-xs text-purple-700 bg-purple-50">ส่งซ่อม</Badge>}
                    </div>
                    <div className="text-sm mt-0.5">{h.customerName} {h.customerCompany ? `— ${h.customerCompany}` : ''}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ยืม {h.dispatchedAt ? formatThaiDate(h.dispatchedAt) : '-'} · กำหนดคืน {formatThaiDate(h.expectedReturnDate)}
                      {h.returnedAt && ` · คืน ${formatThaiDate(h.returnedAt)}`}
                    </div>
                    {h.damageDescription && (
                      <div className="text-xs text-rose-600 mt-1 bg-rose-50 rounded p-1.5">
                        ⚠ {h.damageDescription}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}
