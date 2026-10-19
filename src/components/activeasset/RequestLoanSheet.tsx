'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { LoadingState, CategoryBadge } from './shared'
import {
  Search, ShoppingCart, Plus, Minus, X, User, Building2,
  Calendar, FileText, AlertTriangle, Clock,
  ArrowLeft, Package, Trash2, Filter, Check, ListPlus,
  Send,
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

  // Form fields (หัวเอกสาร)
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
      [c.id]: { catalog: c, quantity: (prev[c.id]?.quantity || 0) + 1, notes: prev[c.id]?.notes || '' },
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
      toast({ title: 'กรุณากรอกชื่อลูกค้า / ผู้ติดต่อ ในหัวเอกสาร', variant: 'destructive' })
      return
    }
    if (!salesRepName.trim()) {
      toast({ title: 'กรุณากรอกชื่อพนักงานขายผู้รับผิดชอบ ในหัวเอกสาร', variant: 'destructive' })
      return
    }
    if (!expectedReturnDate) {
      toast({ title: 'กรุณาระบุกำหนดวันคืนสินค้า ในหัวเอกสาร', variant: 'destructive' })
      return
    }
    if (cartItems.length === 0) {
      toast({ title: 'ยังไม่มีสินค้าในรายการขอยืม', description: 'กรุณาเลือกรายการสินค้าเข้า List ด้านล่างอย่างน้อย 1 รุ่น', variant: 'destructive' })
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
        
        {/* ================= HEADER BAR ================= */}
        <header className="h-16 px-4 sm:px-6 bg-card border-b border-border flex items-center justify-between flex-shrink-0 shadow-xs z-10">
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
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    ใบขอยืมสินค้าใหม่ (New Loan Request)
                  </h1>
                  <Badge variant="outline" className="hidden sm:inline-flex bg-primary/5 text-primary border-primary/20 text-[11px] font-medium">
                    Phase 1: Sales Request
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  กรอกข้อมูลหัวเอกสารผู้ยืม → เลือกรายการสินค้าเข้า List → บันทึกส่งต่อให้ฝ่ายคลังจัดเครื่องจริง
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-semibold">
                <Package className="h-3.5 w-3.5" />
                <span>ใน List: {cartItems.length} รุ่น ({totalRequested} เครื่อง)</span>
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
              className="rounded-xl h-9 text-xs font-bold px-4 gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>กำลังบันทึก...</>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>บันทึกส่งคำขอยืม</span>
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

        {/* ================= SCROLLABLE PAGE BODY ================= */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            
            {/* ================= 1. หัวเอกสาร (DOCUMENT HEADER) ================= */}
            <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      1. ข้อมูลหัวเอกสารและผู้ขอยืม
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      ระบุข้อมูลลูกค้า วันที่กำหนดคืน และพนักงานผู้รับผิดชอบ
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                  * ช่องที่จำเป็นต้องกรอก
                </span>
              </div>

              {/* Form Grid: 3 columns layout on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* 1.1 Customer Name */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    ชื่อลูกค้า / ผู้ติดต่อ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="เช่น คุณสมชาย มั่งมี"
                      className="pl-9 h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                {/* 1.2 Customer Company */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    ชื่อบริษัท / องค์กรลูกค้า
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerCompany}
                      onChange={(e) => setCustomerCompany(e.target.value)}
                      placeholder="เช่น บจก. เอสซีจี โลจิสติกส์"
                      className="pl-9 h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                {/* 1.3 Industry */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    กลุ่มอุตสาหกรรมลูกค้า
                  </label>
                  <Select value={customerIndustry} onValueChange={setCustomerIndustry}>
                    <SelectTrigger className="h-10 text-sm rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 1.4 Sales Rep */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    พนักงานขาย / ผู้รับผิดชอบ <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={salesRepName}
                    onChange={(e) => setSalesRepName(e.target.value)}
                    placeholder="เช่น สมหญิง (Sales)"
                    className="h-10 text-sm rounded-xl"
                  />
                </div>

                {/* 1.5 Purpose */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    วัตถุประสงค์การยืม
                  </label>
                  <Select value={purpose} onValueChange={setPurpose}>
                    <SelectTrigger className="h-10 text-sm rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 1.6 Return Date */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    กำหนดวันคืนสินค้า <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="pl-9 h-10 text-sm rounded-xl"
                    />
                  </div>
                </div>

                {/* 1.7 Terms & Notes (Span full row) */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    เงื่อนไข / ข้อตกลง / หมายเหตุเอกสาร
                  </label>
                  <textarea
                    rows={2}
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-border bg-background focus:ring-1 focus:ring-primary focus:outline-none resize-none leading-relaxed"
                    value={termsAndNotes}
                    onChange={(e) => setTermsAndNotes(e.target.value)}
                    placeholder="ระบุข้อตกลงพิเศษ เงื่อนไขการยืม หรือข้อความสำหรับเจ้าหน้าที่คลัง..."
                  />
                </div>

              </div>
            </div>

            {/* ================= 2. รายการสินค้าที่เลือกเข้า LIST (SELECTED ITEMS LIST) ================= */}
            <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-border gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground">
                        2. รายการสินค้าที่ขอยืม (Item List)
                      </h2>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 border-0 text-xs">
                        {cartItems.length} รุ่น • {totalRequested} เครื่อง
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      รายการรุ่นและจำนวนที่จะส่งให้สโตร์เตรียมเครื่อง (เลือกเพิ่มได้จากหัวข้อที่ 3 ด้านล่าง)
                    </p>
                  </div>
                </div>

                {cartItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl h-8 self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> ล้างรายการทั้งหมด
                  </Button>
                )}
              </div>

              {/* Table of selected items */}
              {cartItems.length === 0 ? (
                <div className="py-10 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
                  <ListPlus className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2.5" />
                  <p className="text-sm font-semibold text-foreground">ยังไม่มีรายการสินค้าใน List</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    กรุณาเลื่อนลงไปที่ <span className="font-semibold text-primary">&quot;หัวข้อที่ 3: เลือกสินค้าเข้า List&quot;</span> ด้านล่าง เพื่อคลิกเพิ่มสินค้าที่ต้องการยืม
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-12 text-center text-xs">#</TableHead>
                        <TableHead className="text-xs">รุ่น / ยี่ห้อ</TableHead>
                        <TableHead className="text-xs">หมวดหมู่</TableHead>
                        <TableHead className="text-xs">สต็อกคงเหลือ</TableHead>
                        <TableHead className="text-xs text-center w-36">จำนวนที่ขอ</TableHead>
                        <TableHead className="text-xs">หมายเหตุเฉพาะเครื่อง</TableHead>
                        <TableHead className="text-xs text-center">สถานะการจัด</TableHead>
                        <TableHead className="w-16 text-center text-xs">ลบ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartItems.map(({ catalog: c, quantity, notes }, idx) => {
                        const short = quantity > c.available
                        const overCount = quantity - c.available

                        return (
                          <TableRow key={c.id} className={short ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                            {/* # */}
                            <TableCell className="text-center font-medium text-xs text-muted-foreground">
                              {idx + 1}
                            </TableCell>

                            {/* Model / Brand */}
                            <TableCell>
                              <div className="text-[11px] font-semibold uppercase text-muted-foreground">{c.brand}</div>
                              <div className="text-sm font-bold text-foreground">{c.model}</div>
                              {c.defaultSpecs && (
                                <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{c.defaultSpecs}</div>
                              )}
                            </TableCell>

                            {/* Category */}
                            <TableCell>
                              <CategoryBadge category={c.category} />
                            </TableCell>

                            {/* Stock Available */}
                            <TableCell>
                              <div className="text-xs">
                                <span className={c.available > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                                  พร้อมใช้ {c.available}
                                </span>
                                <span className="text-muted-foreground text-[11px] ml-1.5">(ทั้งหมด {c.total})</span>
                              </div>
                            </TableCell>

                            {/* Stepper */}
                            <TableCell className="text-center">
                              <div className="inline-flex items-center gap-1 bg-card border border-border rounded-xl p-0.5 shadow-2xs">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => updateQty(c.id, quantity - 1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={quantity}
                                  onChange={(e) => updateQty(c.id, parseInt(e.target.value) || 1)}
                                  className="h-7 w-12 text-center text-xs font-bold border-0 bg-transparent p-0 focus-visible:ring-0"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => updateQty(c.id, quantity + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>

                            {/* Item Notes */}
                            <TableCell>
                              <Input
                                placeholder="เช่น ขอแท่นชาร์จ, แบตสำรอง, สาย USB..."
                                value={notes}
                                onChange={(e) => updateNotes(c.id, e.target.value)}
                                className="h-8 text-xs rounded-lg max-w-sm"
                              />
                            </TableCell>

                            {/* Fulfillment Status */}
                            <TableCell className="text-center">
                              {short ? (
                                <Badge variant="outline" className="text-[11px] bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200">
                                  <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />
                                  เข้าคิว ({overCount} เครื่อง)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                                  <Check className="h-3 w-3 mr-1 text-emerald-600" />
                                  พร้อมจัดครบ
                                </Badge>
                              )}
                            </TableCell>

                            {/* Delete */}
                            <TableCell className="text-center">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeFromCart(c.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-rose-600 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Waiting List Alert Banner */}
              {hasShortfall && (
                <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">หมายเหตุเกี่ยวกับสินค้าที่ขอเกินสต็อก:</span>
                    <div className="text-[11px] opacity-90 mt-0.5">
                      รายการที่สต็อกไม่เพียงพอจะถูกบรรจุเข้าสู่ <b>Waiting List</b> โดยอัตโนมัติ เมื่อฝ่ายสโตร์ได้รับเครื่องคืนและตรวจสภาพพร้อมใช้งาน ระบบจะแจ้งเตือนเพื่อเตรียมจัดส่งทันที
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ================= 3. ค้นหาและเลือกสินค้าเข้า LIST (CATALOG PICKER) ================= */}
            <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-border gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      3. ค้นหาและเลือกสินค้าเข้า List (Catalog Inventory)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      คลิกปุ่ม &quot;+ เพิ่มเข้า List&quot; เพื่อเลือกสินค้าเข้าใบคำขอยืมด้านบน
                    </p>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={filterAvailableOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterAvailableOnly(!filterAvailableOnly)}
                    className="rounded-xl h-8 px-3 text-xs gap-1.5"
                  >
                    <Check className={`h-3 w-3 ${filterAvailableOnly ? 'opacity-100' : 'opacity-40'}`} />
                    เฉพาะพร้อมใช้ ({catalogs.filter(c => c.available > 0).length})
                  </Button>
                </div>
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-3 mb-5">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="พิมพ์ค้นหาชื่อรุ่น ยี่ห้อ หรือสเปก เช่น TC21, Zebra, PM85..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-11 rounded-xl text-sm bg-background border-border"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  <span className="text-muted-foreground flex items-center gap-1 mr-1 flex-shrink-0">
                    <Filter className="h-3 w-3" /> หมวดหมู่:
                  </span>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-smooth whitespace-nowrap ${
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
                        className={`px-3 py-1.5 rounded-xl font-medium transition-smooth whitespace-nowrap flex items-center gap-1.5 ${
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

              {/* Catalog Cards Grid */}
              {loading && <LoadingState message="กำลังค้นหารายการสินค้า..." />}

              {!loading && displayedCatalogs.length === 0 && (
                <div className="py-12 text-center">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-foreground">ไม่พบรายการสินค้าที่ค้นหา</p>
                  <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น</p>
                </div>
              )}

              {!loading && displayedCatalogs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {displayedCatalogs.map((c) => {
                    const inCart = !!cart[c.id]
                    const currentQty = cart[c.id]?.quantity || 0
                    const isAvailable = c.available > 0

                    return (
                      <div
                        key={c.id}
                        className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                          inCart
                            ? 'bg-primary/[0.04] border-primary/40 ring-2 ring-primary/20 shadow-xs'
                            : 'bg-card border-border hover:border-border/80 hover:shadow-xs'
                        }`}
                      >
                        {/* Top: Category & Stock Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <CategoryBadge category={c.category} />
                            {isAvailable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                พร้อมใช้ {c.available}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                ของหมด
                              </span>
                            )}
                          </div>

                          {/* Brand & Model */}
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.brand}
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-foreground mt-0.5 leading-snug line-clamp-1">
                            {c.model}
                          </h3>

                          {/* Stock Breakdown */}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 py-1 px-2 rounded-lg bg-muted/40">
                            <div>ทั้งหมด: <span className="font-semibold text-foreground">{c.total}</span></div>
                            <div>•</div>
                            <div>กำลังยืม: <span className="font-semibold text-amber-600">{c.onLoan}</span></div>
                          </div>

                          {/* Specs */}
                          {c.defaultSpecs && (
                            <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {c.defaultSpecs}
                            </p>
                          )}
                        </div>

                        {/* Bottom Action */}
                        <div className="mt-3 pt-3 border-t border-border/60">
                          {inCart ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> ใน List ({currentQty})
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(c)}
                                className="h-8 px-2.5 rounded-xl text-xs font-semibold gap-1"
                              >
                                <Plus className="h-3.5 w-3.5" /> เพิ่มอีก
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
                              {isAvailable ? 'เพิ่มเข้า List' : 'ขอจองคิว (เกินสต็อก)'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Bottom spacer for comfortable scrolling */}
            <div className="h-20" />

          </div>
        </div>

        {/* ================= STICKY BOTTOM ACTION BAR ================= */}
        <footer className="h-16 px-4 sm:px-6 bg-card border-t border-border flex items-center justify-between flex-shrink-0 shadow-lg z-10">
          <div className="flex items-center gap-3">
            <div className="text-xs sm:text-sm">
              <span className="text-muted-foreground">สรุปคำขอยืม: </span>
              <span className="font-bold text-foreground">
                {cartItems.length} รุ่น ({totalRequested} เครื่อง)
              </span>
              {expectedReturnDate && (
                <span className="text-muted-foreground hidden md:inline ml-2">
                  • กำหนดคืน: <span className="text-foreground font-semibold">{formatThaiDate(expectedReturnDate)}</span>
                </span>
              )}
            </div>
            {hasShortfall && (
              <Badge variant="outline" className="hidden sm:inline-flex bg-amber-100 text-amber-800 border-amber-300 text-xs gap-1">
                <Clock className="h-3 w-3" /> มีรายการติดคิว {shortfallItems.length} รุ่น
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 px-4 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || cartItems.length === 0 || !customerName.trim() || !salesRepName.trim() || !expectedReturnDate}
              className="rounded-xl h-10 px-5 text-xs font-bold gap-2 shadow-sm"
            >
              {submitting ? (
                <>กำลังบันทึกคำขอ...</>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>บันทึกส่งคำขอยืมสินค้า ({totalRequested} เครื่อง)</span>
                </>
              )}
            </Button>
          </div>
        </footer>

      </div>
    </div>
  )
}
