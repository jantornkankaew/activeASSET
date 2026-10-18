'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  AssetStatusBadge, SourceBadge, GradeBadge, EmptyState, LoadingState,
} from './shared'
import { RegisterAssetView, SuppliersView } from './AssetsManagementViews'
import {
  Search, Package, ArrowLeft, Plus, Building2, Settings2, ChevronRight,
  Smartphone, Printer, ScanLine, Tablet, Boxes, History, Wrench,
  CheckCircle2, AlertTriangle, Clock, TrendingUp, FileText, Camera,
  Star, Shield, MapPin, Calendar, Phone, User, DollarSign, CreditCard,
  Truck, Package2, Cpu, HardDrive, Heart, Share2, MoreHorizontal,
  ShoppingCart,
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

// ===== Level 3: Asset Detail (Velzon product-details style — faithful reproduction) =====
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

  // Condition grade → star count (A=5, B=4, C=3, D=2, E=1)
  const gradeToStars: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
  const stars = asset.conditionGrade ? (gradeToStars[asset.conditionGrade] || 4) : 4

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            รายละเอียดทรัพย์สิน
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={onBack} className="text-muted-foreground hover:text-primary transition-smooth">ทรัพย์สิน</button>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-muted-foreground">{asset.brand} {asset.model}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-primary font-medium font-mono">{asset.tagId}</span>
        </div>
      </div>

      {/* ===== Velzon product-details single card ===== */}
      <div className="vz-card">
        <div className="p-4 lg:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT — Product image panel (1/3 on lg) */}
            <div className="lg:col-span-1">
              <div className="vz-product-image-panel">
                {/* Main image — bg-light p-2 rounded, simple */}
                <div className="bg-muted/40 p-3 rounded-md">
                  <div className="aspect-square flex items-center justify-center bg-card rounded-md border border-border/40">
                    {CATEGORY_ICONS[asset.category] || <Package className="h-24 w-24 text-muted-foreground/40" />}
                  </div>
                </div>

                {/* Thumbnail nav slider — 4 mini thumbnails */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`aspect-square flex items-center justify-center bg-card rounded-md border cursor-pointer transition-smooth ${i === 0 ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className="scale-75 text-muted-foreground/60">
                        {CATEGORY_ICONS[asset.category] || <Package className="h-6 w-6" />}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status + Grade badge row */}
                <div className="flex items-center gap-2 mt-3">
                  <AssetStatusBadge status={asset.status} />
                  {asset.conditionGrade && <GradeBadge grade={asset.conditionGrade} />}
                  <SourceBadge source={asset.source} />
                </div>
              </div>
            </div>

            {/* RIGHT — Product info (2/3 on lg) */}
            <div className="lg:col-span-2">
              {/* Title block + Edit button */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-semibold text-foreground mb-2" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                    {asset.brand} {asset.model}
                  </h4>
                  {/* Meta row — Velzon hstack with brand link | vr | seller | vr | published */}
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <span className="text-primary font-medium">{asset.brand}</span>
                    <span className="text-border" aria-hidden>|</span>
                    <span className="text-muted-foreground">แหล่ง : <span className="text-foreground font-medium">{SOURCE_LABELS[asset.source]?.label || asset.source}</span></span>
                    <span className="text-border" aria-hidden>|</span>
                    <span className="text-muted-foreground">ลงทะเบียน : <span className="text-foreground font-medium">{asset.purchaseDate ? formatThaiDate(asset.purchaseDate) : '-'}</span></span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={onBack}
                    title="กลับ"
                    className="vz-icon-soft h-8 w-8 bg-muted/40 hover:bg-muted transition-smooth border border-border rounded text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Stars + review count */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i <= stars ? 'fill-current' : ''}`}
                      style={{ color: i <= stars ? '#f7b84b' : 'rgba(116,120,141,0.3)' }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  ( {stats.totalLoans} ครั้งยืม )
                </span>
              </div>

              {/* 4 Stat boxes — Velzon DASHED BORDER signature */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                <VelzonDashedStat
                  label="ยืมทั้งหมด"
                  value={stats.totalLoans}
                  icon={<History className="h-5 w-5" />}
                  color="#405189"
                />
                <VelzonDashedStat
                  label="คืนแล้ว"
                  value={stats.completedLoans}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  color="#0ab39c"
                />
                <VelzonDashedStat
                  label="เสียหาย"
                  value={stats.damagedCount}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  color="#f06548"
                />
                <VelzonDashedStat
                  label="ส่งซ่อม"
                  value={stats.repairCount}
                  icon={<Wrench className="h-5 w-5" />}
                  color="#a071f0"
                />
              </div>

              {/* Description section */}
              <div className="mt-4">
                <h5 className="text-sm font-semibold text-foreground mb-2">รายละเอียด :</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {asset.brand} {asset.model} — หมวด {CATEGORY_LABELS[asset.category] || asset.category} · สถานะ {ASSET_STATUS_LABELS[asset.status]?.label || asset.status} · Serial {asset.serialNo} · {asset.defaultAccessories.length} อุปกรณ์เสริมในชุด
                </p>
              </div>

              {/* Features + Services (Velzon 2-col) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {/* Features */}
                <div>
                  <h5 className="text-sm font-semibold text-foreground mb-2">อุปกรณ์เสริม ({asset.defaultAccessories.length}) :</h5>
                  {asset.defaultAccessories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ไม่มีอุปกรณ์เสริม</p>
                  ) : (
                    <ul className="list-none space-y-1">
                      {asset.defaultAccessories.slice(0, 6).map((a, i) => (
                        <li key={i} className="text-xs text-foreground py-0.5 flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                          {a}
                        </li>
                      ))}
                      {asset.defaultAccessories.length > 6 && (
                        <li className="text-[10px] text-muted-foreground pl-2.5">+{asset.defaultAccessories.length - 6} รายการ</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Services */}
                <div>
                  <h5 className="text-sm font-semibold text-foreground mb-2">บริการ :</h5>
                  <ul className="list-none space-y-1">
                    <li className="text-xs text-foreground py-0.5 flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                      {asset.warrantyExpireDate ? `รับประกันถึง ${formatThaiDate(asset.warrantyExpireDate)}` : 'ไม่มีรับประกัน'}
                    </li>
                    {asset.location && (
                      <li className="text-xs text-foreground py-0.5 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                        ตั้งอยู่ {asset.location.name} ({asset.location.zone})
                      </li>
                    )}
                    {asset.depositPrice && (
                      <li className="text-xs text-foreground py-0.5 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                        มัดจำ ฿{asset.depositPrice.toLocaleString()}
                      </li>
                    )}
                    {asset.maxLoanCount && (
                      <li className="text-xs text-foreground py-0.5 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                        จำกัดยืม {asset.maxLoanCount} ครั้ง (ใช้แล้ว {asset.loanCount})
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Action buttons — Velzon style */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold text-white shadow-sm transition-smooth hover:shadow-md"
                  style={{ background: 'linear-gradient(135deg, #405189 0%, #2c3a5e 100%)' }}
                  onClick={onBack}
                >
                  <ShoppingCart className="h-3.5 w-3.5" /> ขอยืม
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium bg-muted/50 text-foreground border border-border hover:bg-muted transition-smooth"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> กลับ
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  {['text-primary', 'text-warning', 'text-danger', 'text-info'].map((c, i) => {
                    const Icon = [Star, Heart, Share2, MoreHorizontal][i]
                    const color = ['#405189', '#f7b84b', '#f06548', '#50b1d0'][i]
                    return (
                      <button
                        key={i}
                        className="vz-icon-soft h-8 w-8 border border-border rounded-full hover:bg-muted transition-smooth"
                        title={i === 0 ? 'บุคมาร์ก' : i === 1 ? 'ถูกใจ' : i === 2 ? 'แชร์' : 'เพิ่มเติม'}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color }} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ===== Product Description section (mt-5) ===== */}
          <div className="mt-6 pt-5 border-t border-border">
            <h5 className="text-sm font-semibold text-foreground mb-3">ข้อมูลเพิ่มเติม :</h5>

            <Tabs defaultValue="spec" className="w-full">
              {/* Velzon nav-tabs-custom style */}
              <TabsList className="vz-tabs-custom bg-transparent p-0 h-auto">
                <TabsTrigger value="spec" className="vz-tabs-custom-trigger">
                  Specification
                </TabsTrigger>
                <TabsTrigger value="detail" className="vz-tabs-custom-trigger">
                  Details
                </TabsTrigger>
                <TabsTrigger value="reviews" className="vz-tabs-custom-trigger">
                  Ratings &amp; Reviews
                </TabsTrigger>
              </TabsList>

              {/* Tab content — border border-top-0 p-4 */}
              <TabsContent value="spec" className="vz-tab-content mt-0">
                <div className="overflow-x-auto">
                  <table className="vz-table">
                    <tbody>
                      <tr>
                        <th scope="row">หมวดหมู่</th>
                        <td>{CATEGORY_LABELS[asset.category] || asset.category}</td>
                      </tr>
                      <tr>
                        <th scope="row">ยี่ห้อ</th>
                        <td>{asset.brand}</td>
                      </tr>
                      <tr>
                        <th scope="row">รุ่น</th>
                        <td>{asset.model}</td>
                      </tr>
                      <tr>
                        <th scope="row">Tag ID</th>
                        <td className="font-mono">{asset.tagId}</td>
                      </tr>
                      <tr>
                        <th scope="row">Serial Number</th>
                        <td className="font-mono">{asset.serialNo}</td>
                      </tr>
                      <tr>
                        <th scope="row">แหล่งที่มา</th>
                        <td>{SOURCE_LABELS[asset.source]?.label || asset.source}</td>
                      </tr>
                      <tr>
                        <th scope="row">ที่ตั้ง</th>
                        <td>{asset.location ? `${asset.location.name} (${asset.location.zone})` : 'ไม่ระบุ'}</td>
                      </tr>
                      <tr>
                        <th scope="row">วันที่ซื้อ</th>
                        <td>{asset.purchaseDate ? formatThaiDate(asset.purchaseDate) : '-'}</td>
                      </tr>
                      <tr>
                        <th scope="row">รับประกันถึง</th>
                        <td>{asset.warrantyExpireDate ? formatThaiDate(asset.warrantyExpireDate) : '-'}</td>
                      </tr>
                      {asset.depositPrice && (
                        <tr>
                          <th scope="row">มัดจำ</th>
                          <td>฿{asset.depositPrice.toLocaleString()}</td>
                        </tr>
                      )}
                      {asset.source === 'Supplier' && asset.supplierName && (
                        <>
                          <tr>
                            <th scope="row">Supplier</th>
                            <td>{asset.supplierName}</td>
                          </tr>
                          {asset.supplierContact && (
                            <tr>
                              <th scope="row">ผู้ติดต่อ</th>
                              <td>{asset.supplierContact}</td>
                            </tr>
                          )}
                          {asset.supplierPhone && (
                            <tr>
                              <th scope="row">เบอร์โทร</th>
                              <td>{asset.supplierPhone}</td>
                            </tr>
                          )}
                          {asset.supplierLoanDue && (
                            <tr>
                              <th scope="row">กำหนดคืน Supplier</th>
                              <td>{formatThaiDate(asset.supplierLoanDue)}</td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="detail" className="vz-tab-content mt-0">
                <div>
                  <h6 className="text-sm font-semibold text-foreground mb-2">
                    {asset.brand} {asset.model}
                  </h6>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    ทรัพย์สินนี้เป็น {CATEGORY_LABELS[asset.category] || asset.category} ของ {asset.brand} รุ่น {asset.model} ที่ใช้สำหรับการยืมเดโมให้ลูกค้าได้ทดลองใช้งาน ติดตามประวัติการยืม-คืน สภาพ และความเสียหายจากแทป Ratings & Reviews ด้านล่าง
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                      สถานะปัจจุบัน: <b className="text-foreground">{ASSET_STATUS_LABELS[asset.status]?.label || asset.status}</b>
                    </p>
                    <p className="text-xs text-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                      เกรดสภาพ: <b className="text-foreground">{asset.conditionGrade || 'ยังไม่ประเมิน'}</b>
                    </p>
                    <p className="text-xs text-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                      จำนวนครั้งยืม: <b className="text-foreground">{stats.totalLoans}</b> ครั้ง (คืนแล้ว {stats.completedLoans})
                    </p>
                    <p className="text-xs text-foreground flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-muted-foreground inline-block" />
                      อุปกรณ์เสริมในชุด: <b className="text-foreground">{asset.defaultAccessories.length}</b> รายการ
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Ratings & Reviews tab — adapted to loan history */}
              <TabsContent value="reviews" className="vz-tab-content mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* LEFT — Summary card (1/3 on lg) */}
                  <div className="lg:col-span-1">
                    <div className="vz-services-box">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i <= stars ? 'fill-current' : ''}`}
                              style={{ color: i <= stars ? '#f7b84b' : 'rgba(116,120,141,0.3)' }}
                            />
                          ))}
                        </div>
                        <h6 className="text-xs font-semibold text-foreground mb-0">{stars}.0 out of 5</h6>
                      </div>
                    </div>
                    <div className="text-center mt-2 text-xs text-muted-foreground">
                      รวม <span className="font-medium text-foreground">{history.length}</span> รายการ
                    </div>

                    {/* Status breakdown — progress bars (Velzon 5★ breakdown style) */}
                    <div className="mt-3 space-y-2">
                      <VelzonBreakdownRow
                        label="คืนแล้ว"
                        count={stats.completedLoans}
                        total={Math.max(stats.totalLoans, 1)}
                        color="#0ab39c"
                      />
                      <VelzonBreakdownRow
                        label="กำลังยืม"
                        count={history.filter((h) => h.lineStatus !== 'Returned').length}
                        total={Math.max(stats.totalLoans, 1)}
                        color="#f7b84b"
                      />
                      <VelzonBreakdownRow
                        label="เสียหาย"
                        count={stats.damagedCount}
                        total={Math.max(stats.totalLoans, 1)}
                        color="#f06548"
                      />
                      <VelzonBreakdownRow
                        label="ส่งซ่อม"
                        count={stats.repairCount}
                        total={Math.max(stats.totalLoans, 1)}
                        color="#a071f0"
                      />
                    </div>
                  </div>

                  {/* RIGHT — Review list (2/3 on lg) */}
                  <div className="lg:col-span-2">
                    {history.length === 0 ? (
                      <div className="text-center py-8">
                        <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                        <div className="text-sm font-medium text-foreground">ยังไม่มีประวัติการยืม</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">เครื่องนี้ยังไม่เคยถูกยืม</div>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {history.map((h, i) => {
                          const isReturned = h.lineStatus === 'Returned'
                          const color = isReturned ? '#0ab39c' : '#f7b84b'
                          return (
                            <div key={i} className="border border-border rounded-md p-3">
                              {/* Top row — avatar + name + status */}
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="vz-avatar h-8 w-8 text-xs"
                                  style={{ backgroundColor: `${color}11`, color }}
                                >
                                  {h.customerName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-foreground truncate">
                                    {h.customerName} {h.customerCompany ? <span className="text-muted-foreground">— {h.customerCompany}</span> : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {isReturned ? (
                                      <span className="vz-pill vz-pill-success">คืนแล้ว</span>
                                    ) : (
                                      <span className="vz-pill vz-pill-warning">กำลังยืม</span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{h.loanDocNo}</span>
                                  </div>
                                </div>
                                {/* Star rating for this loan */}
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => {
                                    const gradeStars: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
                                    const loanStars = h.conditionGrade ? (gradeStars[h.conditionGrade] || 4) : 4
                                    return (
                                      <Star
                                        key={s}
                                        className={`h-3 w-3 ${s <= loanStars ? 'fill-current' : ''}`}
                                        style={{ color: s <= loanStars ? '#f7b84b' : 'rgba(116,120,141,0.3)' }}
                                      />
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Bottom row — date */}
                              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                                <span>ยืม {h.dispatchedAt ? formatThaiDate(h.dispatchedAt) : '-'}</span>
                                <span aria-hidden>•</span>
                                <span>กำหนดคืน {formatThaiDate(h.expectedReturnDate)}</span>
                                {h.returnedAt && (
                                  <>
                                    <span aria-hidden>•</span>
                                    <span style={{ color: '#0ab39c' }}>คืน {formatThaiDate(h.returnedAt)}</span>
                                  </>
                                )}
                              </div>

                              {h.damageDescription && (
                                <div className="text-xs mt-2 p-2 rounded" style={{ backgroundColor: 'rgba(240,101,72,0.06)', color: '#f06548' }}>
                                  ⚠ {h.damageDescription}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Velzon DASHED stat box — Velzon signature =====
function VelzonDashedStat({
  label, value, icon, color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="vz-dashed-box">
      <div className="flex items-center gap-2">
        {/* avatar-sm with avatar-title rounded bg-transparent text-success fs-24 */}
        <div className="vz-icon-soft h-9 w-9 bg-transparent" style={{ color }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground mb-0.5">{label} :</p>
          <h5 className="text-sm font-semibold text-foreground mb-0 tabular-nums">{value}</h5>
        </div>
      </div>
    </div>
  )
}

// ===== Velzon breakdown row — for the rating breakdown progress bars =====
function VelzonBreakdownRow({
  label, count, total, color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="w-16">
        <h6 className="text-xs font-medium text-foreground mb-0">{label}</h6>
      </div>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <div className="w-10 text-right">
        <h6 className="text-xs font-medium text-muted-foreground mb-0 tabular-nums">{count}</h6>
      </div>
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
