'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { EmptyState, LoadingState, CategoryBadge } from './shared'
import {
  Search, ShoppingCart, Plus, Minus, X, User, Building2,
  Calendar, FileText, AlertTriangle, CheckCircle2, Clock,
  ArrowLeft, Package, Trash2, Sparkles, Filter, Layers, Info, Check,
} from 'lucide-react'
import {
  PURPOSE_LABELS, INDUSTRY_LABELS, CATEGORY_LABELS, formatThaiDate,
} from '@/lib/activeasset-constants'

interface CatalogItem {
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

interface RequestLoanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (docNo: string, queued: boolean) => void
}

export function RequestLoanSheet({ open, onOpenChange, onCreated }: RequestLoanSheetProps) {
  const { toast } = useToast()
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false)
  const [cart, setCart] = useState<Record<string, { catalog: CatalogItem; quantity: number; notes: string }>>({})

  // Form fields
  const [customerName, setCustomerName] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [customerIndustry, setCustomerIndustry] = useState('Logistics')
  const [salesRepName, setSalesRepName] = useState('')
  const [purpose, setPurpose] = useState('Demo')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [termsAndNotes, setTermsAndNotes] = useState('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม')
  const [submitting, setSubmitting] = useState(false)

  // Handle ESC key & body scroll lock
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [open, onOpenChange])

  // Load catalogs from API
  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      const res = await fetch(`/api/catalog?${params.toString()}`)
      const data = await res.json()
      setCatalogs(data.catalogs || [])
    } catch {
      toast({ title: 'ไม่สามารถโหลดข้อมูลสินค้าได้', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, selectedCategory, toast])

  useEffect(() => {
    if (open) {
      const t = setTimeout(loadCatalogs, 200)
      return () => clearTimeout(t)
    }
  }, [open, loadCatalogs])

  // Cart operations
  const addToCart = (c: CatalogItem) => {
    setCart((prev) => ({
      ...prev,
      [c.id]: { catalog: c, quantity: 1, notes: '' },
    }))
  }

  const updateQty = (id: string, qty: number) => {
    const val = Math.max(1, qty)
    setCart((prev) => ({
      ...prev,
      [id]: { ...prev[id], quantity: val },
    }))
  }

  const updateNotes = (id: string, notes: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: { ...prev[id], notes },
    }))
  }

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const clearCart = () => setCart({})

  const cartItems = Object.values(cart)
  const totalRequested = cartItems.reduce((s, x) => s + x.quantity, 0)
  const shortfallItems = cartItems.filter(x => x.quantity > x.catalog.available)
  const hasShortfall = shortfallItems.length > 0

  // Filtered catalogs for display
  const displayedCatalogs = useMemo(() => {
    if (!filterAvailableOnly) return catalogs
    return catalogs.filter(c => c.available > 0)
  }, [catalogs, filterAvailableOnly])

  const resetForm = () => {
    setCart({})
    setCustomerName('')
    setCustomerCompany('')
    setCustomerIndustry('Logistics')
    setSalesRepName('')
    setPurpose('Demo')
    setExpectedReturnDate('')
    setTermsAndNotes('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม')
  }

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast({ title: 'กรุณากรอกชื่อลูกค้า / ผู้ติดต่อ', variant: 'destructive' })
      return
    }
    if (!salesRepName.trim()) {
      toast({ title: 'กรุณากรอกชื่อพนักงานขายผู้รับผิดชอบ', variant: 'destructive' })
      return
    }
    if (!expectedReturnDate) {
      toast({ title: 'กรุณาระบุกำหนดวันคืนสินค้า', variant: 'destructive' })
      return
    }
    if (cartItems.length === 0) {
      toast({ title: 'ยังไม่มีสินค้าในรายการขอยืม', description: 'กรุณาเลือกอย่างน้อย 1 รุ่น', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerCompany: customerCompany.trim(),
          customerIndustry,
          salesRepName: salesRepName.trim(),
          purpose,
          expectedReturnDate,
          termsAndNotes,
          items: cartItems.map((x) => ({
            catalogId: x.catalog.id,
            quantity: x.quantity,
            notes: x.notes.trim() || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'สร้างคำขอไม่สำเร็จ')

      toast({
        title: `✓ สร้างคำขอยืมสำเร็จ: ${data.loan.docNo}`,
        description: data.queued
          ? `มีรายการติดคิว Waiting List ${shortfallItems.length} รุ่น (เนื่องจากขอเกินสต็อก)`
          : `รอเจ้าหน้าที่คลังจัดเครื่อง — ทั้งหมด ${totalRequested} เครื่อง`,
      })
      onCreated(data.loan.docNo, data.queued)
      onOpenChange(false)
      resetForm()
    } catch (e: unknown) {
      toast({
        title: 'เกิดข้อผิดพลาดในการสร้างคำขอยืม',
        description: e instanceof Error ? e.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col animate-in fade-in-0 duration-200">
      {/* Container เต็มหน้าจอ */}
      <div className="w-full h-full bg-slate-50 dark:bg-background flex flex-col overflow-hidden">
        
        {/* ================= HEADER BAR (เต็มความกว้าง) ================= */}
        <header className="h-16 px-4 sm:px-6 bg-card border-b border-border flex items-center justify-between flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline font-medium text-xs">ย้อนกลับ</span>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    สร้างคำขอยืมสินค้าใหม่
                  </h1>
                  <Badge variant="outline" className="hidden sm:inline-flex bg-primary/5 text-primary border-primary/20 text-[11px] font-medium">
                    Phase 1: Sales ขอตามรุ่น
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  เลือกสินค้าและจำนวนเครื่องที่ต้องการ → ระบบจะสร้างใบคำขอส่งต่อไปยังฝ่ายคลังเพื่อหยิบเครื่องจริง
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-semibold">
                <Package className="h-3.5 w-3.5" />
                <span>{cartItems.length} รุ่น ({totalRequested} เครื่อง)</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-9 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || cartItems.length === 0 || !customerName.trim() || !salesRepName.trim() || !expectedReturnDate}
              className="rounded-xl h-9 text-xs font-semibold px-4 gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>กำลังบันทึก...</>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  <span>บันทึกส่งคำขอ</span>
                  {totalRequested > 0 && <span>({totalRequested})</span>}
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              title="ปิดหน้าต่าง (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* ================= MAIN CONTENT (2-COLUMN FULL LAYOUT) ================= */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* ----- LEFT COLUMN: CATALOG PICKER (60-65% width) ----- */}
          <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-border bg-background">
            
            {/* Search & Category Filter Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-card/60 space-y-3 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อรุ่น ยี่ห้อ หรือคำอธิบายสินค้า..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 rounded-xl text-sm bg-background border-border"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  variant={filterAvailableOnly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterAvailableOnly(!filterAvailableOnly)}
                  className="rounded-xl h-10 px-3.5 text-xs gap-1.5 flex-shrink-0"
                >
                  <Check className={`h-3.5 w-3.5 ${filterAvailableOnly ? 'opacity-100' : 'opacity-40'}`} />
                  เฉพาะพร้อมใช้ ({catalogs.filter(c => c.available > 0).length})
                </Button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <span className="text-muted-foreground flex items-center gap-1 mr-1 flex-shrink-0">
                  <Filter className="h-3 w-3" /> หมวดหมู่:
                </span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-smooth whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  ทั้งหมด ({catalogs.length})
                </button>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                  const count = catalogs.filter(c => c.category === key).length
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={`px-3 py-1 rounded-lg font-medium transition-smooth whitespace-nowrap flex items-center gap-1.5 ${
                        selectedCategory === key
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="opacity-70 text-[10px]">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Catalog Grid View */}
            <ScrollArea className="flex-1 p-4 sm:p-5">
              {loading && <LoadingState message="กำลังค้นหารายการสินค้า..." />}

              {!loading && displayedCatalogs.length === 0 && (
                <div className="py-16 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground">ไม่พบรายการรุ่นสินค้า</p>
                  <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น</p>
                </div>
              )}

              {!loading && displayedCatalogs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                  {displayedCatalogs.map((c) => {
                    const cartEntry = cart[c.id]
                    const inCart = !!cartEntry
                    const qty = cartEntry?.quantity || 0
                    const isAvailable = c.available > 0

                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                          inCart
                            ? 'bg-primary/[0.03] border-primary/40 ring-1 ring-primary/30 shadow-xs'
                            : 'bg-card border-border hover:border-border/80 hover:shadow-xs'
                        }`}
                      >
                        {/* Top: Category & Stock Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <CategoryBadge category={c.category} />
                            {isAvailable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                พร้อมใช้ {c.available}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                ของหมด (คิว)
                              </span>
                            )}
                          </div>

                          {/* Brand & Model */}
                          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.brand}
                          </div>
                          <h3 className="text-base font-bold text-foreground mt-0.5 leading-snug">
                            {c.model}
                          </h3>

                          {/* Stock Breakdown */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 py-1.5 px-2.5 rounded-xl bg-muted/40">
                            <div>ทั้งหมด: <span className="font-semibold text-foreground">{c.total}</span></div>
                            <div>•</div>
                            <div>กำลังยืม: <span className="font-semibold text-amber-600">{c.onLoan}</span></div>
                            {c.inRepair > 0 && (
                              <>
                                <div>•</div>
                                <div>ซ่อม: <span className="font-semibold text-rose-600">{c.inRepair}</span></div>
                              </>
                            )}
                          </div>

                          {/* Specs */}
                          {c.defaultSpecs && (
                            <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {c.defaultSpecs}
                            </p>
                          )}
                        </div>

                        {/* Bottom: Action Stepper or Add button */}
                        <div className="mt-4 pt-3 border-t border-border/60">
                          {inCart ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 bg-card border border-primary/30 rounded-xl p-0.5 shadow-2xs">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                                  onClick={() => updateQty(c.id, qty - 1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={qty}
                                  onChange={(e) => updateQty(c.id, parseInt(e.target.value) || 1)}
                                  className="h-8 w-12 text-center text-sm font-bold border-0 bg-transparent p-0 focus-visible:ring-0"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-foreground hover:bg-muted"
                                  onClick={() => updateQty(c.id, qty + 1)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFromCart(c.id)}
                                className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs gap-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">ลบ</span>
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant={isAvailable ? 'default' : 'outline'}
                              onClick={() => addToCart(c)}
                              className={`w-full rounded-xl h-9 text-xs font-semibold gap-1.5 ${
                                !isAvailable ? 'text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-700' : ''
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {isAvailable ? 'ขอยืมรุ่นนี้' : 'ขอจองคิว (เกินสต็อก)'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* ----- RIGHT COLUMN: CART & BORROW FORM (35-40% width) ----- */}
          <div className="w-full lg:w-[460px] xl:w-[500px] flex flex-col bg-card flex-shrink-0 overflow-hidden shadow-sm">
            
            {/* Header of Form Panel */}
            <div className="p-4 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">รายละเอียดคำขอยืม</h2>
                  <p className="text-[11px] text-muted-foreground">รายการสินค้าและข้อมูลลูกค้า</p>
                </div>
              </div>

              {cartItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="h-7 text-[11px] text-muted-foreground hover:text-rose-600 px-2 rounded-lg"
                >
                  ล้างรายการ
                </Button>
              )}
            </div>

            {/* Scrollable Form Body */}
            <ScrollArea className="flex-1 p-4 space-y-4">
              <div className="space-y-4">
                
                {/* 1. รายการในตะกร้า (Cart Items) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      รายการที่เลือก ({cartItems.length} รุ่น, {totalRequested} เครื่อง)
                    </span>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
                      <ShoppingCart className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-xs font-medium text-foreground">ยังไม่มีรายการที่เลือก</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        คลิกปุ่ม &quot;ขอยืมรุ่นนี้&quot; จากรายการสินค้าด้านซ้าย
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cartItems.map(({ catalog: c, quantity, notes }) => {
                        const short = quantity > c.available
                        const overCount = quantity - c.available

                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-xl border transition-all ${
                              short
                                ? 'bg-amber-50/70 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                                : 'bg-background border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  {c.brand}
                                </div>
                                <div className="text-sm font-bold text-foreground truncate">
                                  {c.model}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                  <span>สต็อกพร้อมใช้: {c.available}</span>
                                  {short && (
                                    <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200">
                                      เกินสต็อก {overCount} ชิ้น (รอคิว)
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Stepper */}
                              <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
                                <button
                                  onClick={() => updateQty(c.id, quantity - 1)}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-foreground"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-8 text-center text-xs font-bold text-foreground">
                                  {quantity}
                                </span>
                                <button
                                  onClick={() => updateQty(c.id, quantity + 1)}
                                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-background text-foreground"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(c.id)}
                                className="text-muted-foreground hover:text-rose-600 p-1"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Item specific notes */}
                            <Input
                              placeholder="หมายเหตุเฉพาะรุ่นนี้ เช่น เอาแท่นชาร์จ, แบตสำรอง..."
                              value={notes}
                              onChange={(e) => updateNotes(c.id, e.target.value)}
                              className="mt-2 h-7 text-xs bg-card border-border/80 rounded-lg"
                            />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Shortfall warning notice */}
                  {hasShortfall && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold">รุ่นที่ขอเกินสต็อกจะติดคิว Waiting List อัตโนมัติ:</span>
                        <div className="text-[11px] opacity-90 mt-0.5">
                          เมื่อมีเครื่องถูกนำมาคืนที่เคาน์เตอร์และผ่านการตรวจสอบสภาพ ระบบจะแจ้งเตือนเพื่อจัดส่งให้คิวนี้ทันที
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* 2. ข้อมูลลูกค้าและผู้ยืม (Customer & Loan Info) */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    ข้อมูลผู้ยืมและลูกค้า
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Customer Name */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        ชื่อลูกค้า / ผู้ติดต่อ <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="เช่น คุณสมชาย มั่งมี"
                          className="pl-8 h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Customer Company */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        ชื่อบริษัท / องค์กร
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={customerCompany}
                          onChange={(e) => setCustomerCompany(e.target.value)}
                          placeholder="เช่น บจก. ซีพี ออลล์"
                          className="pl-8 h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Industry */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        กลุ่มอุตสาหกรรม
                      </label>
                      <Select value={customerIndustry} onValueChange={setCustomerIndustry}>
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sales Rep */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        พนักงานขาย / ผู้รับผิดชอบ <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={salesRepName}
                        onChange={(e) => setSalesRepName(e.target.value)}
                        placeholder="เช่น สมหญิง (Sales)"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>

                    {/* Purpose */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        วัตถุประสงค์การยืม
                      </label>
                      <Select value={purpose} onValueChange={setPurpose}>
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Return Date */}
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        กำหนดวันคืน <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="date"
                          value={expectedReturnDate}
                          onChange={(e) => setExpectedReturnDate(e.target.value)}
                          className="pl-8 h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terms & Notes */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      เงื่อนไขการยืม / หมายเหตุเพิ่มเติม
                    </label>
                    <textarea
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none resize-none leading-relaxed"
                      value={termsAndNotes}
                      onChange={(e) => setTermsAndNotes(e.target.value)}
                      placeholder="ระบุข้อตกลงพิเศษ หรือเงื่อนไขเพิ่มเติม..."
                    />
                  </div>
                </div>

              </div>
            </ScrollArea>

            {/* Footer Submit Button Panel */}
            <div className="p-4 border-t border-border bg-card flex-shrink-0 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ยอดรวมคำขอ:</span>
                <span className="font-bold text-foreground text-sm">
                  {cartItems.length} รุ่น • {totalRequested} เครื่อง
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl h-11 text-xs px-4"
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || cartItems.length === 0 || !customerName.trim() || !salesRepName.trim() || !expectedReturnDate}
                  className="flex-1 rounded-xl h-11 text-xs font-bold gap-2 shadow-sm"
                >
                  {submitting ? (
                    'กำลังสร้างใบคำขอ...'
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      <span>ส่งคำขอยืมสินค้า ({totalRequested} เครื่อง)</span>
                      {hasShortfall && <Clock className="h-4 w-4 ml-1 opacity-70" />}
                    </>
                  )}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">
                ระบบจะสร้างใบคำขอยืมสถานะ &quot;รอจัด&quot; เพื่อให้สโตร์สแกน S/N และส่งมอบต่อไป
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
