'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useSimpleAuth } from '@/components/auth/SimpleAuth'
import { LoadingState, CategoryBadge } from './shared'
import {
  Search, ShoppingCart, Plus, Minus, X, User, Building2,
  Calendar, FileText, AlertTriangle, Clock,
  ArrowLeft, Package, Trash2, Filter, Check, ListPlus,
  Send, ChevronDown, CheckCircle2, Sparkles, HelpCircle,
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

interface CustomerItem {
  id: string
  name: string
  company: string
  industry: string | null
  phone: string | null
  loanCount?: number
}

interface RequestLoanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (docNo: string, queued: boolean) => void
}

// Helper: คำนวณวันที่ล่วงหน้าตามจำนวนสัปดาห์
const getFutureDate = (weeks: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + weeks * 7)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const WEEKS_PRESETS = [
  { label: '1 สัปดาห์', weeks: 1 },
  { label: '2 สัปดาห์', weeks: 2 },
  { label: '3 สัปดาห์', weeks: 3 },
  { label: '4 สัปดาห์', weeks: 4 },
]

// ================= REUSABLE AUTOCOMPLETE / SEARCHABLE COMBOBOX =================
interface AutocompleteComboboxProps {
  value: string
  onChange: (val: string) => void
  options: Array<{ value: string; label: string; sublabel?: string }>
  placeholder?: string
  className?: string
  onSelectOption?: (val: string, option: { value: string; label: string; sublabel?: string }) => void
}

