'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  Search, ShoppingCart, CheckCircle2, Package, ChevronRight, ArrowLeft,
  ScanLine, Smartphone, Share2, FileText, X, AlertCircle, User, Building2,
  Calendar, MessageCircle, Plus, Minus, CheckCheck
} from 'lucide-react'
import {
  ASSET_STATUS_LABELS, ASSET_TYPE_LABELS, CATEGORY_LABELS,
  getAssetStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime
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

type Step = 'catalog' | 'units' | 'cart' | 'success'

const AVAILABILITY_STYLE: Record<string, { dot: string; ring: string; label: string }> = {
  green: { dot: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'พร้อมเบิก' },
  yellow: { dot: 'bg-amber-500', ring: 'ring-amber-200', label: 'เหลือน้อย' },
  red: { dot: 'bg-rose-500', ring: 'ring-rose-200', label: 'หมด' },
}

export function SalesView() {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('catalog')
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [selectedCatalog, setSelectedCatalog] = useState<CatalogItem | null>(null)
  const [units, setUnits] = useState<AssetItem[]>([])
  const [unitsLoading, setUnitsLoading] = useState(false)

  // Cart
  const [cart, setCart] = useState<AssetItem[]>([])
  // Verified items: tagId → true (สแกน S/N แล้ว)
  const [verifiedItems, setVerifiedItems] = useState<Set<string>>(new Set())

  // Cart form
  const [customerName, setCustomerName] = useState('')
  const [customerCompany, setCustomerCompany] = useState('')
  const [salesRepName, setSalesRepName] = useState('')
  const [purpose, setPurpose] = useState('Demo')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [termsAndNotes, setTermsAndNotes] = useState('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม หากสูญหายต้องชดใช้ตามมูลค่าทรัพย์สิน')
  const [submitting, setSubmitting] = useState(false)
  const [createdDocNo, setCreatedDocNo] = useState<string | null>(null)

  const sigRef = useRef<SignaturePadHandle>(null)
  const [sigHasContent, setSigHasContent] = useState(false)

  // Load catalog
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

  // Load units of selected catalog
  const loadUnits = async (catalogModel: string) => {
    setUnitsLoading(true)
    const res = await fetch(`/api/assets?catalogModel=${encodeURIComponent(catalogModel)}`)
    const data = await res.json()
    setUnits(data.assets || [])
    setUnitsLoading(false)
  }

  const openCatalog = (c: CatalogItem) => {
    setSelectedCatalog(c)
    setStep('units')
    loadUnits(c.model)
  }

  const addToCart = (asset: AssetItem) => {
    if (cart.find((a) => a.tagId === asset.tagId)) return
    setCart([...cart, asset])
    toast({ title: `เพิ่ม ${asset.tagId} ลงตะกร้า`, description: `${asset.brand} ${asset.model} • S/N: ${asset.serialNo}` })
  }

  const removeFromCart = (tagId: string) => {
    setCart(cart.filter((a) => a.tagId !== tagId))
    const newVerified = new Set(verifiedItems)
    newVerified.delete(tagId)
    setVerifiedItems(newVerified)
  }

  const verifyItem = async (asset: AssetItem, scanInput: string): Promise<boolean> => {
    const input = scanInput.trim()
    if (!input) return false
    // ยอมรับทั้ง Tag ID และ S/N — แต่ต้องตรงกับเครื่องที่จะเบิก
    if (input === asset.tagId || input === asset.serialNo) {
      const newSet = new Set(verifiedItems)
      newSet.add(asset.tagId)
      setVerifiedItems(newSet)
      toast({
        title: '✓ ยืนยันถูกต้อง',
        description: `S/N ตรงกับกล่องเครื่องที่จะเบิกออก (${asset.tagId})`,
      })
      return true
    }
    toast({
      title: '✗ สแกนผิดกล่อง',
      description: `ค่าที่สแกน "${input}" ไม่ตรงกับ ${asset.tagId} หรือ ${asset.serialNo}`,
      variant: 'destructive',
    })
    return false
  }

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast({ title: 'กรุณาระบุชื่อลูกค้า', variant: 'destructive' })
      return
    }
    if (!salesRepName.trim()) {
      toast({ title: 'กรุณาระบุชื่อพนักงานขาย', variant: 'destructive' })
      return
    }
    if (!expectedReturnDate) {
      toast({ title: 'กรุณาระบุวันกำหนดคืน', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'ตะกร้าว่าง', variant: 'destructive' })
      return
    }
    // ตรวจว่าทุกเครื่องในตะกร้าถูกสแกนยืนยันแล้ว
    const unverified = cart.filter((a) => !verifiedItems.has(a.tagId))
    if (unverified.length > 0) {
      toast({
        title: `ต้องสแกนยืนยัน S/N อีก ${unverified.length} เครื่อง`,
        description: `เครื่องที่ยังไม่ยืนยัน: ${unverified.map((a) => a.tagId).join(', ')}`,
        variant: 'destructive',
      })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'ลูกค้าต้องลงลายมือชื่อก่อนยืนยัน', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerCompany,
          salesRepName,
          purpose,
          expectedReturnDate,
          termsAndNotes,
          customerSignature: sig,
          customerSignBy: customerName,
          items: cart.map((a) => ({
            tagId: a.tagId,
            accessoriesHandedOver: a.defaultAccessories,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'สร้างใบยืมไม่สำเร็จ')
      }
      setCreatedDocNo(data.loan.docNo)
      setStep('success')
      toast({ title: `สร้างใบยืมสำเร็จ: ${data.loan.docNo}`, description: `${cart.length} เครื่อง • ลูกค้า: ${customerName}` })
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetAll = () => {
    setStep('catalog')
    setSelectedCatalog(null)
    setCart([])
    setVerifiedItems(new Set())
    setCustomerName('')
    setCustomerCompany('')
    setSalesRepName('')
    setPurpose('Demo')
    setExpectedReturnDate('')
    setTermsAndNotes('ผู้ยืมรับผิดชอบความเสียหายที่เกิดขึ้นระหว่างการยืม หากสูญหายต้องชดใช้ตามมูลค่าทรัพย์สิน')
    setCreatedDocNo(null)
    sigRef.current?.clear()
    setSigHasContent(false)
  }

  const shareToLINE = () => {
    if (!createdDocNo) return
    const text =
      `ใบยืมทรัพย์สิน activeASSET\n` +
      `เลขที่: ${createdDocNo}\n` +
      `ลูกค้า: ${customerName}${customerCompany ? ' (' + customerCompany + ')' : ''}\n` +
      `พนักงาน: ${salesRepName}\n` +
      `วัตถุประสงค์: ${getPurposeLabel(purpose)}\n` +
      `กำหนดคืน: ${formatThaiDate(expectedReturnDate)}\n` +
      `จำนวน: ${cart.length} เครื่อง\n` +
      `\nรายการเครื่อง:\n` +
      cart.map((a, i) => `${i + 1}. ${a.tagId} | ${a.brand} ${a.model} | S/N: ${a.serialNo}`).join('\n') +
      `\n\n— ส่งจากระบบ activeASSET`
    // เปิด LINE share (เป็นข้อความ — ตามข้อจำกัดของ Phase 1)
    const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const brands = Array.from(new Set(catalogs.map((c) => c.brand)))
  const categories = Array.from(new Set(catalogs.map((c) => c.category)))

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
        <StepBadge active={step === 'catalog'} done={step !== 'catalog'} num={1} label="เลือกรุ่น" />
        <ChevronRight className="h-3 w-3" />
        <StepBadge active={step === 'units'} done={step === 'cart' || step === 'success'} num={2} label="เลือกเครื่อง + สแกนยืนยัน" />
        <ChevronRight className="h-3 w-3" />
        <StepBadge active={step === 'cart'} done={step === 'success'} num={3} label="กรอกข้อมูล + ลูกค้าเซ็น" />
        <ChevronRight className="h-3 w-3" />
        <StepBadge active={step === 'success'} done={step === 'success'} num={4} label="เสร็จสิ้น + แชร์ LINE" />
      </div>

      {/* STEP 1: Catalog cards */}
      {step === 'catalog' && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหารุ่นหรือยี่ห้อ เช่น EDA52, Honeywell, Zebra..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="ยี่ห้อ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ยี่ห้อทั้งหมด</SelectItem>
                    {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">หมวดหมู่ทั้งหมด</SelectItem>
                    {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading && <p className="col-span-full text-center text-slate-500 py-8">กำลังโหลด...</p>}
            {!loading && catalogs.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>ไม่พบรุ่นที่ตรงกับเงื่อนไข</p>
              </div>
            )}
            {catalogs.map((c) => {
              const av = AVAILABILITY_STYLE[c.availabilityLevel]
              return (
                <Card
                  key={c.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ring-2 ${av.ring} ${c.available === 0 ? 'opacity-60' : ''}`}
                  onClick={() => c.available > 0 && openCatalog(c)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-xs text-slate-500">{c.brand}</div>
                        <h3 className="font-semibold text-slate-900 text-lg leading-tight">{c.model}</h3>
                        <div className="text-xs text-slate-500 mt-1">{CATEGORY_LABELS[c.category] || c.category}</div>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border ${av.ring}`}>
                        <span className={`h-2 w-2 rounded-full ${av.dot}`} />
                        <span className="text-xs font-medium text-slate-700">{av.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-3">
                      <span className="font-bold text-emerald-600 text-lg">{c.available}</span>
                      <span className="text-slate-400">/ {c.total} เครื่อง</span>
                      <span className="text-slate-300 mx-1">•</span>
                      <span className="text-xs text-amber-600">ยืม {c.onLoan}</span>
                      {c.inRepair > 0 && <span className="text-xs text-purple-600">ซ่อม {c.inRepair}</span>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Unit drill-down + scan verify */}
      {step === 'units' && selectedCatalog && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep('catalog')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
            </Button>
            <div className="flex-1">
              <div className="text-xs text-slate-500">{selectedCatalog.brand}</div>
              <h2 className="text-xl font-semibold">{selectedCatalog.model}</h2>
            </div>
            <Button
              onClick={() => setStep('cart')}
              disabled={cart.length === 0}
              className="relative"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              ตะกร้า ({cart.length})
            </Button>
          </div>

          {selectedCatalog.defaultSpecs && (
            <Card>
              <CardContent className="p-3 text-sm text-slate-600">
                <span className="font-medium text-slate-700">สเปกมาตรฐาน: </span>
                {selectedCatalog.defaultSpecs}
              </CardContent>
            </Card>
          )}

          {selectedCatalog.defaultAccessories.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="text-xs font-medium text-slate-500 mb-2">อุปกรณ์เสริมมาตรฐานในชุด</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCatalog.defaultAccessories.map((a) => (
                    <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> เครื่องจริงทั้งหมด ({units.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[480px]">
                <div className="divide-y">
                  {unitsLoading && <p className="p-4 text-center text-slate-500">กำลังโหลด...</p>}
                  {!unitsLoading && units.length === 0 && <p className="p-4 text-center text-slate-500">ไม่มีเครื่อง</p>}
                  {units.map((u) => {
                    const inCart = cart.find((a) => a.tagId === u.tagId)
                    const verified = verifiedItems.has(u.tagId)
                    const st = getAssetStatusLabel(u.status)
                    return (
                      <UnitRow
                        key={u.tagId}
                        asset={u}
                        inCart={!!inCart}
                        verified={verified}
                        onAdd={() => addToCart(u)}
                        onRemove={() => removeFromCart(u.tagId)}
                        onVerify={(input) => verifyItem(u, input)}
                      />
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3: Cart + form + signature */}
      {step === 'cart' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStep('units')}>
                <ArrowLeft className="h-4 w-4 mr-1" /> เพิ่มเครื่อง
              </Button>
              <h2 className="text-xl font-semibold flex-1">ตะกร้ายืม ({cart.length} เครื่อง)</h2>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {cart.length === 0 && (
                    <p className="p-6 text-center text-slate-500">ยังไม่มีเครื่องในตะกร้า</p>
                  )}
                  {cart.map((a) => {
                    const verified = verifiedItems.has(a.tagId)
                    return (
                      <div key={a.tagId} className="p-4 flex items-start gap-3">
                        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${verified ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          {verified ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-semibold text-slate-900">{a.tagId}</span>
                            <Badge variant="outline" className="text-xs">{a.brand} {a.model}</Badge>
                            {verified && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">สแกนยืนยันแล้ว</Badge>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">S/N: <span className="font-mono">{a.serialNo}</span></div>
                          {!verified && (
                            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                              ยังไม่ได้สแกนยืนยัน — กลับไปยืนยันในขั้นตอนเลือกเครื่อง
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(a.tagId)}>
                          <X className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">ข้อมูลใบยืม</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">ชื่อลูกค้า <span className="text-rose-500">*</span></label>
                  <div className="relative mt-1">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="เช่น คุณสมชาย" className="pl-8" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">บริษัท</label>
                  <div className="relative mt-1">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} placeholder="เช่น บจก. ..." className="pl-8" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">พนักงานขาย <span className="text-rose-500">*</span></label>
                  <Input value={salesRepName} onChange={(e) => setSalesRepName(e.target.value)} placeholder="เช่น สมหญิง (Sales)" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">วัตถุประสงค์</label>
                  <Select value={purpose} onValueChange={setPurpose}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Demo">เดโมให้ลูกค้า</SelectItem>
                      <SelectItem value="Standby_Repair">เครื่องสำรองระหว่างซ่อม</SelectItem>
                      <SelectItem value="Internal_Test">ทดสอบภายใน (POC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">วันกำหนดคืน <span className="text-rose-500">*</span></label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} className="pl-8" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">เงื่อนไข/หมายเหตุ</label>
                  <textarea
                    className="w-full mt-1 border rounded-md p-2 text-sm min-h-[60px] resize-y"
                    value={termsAndNotes}
                    onChange={(e) => setTermsAndNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <SignaturePad ref={sigRef} label="ลายมือชื่อลูกค้า" required onChange={setSigHasContent} />
                <p className="text-xs text-slate-400 mt-2">ประทับเวลาดิจิทัล: {new Date().toLocaleString('th-TH')}</p>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0 || !sigHasContent || !customerName || !salesRepName || !expectedReturnDate}
            >
              {submitting ? 'กำลังสร้างใบยืม...' : <><FileText className="h-4 w-4 mr-2" /> ยืนยันสร้างใบยืม</>}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              ระบบจะล็อคเอกสารด้วย Digital Timestamp ไม่ให้แก้ไขหลังยืนยัน
            </p>
          </div>
        </div>
      )}

      {/* STEP 4: Success */}
      {step === 'success' && createdDocNo && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-emerald-800">สร้างใบยืมสำเร็จ</h2>
              <p className="text-emerald-700 mt-1">เลขที่เอกสาร</p>
              <p className="text-3xl font-mono font-bold text-emerald-900 mt-1">{createdDocNo}</p>
              <p className="text-sm text-emerald-700 mt-3">
                {cart.length} เครื่อง • {customerName}{customerCompany ? ` (${customerCompany})` : ''}<br />
                กำหนดคืน: {formatThaiDate(expectedReturnDate)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">รายการเครื่องที่ยืม</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {cart.map((a, i) => (
                  <div key={a.tagId} className="p-3 flex items-center gap-3 text-sm">
                    <span className="text-slate-400 text-xs">{i + 1}.</span>
                    <div className="flex-1">
                      <div className="font-mono font-semibold">{a.tagId}</div>
                      <div className="text-xs text-slate-500">{a.brand} {a.model} • S/N: <span className="font-mono">{a.serialNo}</span></div>
                    </div>
                    <Badge variant="secondary" className="text-xs">เบิกออก</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={shareToLINE} className="flex-1 bg-[#06C755] hover:bg-[#05b04b]">
              <MessageCircle className="h-4 w-4 mr-2" /> ส่งเข้า LINE
            </Button>
            <Button onClick={resetAll} variant="outline" className="flex-1">
              <Plus className="h-4 w-4 mr-2" /> สร้างใบยืมใหม่
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StepBadge({ active, done, num, label }: { active: boolean; done: boolean; num: number; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${active ? 'bg-slate-900 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-white text-slate-900' : done ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
        {done ? '✓' : num}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  )
}

// === Unit Row with inline scan-to-verify ===
function UnitRow({
  asset, inCart, verified, onAdd, onRemove, onVerify,
}: {
  asset: AssetItem
  inCart: boolean
  verified: boolean
  onAdd: () => void
  onRemove: () => void
  onVerify: (input: string) => Promise<boolean>
}) {
  const [scanOpen, setScanOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const st = getAssetStatusLabel(asset.status)
  const available = asset.status === 'Available'

  return (
    <div className={`p-4 ${!available ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-slate-900">{asset.tagId}</span>
            <Badge variant="outline" className={`text-xs ${st.color} ${st.bg}`}>{st.label}</Badge>
            {asset.conditionGrade && <Badge variant="outline" className="text-xs">Grade {asset.conditionGrade}</Badge>}
            {asset.assetType === 'Vendor_Demo' && <Badge variant="outline" className="text-xs text-purple-700">เดโม</Badge>}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            S/N: <span className="font-mono">{asset.serialNo}</span>
          </div>
          {asset.location && (
            <div className="text-xs text-slate-500 mt-0.5">📍 {asset.location.name}</div>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end">
          {inCart ? (
            <>
              {verified ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" /> ยืนยันแล้ว</Badge>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setScanOpen(!scanOpen)}>
                  <ScanLine className="h-4 w-4 mr-1" /> สแกนยืนยัน
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onRemove}><Minus className="h-3 w-3 mr-1" /> เอาออก</Button>
            </>
          ) : (
            <Button size="sm" disabled={!available} onClick={onAdd}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่ม
            </Button>
          )}
        </div>
      </div>

      {scanOpen && inCart && !verified && (
        <div className="mt-3 ml-1 p-3 border-2 border-dashed border-amber-300 rounded-md bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-800">สแกน S/N หรือ Tag ID บนกล่องเครื่องจริง</span>
          </div>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && scanInput.trim()) {
                  const ok = await onVerify(scanInput)
                  if (ok) {
                    setScanOpen(false)
                    setScanInput('')
                  } else {
                    setScanInput('')
                  }
                }
              }}
              placeholder={`สแกนบาร์โค้ด... (คาดว่า: ${asset.tagId} หรือ ${asset.serialNo})`}
              className="bg-white"
            />
            <Button
              size="sm"
              onClick={async () => {
                if (scanInput.trim()) {
                  const ok = await onVerify(scanInput)
                  if (ok) { setScanOpen(false); setScanInput('') } else { setScanInput('') }
                }
              }}
            >
              ยืนยัน
            </Button>
          </div>
          <p className="text-xs text-amber-700 mt-2">
            หากสแกนถูก: ✓ สีเขียว<br />
            หากสแกนผิดกล่อง: ✗ สีแดง — ป้องกันการหยิบกล่องผิดเครื่อง
          </p>
        </div>
      )}
    </div>
  )
}
