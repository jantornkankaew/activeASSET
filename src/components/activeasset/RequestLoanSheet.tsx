'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  EmptyState, LoadingState, CategoryBadge,
} from './shared'
import {
  Search, ShoppingCart, Plus, Minus, X, User, Building2,
  Calendar, FileText, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import {
  PURPOSE_LABELS, INDUSTRY_LABELS, formatThaiDate,
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

// Phase 1: Sales ขอยืมเป็นรุ่น + จำนวน (ไม่ต้องเลือก serial)
export function RequestLoanSheet({ open, onOpenChange, onCreated }: RequestLoanSheetProps) {
  const { toast } = useToast()
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, { catalog: CatalogItem; quantity: number; notes: string }>>({})

  // Form
  const [customerName, setCustomerName] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [customerIndustry, setCustomerIndustry] = useState('Logistics')
  const [salesRepName, setSalesRepName] = useState('')
  const [purpose, setPurpose] = useState('Demo')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [termsAndNotes, setTermsAndNotes] = useState('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม')
  const [submitting, setSubmitting] = useState(false)

  const loadCatalogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/catalog?${params.toString()}`)
    const data = await res.json()
    setCatalogs(data.catalogs || [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    if (open) {
      const t = setTimeout(loadCatalogs, 250)
      return () => clearTimeout(t)
    }
  }, [open, loadCatalogs])

  const addToCart = (c: CatalogItem) => {
    setCart((prev) => ({ ...prev, [c.id]: { catalog: c, quantity: 1, notes: '' } }))
  }
  const updateQty = (id: string, qty: number) => {
    setCart((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.max(1, qty) } }))
  }
  const updateNotes = (id: string, notes: string) => {
    setCart((prev) => ({ ...prev, [id]: { ...prev[id], notes } }))
  }
  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const cartItems = Object.values(cart)
  const totalRequested = cartItems.reduce((s, x) => s + x.quantity, 0)
  const hasShortfall = cartItems.some(x => x.quantity > x.catalog.available)
  const shortfallItems = cartItems.filter(x => x.quantity > x.catalog.available)

  const reset = () => {
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
    if (!customerName.trim() || !salesRepName.trim() || !expectedReturnDate) {
      toast({ title: 'กรอกข้อมูลไม่ครบ', variant: 'destructive' })
      return
    }
    if (cartItems.length === 0) {
      toast({ title: 'ตะกร้าว่าง', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName, customerCompany, customerIndustry,
          salesRepName, purpose,
          expectedReturnDate,
          termsAndNotes,
          items: cartItems.map((x) => ({
            catalogId: x.catalog.id,
            quantity: x.quantity,
            notes: x.notes || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'สร้างคำขอไม่สำเร็จ')
      toast({
        title: `✓ สร้างคำขอยืมสำเร็จ: ${data.loan.docNo}`,
        description: data.queued
          ? `ติดคิว Waiting List ${shortfallItems.length} รุ่น (ขอเกินสต็อก)`
          : `รอเจ้าหน้าที่คลังจัดเครื่อง — ${totalRequested} เครื่อง`,
      })
      onCreated(data.loan.docNo, data.queued)
      onOpenChange(false)
      reset()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> ขอยืมสินค้า (Phase 1)
          </SheetTitle>
          <SheetDescription>
            เลือกรุ่น + จำนวนที่ต้องการ → ระบบจะแจ้งเจ้าหน้าที่คลังไปหยิบจริง
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Browse */}
          <div className="border-b">
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ค้นหารุ่น / ยี่ห้อ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <ScrollArea className="h-[260px] border-t">
              <div className="divide-y">
                {loading && <LoadingState />}
                {!loading && catalogs.length === 0 && <EmptyState message="ไม่พบรุ่นสินค้า" />}
                {catalogs.map((c) => {
                  const inCart = !!cart[c.id]
                  return (
                    <div key={c.id} className={`p-2.5 flex items-center gap-2 text-sm ${inCart ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{c.brand} {c.model}</span>
                          <CategoryBadge category={c.category} />
                          {inCart && <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ในตะกร้า</Badge>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className={c.available > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            พร้อมใช้ {c.available}
                          </span>
                          <span>•</span>
                          <span>ทั้งหมด {c.total}</span>
                          {c.onLoan > 0 && <span className="text-amber-600">• ยืม {c.onLoan}</span>}
                        </div>
                      </div>
                      {inCart ? (
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(c.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => addToCart(c)}>
                          <Plus className="h-3 w-3 mr-1" /> เพิ่ม
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Cart + form */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                  <ShoppingCart className="h-4 w-4" /> รายการขอยืม ({cartItems.length})
                </h3>
                {cartItems.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 border-2 border-dashed rounded">
                    ยังไม่มีรายการ — เลือกรุ่นจากด้านบน
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {cartItems.map(({ catalog: c, quantity, notes }) => {
                      const short = quantity > c.available
                      return (
                        <div key={c.id} className={`p-2 border rounded ${short ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{c.brand} {c.model}</div>
                              <div className="text-xs text-slate-500">
                                พร้อมใช้ {c.available} {short && <span className="text-rose-600">• ขอเกิน {quantity - c.available} ชิ้น</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(c.id, quantity - 1)}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                value={quantity}
                                onChange={(e) => updateQty(c.id, parseInt(e.target.value) || 1)}
                                className="h-7 w-14 text-center text-sm"
                              />
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(c.id, quantity + 1)}>
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeFromCart(c.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            placeholder="หมายเหตุ เช่น เอาแบบมี Cradle"
                            value={notes}
                            onChange={(e) => updateNotes(c.id, e.target.value)}
                            className="h-7 mt-1 text-xs"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
                {hasShortfall && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <b>รุ่นที่ขอเกินสต็อกจะเข้าคิว Waiting List อัตโนมัติ</b><br />
                      เมื่อมีเครื่องคืน + ผ่านการตรวจสภาพ → ระบบแจ้งคนถัดไป
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Form */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium">ข้อมูลใบยืม</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-600">ชื่อลูกค้า <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="คุณ..." className="pl-7 h-9 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">บริษัท</label>
                    <div className="relative">
                      <Building2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="บจก. ..." className="pl-7 h-9 text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">อุตสาหกรรม</label>
                    <Select value={customerIndustry} onValueChange={setCustomerIndustry}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(INDUSTRY_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">พนักงาน <span className="text-rose-500">*</span></label>
                    <Input value={salesRepName} onChange={(e) => setSalesRepName(e.target.value)} placeholder="สมหญิง (Sales)" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">วัตถุประสงค์</label>
                    <Select value={purpose} onValueChange={setPurpose}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">กำหนดคืน <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} className="pl-7 h-9 text-sm" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600">เงื่อนไข/หมายเหตุ</label>
                  <textarea
                    className="w-full mt-1 border rounded p-2 text-xs min-h-[50px] resize-y"
                    value={termsAndNotes}
                    onChange={(e) => setTermsAndNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t p-3 space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="w-1/3"
                onClick={() => onOpenChange(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting || cartItems.length === 0 || !customerName || !salesRepName || !expectedReturnDate}
              >
                {submitting ? 'กำลังสร้าง...' : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    ส่งคำขอยืม ({totalRequested} เครื่อง)
                    {hasShortfall && <Clock className="h-4 w-4 ml-2" />}
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500 text-center">
              ระบบจะแจ้งเจ้าหน้าที่คลังไปหยิบเครื่องจริง + สแกน S/N + ถ่ายรูป
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
