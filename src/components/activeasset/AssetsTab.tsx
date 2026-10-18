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
  Truck, Package2, Cpu, HardDrive,
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

// ===== Level 3: Asset Detail + History (Velzon product-details style) =====
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

  // Status color tokens
  const statusColor: Record<string, { fg: string; soft: string; label: string }> = {
    Available:             { fg: '#0ab39c', soft: 'rgba(10,179,156,0.10)', label: 'พร้อมใช้' },
    On_Loan:               { fg: '#f7b84b', soft: 'rgba(247,184,75,0.12)', label: 'กำลังยืม' },
    In_Repair:             { fg: '#a071f0', soft: 'rgba(160,113,240,0.10)', label: 'ส่งซ่อม' },
    In_Inspection:         { fg: '#405189', soft: 'rgba(64,81,137,0.10)', label: 'ตรวจสภาพ' },
    Lost:                  { fg: '#f06548', soft: 'rgba(240,101,72,0.10)', label: 'สูญหาย' },
    Disposed:              { fg: '#74788d', soft: 'rgba(116,120,141,0.12)', label: 'ตัดจำหน่าย' },
    Returned_To_Supplier:  { fg: '#74788d', soft: 'rgba(116,120,141,0.12)', label: 'คืน Supplier' },
  }
  const sc = statusColor[asset.status] || statusColor.Available

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon breadcrumb ===== */}
      <div className="flex items-center gap-1.5 text-xs">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-smooth">ทรัพย์สิน</button>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-muted-foreground">{asset.brand} {asset.model}</span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
        <span className="font-mono font-semibold text-foreground">{asset.tagId}</span>
      </div>

      {/* ===== Top section — Velzon product-details layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT — Asset "image" card (Velzon product image panel) */}
        <div className="lg:col-span-2">
          <div className="vz-card overflow-hidden">
            {/* Hero "image" panel — Velzon-style with gradient + brand watermark */}
            <div
              className="relative aspect-[4/3] flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${sc.soft}, rgba(255,255,255,0.5))` }}
            >
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />

              {/* Brand watermark (top-right, large) */}
              <div className="absolute top-4 right-4 text-3xl font-bold text-foreground/5 leading-none tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {asset.brand}
              </div>

              {/* Center — category icon */}
              <div
                className="vz-icon-soft h-24 w-24 relative z-10"
                style={{ backgroundColor: 'rgba(255,255,255,0.6)', boxShadow: `inset 0 0 0 1px ${sc.fg}22` }}
              >
                <span style={{ color: sc.fg }} className="scale-150">
                  {CATEGORY_ICONS[asset.category] || <Package className="h-12 w-12" />}
                </span>
              </div>

              {/* Status ribbon (top-left) */}
              <div
                className="absolute top-3 left-3 vz-pill text-[10px] font-semibold"
                style={{ backgroundColor: sc.soft, color: sc.fg }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.fg }} />
                {sc.label}
              </div>

              {/* Tag ID badge (bottom-left) */}
              <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm rounded px-2 py-1 border border-border/50 shadow-sm">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Tag ID</div>
                <div className="font-mono text-xs font-bold text-foreground">{asset.tagId}</div>
              </div>

              {/* Grade badge (bottom-right) */}
              {asset.conditionGrade && (
                <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur-sm rounded px-2 py-1 border border-border/50 shadow-sm">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">เกรด</div>
                  <div className="text-sm font-bold" style={{ color: sc.fg }}>{asset.conditionGrade}</div>
                </div>
              )}
            </div>

            {/* Mini meta strip below image */}
            <div className="px-4 py-3 vz-divider">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="vz-eyebrow">Serial No</div>
                  <div className="font-mono font-semibold text-foreground truncate">{asset.serialNo}</div>
                </div>
                <div>
                  <div className="vz-eyebrow">หมวดหมู่</div>
                  <div className="font-medium text-foreground truncate">{CATEGORY_LABELS[asset.category] || asset.category}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Product info (Velzon product info panel) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Title + brand + rating */}
          <div className="vz-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="vz-eyebrow" style={{ color: '#405189' }}>{asset.brand}</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="vz-eyebrow">{SOURCE_LABELS[asset.source]?.label || asset.source}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              {asset.model}
            </h1>

            {/* Star rating + review count */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i <= stars ? 'fill-current text-amber-400' : 'text-muted-foreground/40'}`}
                    style={{ color: i <= stars ? '#f7b84b' : undefined }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {asset.conditionGrade ? `เกรด ${asset.conditionGrade}` : 'ยังไม่ประเมิน'} · {stats.totalLoans} ครั้งยืม
              </span>
            </div>

            {/* Quick stats — Velzon 4-stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <VelzonMiniStat
                label="ยืมทั้งหมด"
                value={stats.totalLoans}
                icon={<History className="h-4 w-4" />}
                color="#405189"
              />
              <VelzonMiniStat
                label="คืนแล้ว"
                value={stats.completedLoans}
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="#0ab39c"
              />
              <VelzonMiniStat
                label="เสียหาย"
                value={stats.damagedCount}
                icon={<AlertTriangle className="h-4 w-4" />}
                color="#f06548"
                highlight={stats.damagedCount > 0}
              />
              <VelzonMiniStat
                label="ส่งซ่อม"
                value={stats.repairCount}
                icon={<Wrench className="h-4 w-4" />}
                color="#a071f0"
                highlight={stats.repairCount > 0}
              />
            </div>

            {/* Loan count limit indicator */}
            {asset.maxLoanCount && (
              <div className="mt-4 pt-3 vz-divider">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">สถานะการยืม</span>
                  <span className="font-semibold tabular-nums text-foreground">{asset.loanCount} / {asset.maxLoanCount} ครั้ง</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (asset.loanCount / asset.maxLoanCount) * 100)}%`,
                      background: asset.loanCount >= asset.maxLoanCount ? '#f06548' : asset.loanCount >= asset.maxLoanCount * 0.8 ? '#f7b84b' : '#0ab39c',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Features + Services (Velzon-style) */}
          <div className="vz-card p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Features — accessories */}
              <div>
                <div className="vz-eyebrow mb-2">อุปกรณ์เสริม ({asset.defaultAccessories.length})</div>
                {asset.defaultAccessories.length === 0 ? (
                  <div className="text-xs text-muted-foreground">ไม่มีอุปกรณ์เสริม</div>
                ) : (
                  <ul className="space-y-1.5">
                    {asset.defaultAccessories.slice(0, 6).map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#0ab39c' }} />
                        <span className="text-foreground">{a}</span>
                      </li>
                    ))}
                    {asset.defaultAccessories.length > 6 && (
                      <li className="text-[10px] text-muted-foreground pl-5">+{asset.defaultAccessories.length - 6} รายการ</li>
                    )}
                  </ul>
                )}
              </div>

              {/* Services */}
              <div>
                <div className="vz-eyebrow mb-2">บริการ</div>
                <ul className="space-y-1.5">
                  <li className="flex items-center gap-2 text-xs">
                    <Shield className="h-3.5 w-3.5 flex-shrink-0" style={{ color: asset.warrantyExpireDate ? '#0ab39c' : '#74788d' }} />
                    <span className="text-foreground">
                      {asset.warrantyExpireDate ? `รับประกันถึง ${formatThaiDate(asset.warrantyExpireDate)}` : 'ไม่มีรับประกัน'}
                    </span>
                  </li>
                  {asset.location && (
                    <li className="flex items-center gap-2 text-xs">
                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#405189' }} />
                      <span className="text-foreground">{asset.location.name} <span className="text-muted-foreground">({asset.location.zone})</span></span>
                    </li>
                  )}
                  {asset.purchaseDate && (
                    <li className="flex items-center gap-2 text-xs">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#405189' }} />
                      <span className="text-foreground">ซื้อ {formatThaiDate(asset.purchaseDate)}</span>
                    </li>
                  )}
                  {asset.depositPrice && (
                    <li className="flex items-center gap-2 text-xs">
                      <DollarSign className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#f7b84b' }} />
                      <span className="text-foreground">มัดจำ ฿{asset.depositPrice.toLocaleString()}</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" size="sm" onClick={onBack} className="text-xs">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> กลับ
            </Button>
            {asset.source === 'Supplier' && asset.supplierName && (
              <span className="vz-pill vz-pill-info inline-flex items-center gap-1">
                <Truck className="h-3 w-3" /> Supplier: {asset.supplierName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===== Tabbed section — Velzon-style tabs ===== */}
      <Tabs defaultValue="info" className="w-full">
        <div className="vz-card px-2 pt-2">
          <TabsList className="bg-transparent p-0 h-auto gap-1">
            <TabsTrigger
              value="info"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 data-[state=active]:shadow-sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> ข้อมูลทรัพย์สิน
            </TabsTrigger>
            <TabsTrigger
              value="accessories"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 data-[state=active]:shadow-sm"
            >
              <Package2 className="h-3.5 w-3.5 mr-1.5" /> อุปกรณ์เสริม ({asset.defaultAccessories.length})
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 data-[state=active]:shadow-sm"
            >
              <History className="h-3.5 w-3.5 mr-1.5" /> ประวัติยืม-คืน ({history.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1 — Spec table */}
        <TabsContent value="info" className="mt-3">
          <div className="vz-card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(64,81,137,0.10)' }}>
                <FileText className="h-4 w-4" style={{ color: '#405189' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">ข้อมูลทรัพย์สิน</div>
                <div className="text-[10px] text-muted-foreground">รายละเอียดและสเปค</div>
              </div>
            </div>

            {/* Spec table — Velzon 2-column table style */}
            <div className="px-4 py-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                <VelzonSpecRow icon={<MapPin className="h-3.5 w-3.5" />} label="ที่ตั้ง" value={asset.location ? `${asset.location.name} (${asset.location.zone})` : 'ไม่ระบุ'} />
                <VelzonSpecRow icon={<Calendar className="h-3.5 w-3.5" />} label="วันที่ซื้อ" value={asset.purchaseDate ? formatThaiDate(asset.purchaseDate) : '-'} />
                <VelzonSpecRow icon={<Shield className="h-3.5 w-3.5" />} label="รับประกันถึง" value={asset.warrantyExpireDate ? formatThaiDate(asset.warrantyExpireDate) : '-'} />
                <VelzonSpecRow icon={<Package className="h-3.5 w-3.5" />} label="แหล่ง" value={SOURCE_LABELS[asset.source]?.label || asset.source} />
                <VelzonSpecRow icon={<Cpu className="h-3.5 w-3.5" />} label="รหัส Tag" value={asset.tagId} mono />
                <VelzonSpecRow icon={<HardDrive className="h-3.5 w-3.5" />} label="Serial No" value={asset.serialNo} mono />
                {asset.source === 'Supplier' && (
                  <>
                    <VelzonSpecRow icon={<Building2 className="h-3.5 w-3.5" />} label="Supplier" value={asset.supplierName || '-'} />
                    {asset.supplierContact && <VelzonSpecRow icon={<User className="h-3.5 w-3.5" />} label="ผู้ติดต่อ" value={asset.supplierContact} />}
                    {asset.supplierPhone && <VelzonSpecRow icon={<Phone className="h-3.5 w-3.5" />} label="โทร" value={asset.supplierPhone} />}
                    <VelzonSpecRow icon={<Calendar className="h-3.5 w-3.5" />} label="กำหนดคืน Supplier" value={asset.supplierLoanDue ? formatThaiDate(asset.supplierLoanDue) : '-'} />
                    {asset.depositPrice && <VelzonSpecRow icon={<DollarSign className="h-3.5 w-3.5" />} label="มัดจำ" value={`฿${asset.depositPrice.toLocaleString()}`} />}
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2 — Accessories grid */}
        <TabsContent value="accessories" className="mt-3">
          <div className="vz-card overflow-hidden">
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(10,179,156,0.10)' }}>
                <Package2 className="h-4 w-4" style={{ color: '#0ab39c' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">อุปกรณ์เสริมในชุด</div>
                <div className="text-[10px] text-muted-foreground">{asset.defaultAccessories.length} รายการ</div>
              </div>
            </div>
            <div className="p-4">
              {asset.defaultAccessories.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Package2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                  <div className="font-medium">ไม่มีอุปกรณ์เสริม</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {asset.defaultAccessories.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 p-2.5 rounded-md border border-border/50 bg-card hover:bg-muted/30 transition-smooth"
                    >
                      <span className="vz-icon-soft h-7 w-7 flex-shrink-0" style={{ backgroundColor: 'rgba(10,179,156,0.10)' }}>
                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#0ab39c' }} />
                      </span>
                      <span className="text-xs font-medium text-foreground truncate">{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3 — Loan history timeline */}
        <TabsContent value="history" className="mt-3">
          <div className="vz-card overflow-hidden">
            <div className="px-4 py-3 vz-divider flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(247,184,75,0.12)' }}>
                  <History className="h-4 w-4" style={{ color: '#f7b84b' }} />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">ประวัติการยืม-คืน</div>
                  <div className="text-[10px] text-muted-foreground">{history.length} รายการ</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="vz-pill vz-pill-success">
                  {stats.completedLoans} คืนแล้ว
                </span>
                <span className="vz-pill vz-pill-warning">
                  {history.filter((h) => h.lineStatus !== 'Returned').length} กำลังยืม
                </span>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <div>
                {history.length === 0 && (
                  <div className="p-8 text-center">
                    <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                    <div className="text-sm font-medium text-foreground">ยังไม่มีประวัติการยืม</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">เครื่องนี้ยังไม่เคยถูกยืม</div>
                  </div>
                )}
                {history.map((h, i) => {
                  const isReturned = h.lineStatus === 'Returned'
                  const dotColor = isReturned ? '#0ab39c' : '#f7b84b'
                  const dotSoft = isReturned ? 'rgba(10,179,156,0.10)' : 'rgba(247,184,75,0.12)'
                  return (
                    <div
                      key={i}
                      className={`px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-smooth ${i < history.length - 1 ? 'vz-divider' : ''}`}
                    >
                      {/* Timeline dot avatar */}
                      <div
                        className="vz-avatar h-9 w-9 flex-shrink-0"
                        style={{ backgroundColor: dotSoft, color: dotColor, boxShadow: `inset 0 0 0 1px ${dotColor}33` }}
                      >
                        {isReturned ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm text-foreground">{h.loanDocNo}</span>
                          <span
                            className="vz-pill"
                            style={{ backgroundColor: dotSoft, color: dotColor }}
                          >
                            {isReturned ? 'คืนแล้ว' : 'กำลังยืม'}
                          </span>
                          {h.conditionGrade && <GradeBadge grade={h.conditionGrade} />}
                          {h.isDamaged && (
                            <span className="vz-pill vz-pill-danger">
                              <AlertTriangle className="h-2.5 w-2.5" /> เสียหาย
                            </span>
                          )}
                          {h.sendToRepair && (
                            <span className="vz-pill" style={{ backgroundColor: 'rgba(160,113,240,0.10)', color: '#a071f0' }}>
                              <Wrench className="h-2.5 w-2.5" /> ส่งซ่อม
                            </span>
                          )}
                        </div>
                        <div className="text-sm mt-1 font-medium text-foreground">
                          {h.customerName} {h.customerCompany ? <span className="text-muted-foreground">— {h.customerCompany}</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>ยืม {h.dispatchedAt ? formatThaiDate(h.dispatchedAt) : '-'}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>กำหนดคืน {formatThaiDate(h.expectedReturnDate)}</span>
                          {h.returnedAt && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span style={{ color: '#0ab39c' }}>คืน {formatThaiDate(h.returnedAt)}</span>
                            </>
                          )}
                        </div>
                        {h.damageDescription && (
                          <div className="text-xs mt-1.5 p-2 rounded" style={{ backgroundColor: 'rgba(240,101,72,0.06)', color: '#f06548', border: '1px solid rgba(240,101,72,0.15)' }}>
                            ⚠ {h.damageDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===== Velzon mini stat card (for the 4-stat row) =====
function VelzonMiniStat({
  label, value, icon, color, highlight,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  highlight?: boolean
}) {
  return (
    <div
      className={`p-2.5 rounded-md border transition-smooth ${highlight ? 'animate-pulse' : ''}`}
      style={{
        backgroundColor: `${color}11`,
        borderColor: `${color}33`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="vz-icon-soft h-5 w-5" style={{ backgroundColor: `${color}22` }}>
          <span style={{ color }}>{icon}</span>
        </span>
        <span className="vz-eyebrow truncate">{label}</span>
      </div>
      <div className="text-lg font-bold tabular-nums tracking-tight" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

// ===== Velzon spec row — Velzon 2-column spec table style =====
function VelzonSpecRow({
  icon, label, value, mono,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0 w-28">{label}</span>
      <span className={`text-xs font-medium text-foreground flex-1 truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
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