function AutocompleteCombobox({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
  onSelectOption,
}: AutocompleteComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // กรองตัวเลือกตามสิ่งที่ผู้ใช้พิมพ์ (case-insensitive)
  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return options.slice(0, 50)
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    )
  }, [options, value])

  // ปิด dropdown เมื่อคลิกนอกคอมโพเนนต์
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`h-8.5 text-xs rounded-lg pr-12 ${className}`}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded"
              title="ล้างข้อความ"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-muted-foreground hover:text-foreground rounded"
            title="แสดงรายการตัวเลือก"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-[11px] text-muted-foreground text-center">
              ไม่พบตัวเลือกตรงกัน • ใช้ค่าที่พิมพ์: &quot;<span className="font-medium text-foreground">{value}</span>&quot;
            </div>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt.value === value || opt.label === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    if (onSelectOption) onSelectOption(opt.value, opt)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex flex-col transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-3 w-3 text-primary ml-1 flex-shrink-0" />}
                  </div>
                  {opt.sublabel && (
                    <span className="text-[10px] text-muted-foreground font-normal line-clamp-1 mt-0.5">
                      {opt.sublabel}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export function RequestLoanSheet({ open, onOpenChange, onCreated }: RequestLoanSheetProps) {
  const { toast } = useToast()
  const { user } = useSimpleAuth()

  // Catalogs & Customers database
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [customers, setCustomers] = useState<CustomerItem[]>([])
  const [salesRepsList, setSalesRepsList] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [filterAvailableOnly, setFilterAvailableOnly] = useState(false)
  const [cart, setCart] = useState<Record<string, { catalog: CatalogItem; quantity: number; notes: string }>>({})

  // Form fields (หัวเอกสาร)
  // ลำดับ: ชื่อบริษัท -> ผู้ติดต่อ -> กลุ่มอุตสาหกรรม -> พนักงานขาย -> วัตถุประสงค์ -> กำหนดวันคืน
  const [customerCompany, setCustomerCompany] = useState('')
  const [customerName, setCustomerName] = useState('')
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

  // ตั้งค่าเริ่มต้นเมื่อเปิดหน้าต่าง:
  // 1. พนักงานขาย: เอาชื่อ user ที่ login มาใช้
  // 2. กำหนดวันคืน: ตั้งอัตโนมัติ 2 สัปดาห์
  useEffect(() => {
    if (open) {
      if (!salesRepName && user?.name) {
        setSalesRepName(user.name)
      }
      if (!expectedReturnDate) {
        setExpectedReturnDate(getFutureDate(2))
      }
    }
  }, [open, user, salesRepName, expectedReturnDate])

  // โหลดรายชื่อลูกค้าและพนักงานขาย
  const loadCustomersAndSalesReps = useCallback(async () => {
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      if (data.customers) setCustomers(data.customers)
      if (data.salesReps) setSalesRepsList(data.salesReps)
    } catch {
      // ignore silently
    }
  }, [])

  // โหลดรายการสินค้าจาก API
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
      loadCustomersAndSalesReps()
      const t = setTimeout(loadCatalogs, 200)
      return () => clearTimeout(t)
    }
  }, [open, loadCatalogs, loadCustomersAndSalesReps])

  // ================= AUTOCOMPLETE OPTIONS =================

  // 1. รายชื่อบริษัท (Distinct company names)
  const companyOptions = useMemo(() => {
    const map = new Map<string, { company: string; contact: string; industry: string }>()
    customers.forEach((c) => {
      const comp = c.company?.trim()
      if (comp && !map.has(comp.toLowerCase())) {
        map.set(comp.toLowerCase(), {
          company: comp,
          contact: c.name?.trim() || '',
          industry: c.industry || '',
        })
      }
    })
    return Array.from(map.values()).map((item) => ({
      value: item.company,
      label: item.company,
      sublabel: [
        item.contact ? `ผู้ติดต่อ: ${item.contact}` : '',
        item.industry ? `อุตสาหกรรม: ${INDUSTRY_LABELS[item.industry] || item.industry}` : '',
      ]
        .filter(Boolean)
        .join(' • '),
    }))
  }, [customers])

  // 2. รายชื่อผู้ติดต่อ (Contact Names)
  const contactOptions = useMemo(() => {
    // ถ้ามีการพิมพ์/เลือกบริษัท ให้กรองผู้ติดต่อของบริษัทนั้นขึ้นมาก่อน
    const qComp = customerCompany.trim().toLowerCase()
    const relevant = qComp
      ? customers.filter((c) => c.company?.toLowerCase().trim() === qComp)
      : customers

    const names = Array.from(new Set(relevant.map((c) => c.name?.trim()).filter(Boolean)))
    return names.map((n) => ({
      value: n,
      label: n,
      sublabel: customerCompany ? customerCompany : undefined,
    }))
  }, [customers, customerCompany])

  // 3. กลุ่มอุตสาหกรรม (Industry Options)
  const industryOptions = useMemo(() => {
    return Object.entries(INDUSTRY_LABELS).map(([k, v]) => ({
      value: k,
      label: `${v} (${k})`,
    }))
  }, [])

  // 4. รายชื่อพนักงานขาย (Sales Rep Options)
  const salesRepOptions = useMemo(() => {
    const set = new Set<string>()
    if (user?.name) set.add(user.name)
    salesRepsList.forEach((s) => {
      if (s?.trim()) set.add(s.trim())
    })
    return Array.from(set).map((name) => ({
      value: name,
      label: name,
      sublabel: name === user?.name ? 'คุณ (ผู้ใช้ที่ล็อกอิน)' : undefined,
    }))
  }, [user, salesRepsList])

  // 5. วัตถุประสงค์ (Purpose Options)
  const purposeOptions = useMemo(() => {
    return Object.entries(PURPOSE_LABELS).map(([k, v]) => ({
      value: k,
      label: v,
    }))
  }, [])

  // ================= AUTO-FILL LOGIC เมื่อเลือกหรือพิมพ์ชื่อบริษัท =================
  const handleSelectCompany = (compName: string) => {
    setCustomerCompany(compName)
    // ค้นหาว่าบริษัทนี้มีอยู่ในฐานข้อมูลหรือไม่
    const matched = customers.find(
      (c) => c.company?.toLowerCase().trim() === compName.toLowerCase().trim()
    )
    if (matched) {
      // ล้อกลุ่มอุตสาหกรรมตามบริษัททันที
      if (matched.industry) {
        setCustomerIndustry(matched.industry)
      }
      // หากยังไม่ได้กรอกชื่อผู้ติดต่อ ให้นำชื่อผู้ติดต่อเดิมมาใส่ให้
      if (matched.name && !customerName.trim()) {
        setCustomerName(matched.name)
      }
    }
  }

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
  const shortfallItems = cartItems.filter((x) => x.quantity > x.catalog.available)
  const hasShortfall = shortfallItems.length > 0

  // Filtered catalogs for display
  const displayedCatalogs = useMemo(() => {
    if (!filterAvailableOnly) return catalogs
    return catalogs.filter((c) => c.available > 0)
  }, [catalogs, filterAvailableOnly])

  const resetForm = () => {
    setCart({})
    setCustomerCompany('')
    setCustomerName('')
    setCustomerIndustry('Logistics')
    setSalesRepName(user?.name || '')
    setPurpose('Demo')
    setExpectedReturnDate(getFutureDate(2))
    setTermsAndNotes('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม')
  }

  const handleSubmit = async () => {
    if (!customerCompany.trim() && !customerName.trim()) {
      toast({ title: 'กรุณากรอกชื่อบริษัท หรือชื่อผู้ติดต่อ', variant: 'destructive' })
      return
    }
    if (!salesRepName.trim()) {
      toast({ title: 'กรุณาระบุพนักงานขายผู้รับผิดชอบ', variant: 'destructive' })
      return
    }
    if (!expectedReturnDate) {
      toast({ title: 'กรุณาระบุกำหนดวันคืนสินค้า', variant: 'destructive' })
      return
    }
    if (cartItems.length === 0) {
      toast({
        title: 'ยังไม่มีสินค้าในรายการขอยืม',
        description: 'กรุณาเลือกรายการสินค้าเข้า List ด้านล่างอย่างน้อย 1 รุ่น',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCompany: customerCompany.trim(),
          customerName: customerName.trim() || customerCompany.trim(),
          customerIndustry,
          salesRepName: salesRepName.trim(),
          actualRequesterName: user?.name,
          actualRequesterId: user?.id,
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

  // ตรวจสอบว่าวันที่เลือกตรงกับ preset สัปดาห์ไหนหรือไม่
  const currentPresetWeeks = WEEKS_PRESETS.find(
    (w) => getFutureDate(w.weeks) === expectedReturnDate
  )?.weeks

  // เช็คว่าผู้ขอยืมต่างจากผู้ล็อกอินจริงหรือไม่
  const isBorrowingForOther = user?.name && salesRepName.trim() && salesRepName.trim() !== user.name

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
                  กรอกข้อมูลบริษัทและผู้ติดต่อ → เลือกรายการสินค้าเข้า List → บันทึกส่งต่อให้ฝ่ายคลังจัดเครื่อง
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
              disabled={
                submitting ||
                cartItems.length === 0 ||
                (!customerCompany.trim() && !customerName.trim()) ||
                !salesRepName.trim() ||
                !expectedReturnDate
              }
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
          <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-5 space-y-4">
            
            {/* ================= 1. หัวเอกสาร (DOCUMENT HEADER - AUTOCOMPLETE & COMPACT) ================= */}
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> 1. ข้อมูลหัวเอกสารผู้ขอยืม
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    • พิมพ์เพื่อค้นหาบริษัท/ผู้ติดต่อ ระบบจะช่วยดึงกลุ่มอุตสาหกรรมให้อัตโนมัติ
                  </span>
                </div>
                {user?.name && (
                  <span className="text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">
                    ผู้ล็อกอินปัจจุบัน: <span className="font-semibold text-foreground">{user.name}</span>
                  </span>
                )}
              </div>

              {/* Form Grid: 
                  Row 1: ชื่อบริษัท (Autocomplete) -> ผู้ติดต่อ (Autocomplete) -> กลุ่มอุตสาหกรรม (Autocomplete)
                  Row 2: พนักงานขาย (Autocomplete) -> วัตถุประสงค์ (Autocomplete) -> วันกำหนดคืน (Preset + Datepicker)
                  Row 3: เงื่อนไข / หมายเหตุเอกสาร
              */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                
                {/* 1.1 ชื่อบริษัท (Autocomplete มาก่อน) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      ชื่อบริษัท / องค์กร <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">พิมพ์ค้นหาได้</span>
                  </div>
                  <AutocompleteCombobox
                    value={customerCompany}
                    onChange={(val) => handleSelectCompany(val)}
                    onSelectOption={(val) => handleSelectCompany(val)}
                    options={companyOptions}
                    placeholder="พิมพ์หรือเลือกชื่อบริษัท..."
                  />
                </div>

                {/* 1.2 ผู้ติดต่อ (ชื่อลูกค้า Autocomplete) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      ชื่อผู้ติดต่อ / ลูกค้า <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">พิมพ์ค้นหาได้</span>
                  </div>
                  <AutocompleteCombobox
                    value={customerName}
                    onChange={setCustomerName}
                    options={contactOptions}
                    placeholder="พิมพ์หรือเลือกชื่อผู้ติดต่อ..."
                  />
                </div>

                {/* 1.3 กลุ่มอุตสาหกรรม (ล้อตามชื่อบริษัท + Autocomplete) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      กลุ่มอุตสาหกรรม
                    </label>
                    <span className="text-[10px] text-emerald-600 font-medium">ล้อตามบริษัทอัตโนมัติ</span>
                  </div>
                  <AutocompleteCombobox
                    value={customerIndustry}
                    onChange={setCustomerIndustry}
                    options={industryOptions}
                    placeholder="เลือกหรือค้นหากลุ่มอุตสาหกรรม..."
                  />
                </div>

                {/* 1.4 พนักงานขาย / ผู้ขอยืม (Default จาก User Login, เปลี่ยนได้, เก็บ log) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      พนักงานขาย / ผู้ยืม <span className="text-rose-500">*</span>
                    </label>
                    {isBorrowingForOther ? (
                      <span className="text-[10px] text-amber-600 font-medium">
                        (บันทึกจริง: {user?.name})
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">จากชื่อ Login</span>
                    )}
                  </div>
                  <AutocompleteCombobox
                    value={salesRepName}
                    onChange={setSalesRepName}
                    options={salesRepOptions}
                    placeholder="พิมพ์หรือเลือกพนักงานขาย..."
                  />
                </div>

                {/* 1.5 วัตถุประสงค์ (Autocomplete พิมพ์ได้) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      วัตถุประสงค์การยืม
                    </label>
                    <span className="text-[10px] text-muted-foreground">พิมพ์ค้นหาได้</span>
                  </div>
                  <AutocompleteCombobox
                    value={purpose}
                    onChange={setPurpose}
                    options={purposeOptions}
                    placeholder="เลือกหรือพิมพ์วัตถุประสงค์..."
                  />
                </div>

                {/* 1.6 กำหนดวันคืน (Auto 2 สัปดาห์ + Preset 1,2,3,4 สัปดาห์ + ปฏิทิน) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      กำหนดวันคืน <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-primary font-medium">อัตโนมัติ 2 สัปดาห์</span>
                  </div>

                  <div className="space-y-1.5">
                    {/* Shortcut preset pills */}
                    <div className="grid grid-cols-4 gap-1">
                      {WEEKS_PRESETS.map((p) => {
                        const isSelected = currentPresetWeeks === p.weeks
                        return (
                          <button
                            key={p.weeks}
                            type="button"
                            onClick={() => setExpectedReturnDate(getFutureDate(p.weeks))}
                            className={`py-1 px-1.5 text-[10px] rounded-md font-semibold transition-colors text-center ${
                              isSelected
                                ? 'bg-primary text-primary-foreground shadow-xs'
                                : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* Manual date input */}
                    <Input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      className="h-8.5 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {/* 1.7 Terms & Notes (Span full row) */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-1">
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    เงื่อนไข / ข้อตกลง / หมายเหตุเอกสาร
                  </label>
                  <Input
                    value={termsAndNotes}
                    onChange={(e) => setTermsAndNotes(e.target.value)}
                    placeholder="เงื่อนไขการยืม / หมายเหตุเอกสาร (เช่น ผู้ยืมรับผิดชอบความเสียหายระหว่างการยืม)..."
                    className="h-8 text-xs rounded-lg text-muted-foreground bg-muted/20"
                  />
                </div>

              </div>
            </div>

            {/* ================= 2. รายการสินค้าที่เลือกเข้า LIST (SELECTED ITEMS LIST) ================= */}
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-border/80 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-foreground">
                        2. รายการสินค้าที่ขอยืม (Item List)
                      </h2>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100 border-0 text-xs">
                        {cartItems.length} รุ่น • {totalRequested} เครื่อง
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
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
                <div className="py-8 text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                  <ListPlus className="h-9 w-9 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-foreground">ยังไม่มีรายการสินค้าใน List</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md mx-auto">
                    กรุณาเลื่อนลงไปที่ <span className="font-semibold text-primary">&quot;หัวข้อที่ 3: ค้นหาและเลือกสินค้าเข้า List&quot;</span> ด้านล่าง เพื่อคลิกเพิ่มสินค้าที่ต้องการยืม
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
                              <div className="text-xs sm:text-sm font-bold text-foreground">{c.model}</div>
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
                <div className="mt-3.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-200">
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
            <div className="bg-card rounded-xl border border-border p-3 sm:p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-border/80 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                    <Package className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      3. ค้นหาและเลือกสินค้าเข้า List (Catalog Inventory)
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
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
                    เฉพาะพร้อมใช้ ({catalogs.filter((c) => c.available > 0).length})
                  </Button>
                </div>
              </div>

              {/* Search & Category Pills */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="พิมพ์ค้นหาชื่อรุ่น ยี่ห้อ หรือสเปก เช่น TC21, Zebra, PM85..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-10 rounded-xl text-xs sm:text-sm bg-background border-border"
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
                    className={`px-3 py-1 rounded-lg font-medium transition-smooth whitespace-nowrap ${
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    ทั้งหมด ({catalogs.length})
                  </button>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                    const count = catalogs.filter((c) => c.category === key).length
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayedCatalogs.map((c) => {
                    const inCart = !!cart[c.id]
                    const currentQty = cart[c.id]?.quantity || 0
                    const isAvailable = c.available > 0

                    return (
                      <div
                        key={c.id}
                        className={`rounded-xl border p-3.5 transition-all duration-200 flex flex-col justify-between ${
                          inCart
                            ? 'bg-primary/[0.04] border-primary/40 ring-2 ring-primary/20 shadow-xs'
                            : 'bg-card border-border hover:border-border/80 hover:shadow-xs'
                        }`}
                      >
                        {/* Top: Category & Stock Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <CategoryBadge category={c.category} />
                            {isAvailable ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                พร้อมใช้ {c.available}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                ของหมด
                              </span>
                            )}
                          </div>

                          {/* Brand & Model */}
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {c.brand}
                          </div>
                          <h3 className="text-xs sm:text-sm font-bold text-foreground mt-0.5 leading-snug line-clamp-1">
                            {c.model}
                          </h3>

                          {/* Stock Breakdown */}
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1.5 py-1 px-2 rounded-lg bg-muted/40">
                            <div>ทั้งหมด: <span className="font-semibold text-foreground">{c.total}</span></div>
                            <div>•</div>
                            <div>กำลังยืม: <span className="font-semibold text-amber-600">{c.onLoan}</span></div>
                          </div>

                          {/* Specs */}
                          {c.defaultSpecs && (
                            <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                              {c.defaultSpecs}
                            </p>
                          )}
                        </div>

                        {/* Bottom Action */}
                        <div className="mt-3 pt-2.5 border-t border-border/60">
                          {inCart ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-primary flex items-center gap-1">
                                <Check className="h-3.5 w-3.5" /> ใน List ({currentQty})
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addToCart(c)}
                                className="h-7 px-2.5 rounded-lg text-xs font-semibold gap-1"
                              >
                                <Plus className="h-3 w-3" /> เพิ่มอีก
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant={isAvailable ? 'default' : 'outline'}
                              onClick={() => addToCart(c)}
                              className={`w-full rounded-lg h-8 text-xs font-semibold gap-1.5 ${
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
              disabled={
                submitting ||
                cartItems.length === 0 ||
                (!customerCompany.trim() && !customerName.trim()) ||
                !salesRepName.trim() ||
                !expectedReturnDate
              }
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
