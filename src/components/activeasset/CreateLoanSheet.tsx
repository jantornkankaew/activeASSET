'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  AssetStatusBadge, CategoryBadge, EmptyState, LoadingState,
} from './shared'
import {
  Search, ShoppingCart, CheckCircle2, ScanLine, X, Plus, Minus,
  User, Building2, Calendar, FileText, AlertCircle, ChevronRight, Package,
} from 'lucide-react'
import {
  getAssetStatusLabel, getPurposeLabel, formatThaiDate,
} from '@/lib/activeasset-constants'

interface AssetItem {
  tagId: string
  serialNo: string
  model: string
  brand: string
  category: string
  assetType: string
  status: string
  conditionGrade: string | null
  location: { name: string; zone: string } | null
  registeredAccessories: string[]
  defaultAccessories: string[]
  purchaseDate: string | null
  warrantyExpireDate: string | null
}

interface CreateLoanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (docNo: string) => void
}

// CreateLoanSheet — รวมขั้นตอนเดิม 4 ขั้นเป็น 2 ส่วนใน sheet เดียว
// ส่วนซ้าย: browser ทรัพย์สิน + ตะกร้า (รวม scan verify)
// ส่วนขวา: ฟอร์มข้อมูล + ลายเซ็น
export function CreateLoanSheet({ open, onOpenChange, onCreated }: CreateLoanSheetProps) {
  const { toast } = useToast()
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [cart, setCart] = useState<AssetItem[]>([])
  const [verifiedItems, setVerifiedItems] = useState<Set<string>>(new Set())
  const [scanOpenFor, setScanOpenFor] = useState<string | null>(null)
  const [scanInput, setScanInput] = useState('')

  // Form
  const [customerName, setCustomerName] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [salesRepName, setSalesRepName] = useState('')
  const [purpose, setPurpose] = useState('Demo')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [termsAndNotes, setTermsAndNotes] = useState('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม หากสูญหายต้องชดใช้ตามมูลค่าทรัพย์สิน')
  const [submitting, setSubmitting] = useState(false)

  const sigRef = useRef<SignaturePadHandle>(null)
  const [sigHasContent, setSigHasContent] = useState(false)

  const loadAssets = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('status', 'Available') // เฉพาะของว่าง
    if (search) params.set('catalogModel', search)
    if (brandFilter !== 'all') {
      // ใช้ search แทนเพราะ API ของเราไม่มี brand filter โดยตรง
    }
    const res = await fetch(`/api/assets?${params.toString()}`)
    const data = await res.json()
    let list: AssetItem[] = data.assets || []
    if (brandFilter !== 'all') list = list.filter((a) => a.brand === brandFilter)
    if (categoryFilter !== 'all') list = list.filter((a) => a.category === categoryFilter)
    if (search && !list.length) {
      // ลอง search by serial no
      const r2 = await fetch(`/api/assets?status=Available&serialNo=${encodeURIComponent(search)}`)
      const d2 = await r2.json()
      list = d2.assets || []
    }
    setAssets(list)
    setLoading(false)
  }, [search, brandFilter, categoryFilter])

  useEffect(() => {
    if (open) {
      const t = setTimeout(loadAssets, 250)
      return () => clearTimeout(t)
    }
  }, [open, loadAssets])

  const brands = Array.from(new Set(assets.map((a) => a.brand)))
  const categories = Array.from(new Set(assets.map((a) => a.category)))

  const addToCart = (asset: AssetItem) => {
    if (cart.find((a) => a.tagId === asset.tagId)) return
    setCart([...cart, asset])
  }
  const removeFromCart = (tagId: string) => {
    setCart(cart.filter((a) => a.tagId !== tagId))
    const nv = new Set(verifiedItems)
    nv.delete(tagId)
    setVerifiedItems(nv)
  }
  const verifyItem = (asset: AssetItem, input: string) => {
    const v = input.trim()
    if (!v) return false
    if (v === asset.tagId || v === asset.serialNo) {
      const ns = new Set(verifiedItems)
      ns.add(asset.tagId)
      setVerifiedItems(ns)
      setScanOpenFor(null)
      setScanInput('')
      toast({ title: '✓ ยืนยันถูกต้อง', description: `${asset.tagId} — S/N ตรงกับกล่อง` })
      return true
    }
    toast({ title: '✗ สแกนผิดกล่อง', description: `"${v}" ไม่ตรงกับ ${asset.tagId}`, variant: 'destructive' })
    setScanInput('')
    return false
  }

  const reset = () => {
    setCart([])
    setVerifiedItems(new Set())
    setScanOpenFor(null)
    setScanInput('')
    setCustomerName('')
    setCustomerCompany('')
    setSalesRepName('')
    setPurpose('Demo')
    setExpectedReturnDate('')
    setTermsAndNotes('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม หากสูญหายต้องชดใช้ตามมูลค่าทรัพย์สิน')
    sigRef.current?.clear()
    setSigHasContent(false)
  }

  const handleSubmit = async () => {
    if (!customerName.trim() || !salesRepName.trim() || !expectedReturnDate) {
      toast({ title: 'กรอกข้อมูลไม่ครบ', description: 'ต้องระบุชื่อลูกค้า พนักงาน และวันกำหนดคืน', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'ตะกร้าว่าง', variant: 'destructive' })
      return
    }
    const unverified = cart.filter((a) => !verifiedItems.has(a.tagId))
    if (unverified.length > 0) {
      toast({ title: `ต้องสแกนยืนยัน S/N อีก ${unverified.length} เครื่อง`, variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'ลูกค้าต้องลงลายมือชื่อ', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName, customerCompany, salesRepName, purpose,
          expectedReturnDate, termsAndNotes,
          customerSignature: sig, customerSignBy: customerName,
          items: cart.map((a) => ({ tagId: a.tagId, accessoriesHandedOver: a.defaultAccessories })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'สร้างใบยืมไม่สำเร็จ')
      toast({ title: `✓ สร้างใบยืมสำเร็จ: ${data.loan.docNo}`, description: `${cart.length} เครื่อง • ลูกค้า: ${customerName}` })
      onCreated(data.loan.docNo)
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
            <ShoppingCart className="h-4 w-4" /> สร้างใบยืมใหม่
          </SheetTitle>
          <SheetDescription>
            เลือกเครื่องจากรายการ → สแกน S/N ยืนยัน → ลูกค้าเซ็นรับ
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Browse section */}
          <div className="border-b">
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหารุ่น / S/N..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-28 h-9"><SelectValue placeholder="ยี่ห้อ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ยี่ห้อทั้งหมด</SelectItem>
                    {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-32 h-9"><SelectValue placeholder="หมวด" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">หมวดทั้งหมด</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-slate-500">
                แสดงเฉพาะทรัพย์สินสถานะ "พร้อมใช้" — เลือกแล้วคลิก <Plus className="inline h-3 w-3" /> เพื่อเพิ่มลงตะกร้า
              </div>
            </div>
            <ScrollArea className="h-[280px] border-t">
              <div className="divide-y">
                {loading && <LoadingState />}
                {!loading && assets.length === 0 && <EmptyState icon={<Package className="h-10 w-10" />} message="ไม่พบทรัพย์สินที่พร้อมใช้" />}
                {assets.map((a) => {
                  const inCart = cart.find((x) => x.tagId === a.tagId)
                  return (
                    <div key={a.tagId} className={`p-2.5 flex items-center gap-2 text-sm ${inCart ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-medium">{a.tagId}</span>
                          <Badge variant="outline" className="text-xs">{a.brand} {a.model}</Badge>
                          {inCart && <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ในตะกร้า</Badge>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">S/N: <span className="font-mono">{a.serialNo}</span></div>
                      </div>
                      {inCart ? (
                        <Button size="sm" variant="ghost" onClick={() => removeFromCart(a.tagId)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => addToCart(a)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Cart + form section */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" /> ตะกร้า ({cart.length})
                  </h3>
                  {cart.length > 0 && (
                    <span className="text-xs text-slate-500">
                      ยืนยันแล้ว {verifiedItems.size}/{cart.length}
                    </span>
                  )}
                </div>
                {cart.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 border-2 border-dashed rounded">
                    ยังไม่มีเครื่องในตะกร้า — เลือกจากรายการด้านบน
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {cart.map((a) => {
                      const verified = verifiedItems.has(a.tagId)
                      const scanOpen = scanOpenFor === a.tagId
                      return (
                        <div key={a.tagId} className={`p-2 border rounded ${verified ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                          <div className="flex items-center gap-2">
                            {verified ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-sm">{a.tagId}</span>
                                <Badge variant="outline" className="text-xs">{a.brand} {a.model}</Badge>
                              </div>
                              <div className="text-xs text-slate-500">S/N: <span className="font-mono">{a.serialNo}</span></div>
                            </div>
                            {verified ? (
                              <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">ยืนยันแล้ว</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setScanOpenFor(scanOpen ? null : a.tagId)}>
                                <ScanLine className="h-3 w-3 mr-1" /> สแกน
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => removeFromCart(a.tagId)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {scanOpen && !verified && (
                            <div className="mt-2 flex gap-1">
                              <Input
                                autoFocus
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && scanInput.trim()) verifyItem(a, scanInput) }}
                                placeholder={`สแกน ${a.tagId} หรือ ${a.serialNo}`}
                                className="h-8 bg-white text-xs"
                              />
                              <Button size="sm" className="h-8" onClick={() => scanInput.trim() && verifyItem(a, scanInput)}>ยืนยัน</Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
                    <label className="text-xs text-slate-600">พนักงาน <span className="text-rose-500">*</span></label>
                    <Input value={salesRepName} onChange={(e) => setSalesRepName(e.target.value)} placeholder="สมหญิง (Sales)" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">วัตถุประสงค์</label>
                    <Select value={purpose} onValueChange={setPurpose}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Demo">เดโมให้ลูกค้า</SelectItem>
                        <SelectItem value="Standby_Repair">เครื่องสำรองซ่อม</SelectItem>
                        <SelectItem value="Internal_Test">ทดสอบภายใน</SelectItem>
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

              <Separator />

              {/* Signature */}
              <div>
                <SignaturePad ref={sigRef} label="ลายมือชื่อลูกค้า" required height={120} onChange={setSigHasContent} />
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-3 space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0 || !sigHasContent || !customerName || !salesRepName || !expectedReturnDate}
            >
              {submitting ? 'กำลังสร้าง...' : <><FileText className="h-4 w-4 mr-2" /> ยืนยันสร้างใบยืม ({cart.length} เครื่อง)</>}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              ระบบล็อคเอกสารด้วย Digital Timestamp ไม่ให้แก้ไขหลังยืนยัน
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
