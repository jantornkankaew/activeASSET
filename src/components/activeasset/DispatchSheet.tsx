'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  LoanStatusBadge, PurposeBadge, SourceBadge, EmptyState, LoadingState,
} from './shared'
import { QuickRegisterForm } from './QuickRegisterForm'
import {
  ScanLine, CheckCircle2, AlertCircle, X, Camera, Plus, User,
  Package, ShoppingCart,
} from 'lucide-react'
import {
  formatThaiDate, SOURCE_LABELS,
} from '@/lib/activeasset-constants'

interface RequestLine {
  id: string
  catalogId: string
  model?: string
  brand?: string
  category?: string
  quantity: number
  fulfilledQty: number
  notes: string | null
  defaultAccessories: string[]
  catalog?: { model: string; brand: string; category: string; defaultAccessories: string[] }
}

interface LoanLineItem {
  id: string
  assetTagId: string
  serialNo: string
  model: string
  brand: string
  source: string
  status: string
}

interface LoanDetail {
  docNo: string
  customerName: string
  customerCompany: string | null
  customerIndustry: string | null
  salesRepName: string
  purpose: string
  expectedReturnDate: string
  status: string
  requestLines: RequestLine[]
  lines: LoanLineItem[]
}

interface AvailableAsset {
  tagId: string
  serialNo: string
  model: string
  brand: string
  source: string
  supplierName?: string | null
  supplierLoanDue?: string | null
  depositPrice?: number | null
  maxLoanCount?: number | null
  loanCount?: number
  location: { name: string; zone: string } | null
  defaultAccessories: string[]
}

interface DispatchSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanDetail | null
  onDone: () => void
}

// Phase 2: Store หยิบจริง + สแกน S/N + ถ่ายรูป + เพิ่ม add-on accessories + ระบุ source
export function DispatchSheet({ open, onOpenChange, loan, onDone }: DispatchSheetProps) {
  const { toast } = useToast()
  const [dispatchedBy, setDispatchedBy] = useState('เจ้าหน้าที่คลัง (Store)')
  const [availableByModel, setAvailableByModel] = useState<Record<string, AvailableAsset[]>>({})
  const [loadingAvail, setLoadingAvail] = useState(false)
  // pickedItems: keyed by requestLine.id → array of picked assets with photo + accessories + addOns
  const [pickedItems, setPickedItems] = useState<Record<string, {
    asset: AvailableAsset
    accessories: string[]
    addOnInput: string
    addOns: string[]
    photos: { photoPath: string; caption: string }[]
    source: string
    verified: boolean
  }>>({})
  const [scanInput, setScanInput] = useState('')
  const [scanForRequestId, setScanForRequestId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Quick register state
  const [quickRegisterFor, setQuickRegisterFor] = useState<string | null>(null) // requestLineId
  const [catalogs, setCatalogs] = useState<Array<{ id: string; model: string; brand: string; category: string; defaultAccessories: string[] }>>([])

  // โหลด catalogs ครั้งแรก
  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(d => setCatalogs(d.catalogs || []))
  }, [])

  // Load available assets when loan opens
  const loadAvailable = useCallback(async (requestLines: RequestLine[]) => {
    setLoadingAvail(true)
    const byModel: Record<string, AvailableAsset[]> = {}
    for (const rl of requestLines) {
      if (rl.fulfilledQty >= rl.quantity) continue
      // rl.model อาจเป็น undefined ในบางกรณี — ดึงจาก catalog แทน
      const model = rl.model || (rl as { catalog?: { model?: string } }).catalog?.model
      if (!model) {
        byModel[rl.id] = []
        continue
      }
      try {
        const res = await fetch(`/api/assets?catalogModel=${encodeURIComponent(model)}&status=Available`)
        const data = await res.json()
        byModel[rl.id] = (data.assets || []).map((a: AvailableAsset) => ({
          ...a,
          defaultAccessories: Array.isArray(a.defaultAccessories) ? a.defaultAccessories : [],
        }))
      } catch (e) {
        console.error('loadAvailable error for', model, e)
        byModel[rl.id] = []
      }
    }
    setAvailableByModel(byModel)
    setLoadingAvail(false)
  }, [])

  useEffect(() => {
    if (open && loan && loan.requestLines) {
      setDispatchedBy('เจ้าหน้าที่คลัง (Store)')
      setPickedItems({})
      loadAvailable(loan.requestLines)
    }
  }, [open, loan, loadAvailable])

  if (!loan) return null

  const toggleAccessory = (requestLineId: string, acc: string) => {
    setPickedItems((prev) => {
      const item = prev[requestLineId]
      if (!item) return prev
      const has = item.accessories.includes(acc)
      return {
        ...prev,
        [requestLineId]: {
          ...item,
          accessories: has ? item.accessories.filter((x) => x !== acc) : [...item.accessories, acc],
        },
      }
    })
  }
  const addAddOn = (requestLineId: string) => {
    const item = pickedItems[requestLineId]
    if (!item || !item.addOnInput.trim()) return
    setPickedItems((prev) => ({
      ...prev,
      [requestLineId]: {
        ...item,
        addOns: [...item.addOns, item.addOnInput.trim()],
        addOnInput: '',
      },
    }))
  }
  const removeAddOn = (requestLineId: string, addOn: string) => {
    const item = pickedItems[requestLineId]
    if (!item) return
    setPickedItems((prev) => ({
      ...prev,
      [requestLineId]: { ...item, addOns: item.addOns.filter((x) => x !== addOn) },
    }))
  }
  const pickAsset = (requestLineId: string, asset: AvailableAsset) => {
    setPickedItems((prev) => ({
      ...prev,
      [requestLineId]: {
        asset,
        accessories: [...asset.defaultAccessories],
        addOnInput: '',
        addOns: [],
        photos: [],
        source: asset.source,
        verified: false,
      },
    }))
    setScanForRequestId(requestLineId)
  }
  const removePicked = (requestLineId: string) => {
    setPickedItems((prev) => {
      const next = { ...prev }
      delete next[requestLineId]
      return next
    })
    if (scanForRequestId === requestLineId) setScanForRequestId(null)
  }
  const verifyScan = (requestLineId: string, input: string) => {
    const item = pickedItems[requestLineId]
    if (!item) return false
    const v = input.trim()
    if (v === item.asset.tagId || v === item.asset.serialNo) {
      setPickedItems((prev) => ({ ...prev, [requestLineId]: { ...item, verified: true } }))
      setScanInput('')
      setScanForRequestId(null)
      toast({ title: '✓ ยืนยันถูกต้อง', description: `${item.asset.tagId} — S/N ตรง` })
      return true
    }
    toast({ title: '✗ สแกนผิด', description: `"${v}" ไม่ตรงกับ ${item.asset.tagId}`, variant: 'destructive' })
    setScanInput('')
    return false
  }
  const uploadPhoto = async (requestLineId: string, file: File, caption: string) => {
    // convert to base64 → send to /api/uploads
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, caption }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setPickedItems((prev) => {
          const item = prev[requestLineId]
          if (!item) return prev
          return {
            ...prev,
            [requestLineId]: { ...item, photos: [...item.photos, { photoPath: data.path, caption }] },
          }
        })
        toast({ title: '✓ เพิ่มรูปสำเร็จ' })
      } catch (e: unknown) {
        toast({ title: 'อัปโหลดรูปไม่สำเร็จ', description: e instanceof Error ? e.message : '', variant: 'destructive' })
      }
    }
    reader.readAsDataURL(file)
  }

  const submit = async (complete: boolean) => {
    if (!loan) return
    const items = Object.entries(pickedItems).map(([requestLineId, item]) => ({
      requestLineId,
      assetTagId: item.asset.tagId,
      source: item.source,
      accessoriesHandedOver: [...item.accessories, ...item.addOns],
      photos: item.photos,
    }))
    if (items.length === 0) {
      toast({ title: 'ต้องสแกนเครื่องอย่างน้อย 1 เครื่อง', variant: 'destructive' })
      return
    }
    const unverified = items.filter((it) => !pickedItems[it.requestLineId].verified)
    if (unverified.length > 0) {
      toast({ title: `ต้องสแกนยืนยัน S/N อีก ${unverified.length} เครื่อง`, variant: 'destructive' })
      return
    }
    if (!dispatchedBy.trim()) {
      toast({ title: 'ต้องระบุชื่อเจ้าหน้าที่จัด', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loan.docNo}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatchedBy, items, complete }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: `✓ จัดเครื่องสำเร็จ (${items.length} เครื่อง)`,
        description: complete ? 'ใบยืนพร้อมส่งมอบ' : 'ยังจัดไม่ครบ — สามารถกลับมาจัดเพิ่มได้',
      })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const pendingRequestLines = loan.requestLines.filter((rl) => rl.fulfilledQty < rl.quantity)
  const allFulfilled = pendingRequestLines.length === 0
  const pickedCount = Object.keys(pickedItems).length
  const verifiedCount = Object.values(pickedItems).filter((x) => x.verified).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> จัดเครื่องจริง — {loan.docNo}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <LoanStatusBadge status={loan.status} />
            <span>{loan.customerName}{loan.customerCompany ? ` • ${loan.customerCompany}` : ''}</span>
            <span className="text-slate-400">•</span>
            <PurposeBadge purpose={loan.purpose} />
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {/* รายการที่ต้องจัด */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4" /> รายการที่ Sales ขอ ({pendingRequestLines.length} ค้าง)
              </h3>
              {pendingRequestLines.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> จัดครบทุกรายการแล้ว — กด "จัดเสร็จ พร้อมส่งมอบ" ด้านล่าง
                </div>
              )}
              <div className="space-y-2">
                {pendingRequestLines.map((rl) => {
                  const picked = pickedItems[rl.id]
                  const available = availableByModel[rl.id] || []
                  return (
                    <div key={rl.id} className="border rounded p-2.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm">{rl.brand || (rl as { catalog?: { brand?: string } }).catalog?.brand} {rl.model || (rl as { catalog?: { model?: string } }).catalog?.model}</span>
                            <Badge variant="outline" className="text-xs">
                              ขอ {rl.quantity} / จัดแล้ว {rl.fulfilledQty}
                            </Badge>
                            {picked?.verified && <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">สแกนยืนยันแล้ว</Badge>}
                          </div>
                          {rl.notes && <div className="text-xs text-slate-500 mt-0.5">หมายเหตุ: {rl.notes}</div>}
                        </div>
                      </div>

                      {/* Picked asset summary */}
                      {picked && (
                        <div className={`p-2 rounded border ${picked.verified ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} mb-2`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            {picked.verified ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                            <div className="flex-1">
                              <span className="font-mono text-sm">{picked.asset.tagId}</span>
                              <span className="text-xs text-slate-500 ml-2">S/N: {picked.asset.serialNo}</span>
                            </div>
                            <SourceBadge source={picked.source} />
                            <Button size="sm" variant="ghost" onClick={() => removePicked(rl.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Scan to verify */}
                          {!picked.verified && (
                            <div className="flex gap-1 mb-1.5">
                              <Input
                                autoFocus={scanForRequestId === rl.id}
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && scanInput.trim()) verifyScan(rl.id, scanInput) }}
                                placeholder={`สแกน ${picked.asset.tagId} หรือ ${picked.asset.serialNo}`}
                                className="h-8 bg-white text-xs"
                              />
                              <Button size="sm" className="h-8" onClick={() => scanInput.trim() && verifyScan(rl.id, scanInput)}>ยืนยัน</Button>
                            </div>
                          )}

                          {/* Accessories checklist + add-on */}
                          <div className="text-xs font-medium text-slate-700 mb-1">อุปกรณ์เสริม ({picked.accessories.length})</div>
                          <div className="space-y-1 mb-2">
                            {picked.asset.defaultAccessories.map((acc) => {
                              const checked = picked.accessories.includes(acc)
                              return (
                                <div key={acc} className={`flex items-center gap-1.5 p-1 rounded border text-xs ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                  <Checkbox checked={checked} onCheckedChange={() => toggleAccessory(rl.id, acc)} className="h-3 w-3" />
                                  <span className={checked ? 'text-emerald-700' : 'text-rose-700 line-through'}>{acc}</span>
                                </div>
                              )
                            })}
                          </div>
                          {/* Add-on accessories */}
                          <div className="text-xs font-medium text-slate-700 mb-1">อุปกรณ์เสริมเพิ่มเติม (Add-on)</div>
                          <div className="flex gap-1 mb-1">
                            <Input
                              value={picked.addOnInput}
                              onChange={(e) => setPickedItems((prev) => ({ ...prev, [rl.id]: { ...picked, addOnInput: e.target.value } }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAddOn(rl.id) } }}
                              placeholder="เช่น สาย HDMI, แบตสำรอง"
                              className="h-7 text-xs"
                            />
                            <Button size="sm" variant="outline" className="h-7" onClick={() => addAddOn(rl.id)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          {picked.addOns.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {picked.addOns.map((a) => (
                                <Badge key={a} variant="secondary" className="text-xs flex items-center gap-1">
                                  {a}
                                  <button onClick={() => removeAddOn(rl.id, a)}><X className="h-2.5 w-2.5" /></button>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Photos */}
                          <div className="text-xs font-medium text-slate-700 mb-1">รูปภาพสภาพสินค้า ({picked.photos.length})</div>
                          <input
                            ref={(el) => { fileInputRefs.current[rl.id] = el }}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) uploadPhoto(rl.id, f, 'สภาพก่อนส่งออก')
                              e.target.value = ''
                            }}
                          />
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileInputRefs.current[rl.id]?.click()}>
                            <Camera className="h-3 w-3 mr-1" /> ถ่ายรูป / เลือกไฟล์
                          </Button>
                          {picked.photos.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {picked.photos.map((p, i) => (
                                <div key={i} className="relative">
                                  <img src={p.photoPath} alt={p.caption} className="h-14 w-14 object-cover rounded border" />
                                  <button
                                    className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full h-4 w-4 text-xs"
                                    onClick={() => setPickedItems((prev) => ({ ...prev, [rl.id]: { ...picked, photos: picked.photos.filter((_, idx) => idx !== i) } }))}
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Available assets to pick */}
                      {!picked && (
                        <div className="space-y-1">
                          {loadingAvail && <div className="text-xs text-slate-400">กำลังโหลดเครื่องที่พร้อมใช้...</div>}
                          {!loadingAvail && available.length === 0 && (
                            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-1.5">
                              ไม่มีเครื่อง {rl.model || (rl as { catalog?: { model?: string } }).catalog?.model} ว่างในคลังเดโม
                            </div>
                          )}
                          {available.slice(0, 3).map((a) => (
                            <button
                              key={a.tagId}
                              onClick={() => pickAsset(rl.id, a)}
                              className="w-full text-left p-1.5 rounded border border-slate-200 hover:bg-slate-50 text-xs flex items-center gap-2"
                            >
                              <span className="font-mono">{a.tagId}</span>
                              <span className="text-slate-500">S/N: {a.serialNo}</span>
                              {a.location && <span className="text-slate-400">• {a.location.name}</span>}
                              <SourceBadge source={a.source} className="ml-auto" />
                              {/* แสดง loan count warning สำหรับ Supplier */}
                              {a.source === 'Supplier' && a.maxLoanCount && (
                                <Badge variant="outline" className={`text-xs ${a.loanCount >= a.maxLoanCount ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}`}>
                                  {a.loanCount}/{a.maxLoanCount}
                                </Badge>
                              )}
                            </button>
                          ))}
                          {available.length > 3 && (
                            <div className="text-xs text-slate-400 text-center">+{available.length - 3} รายการ</div>
                          )}
                        </div>
                      )}

                      {/* Quick register button — แสดงเสมอเมื่อยังจัดไม่ครบ (picked หรือไม่ก็ตาม) */}
                      {rl.fulfilledQty + (picked ? 1 : 0) < rl.quantity && !quickRegisterFor && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-xs border-purple-300 text-purple-700 hover:bg-purple-50 mt-1"
                          onClick={() => setQuickRegisterFor(rl.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> ยืมจาก Supplier / คลังขาย {available.length === 0 ? '(ไม่มีในคลังเดโม)' : '(เพิ่มเติม)'}
                        </Button>
                      )}

                      {/* Quick register form */}
                      {quickRegisterFor === rl.id && (
                        <QuickRegisterForm
                          open={true}
                          onClose={() => setQuickRegisterFor(null)}
                          defaultCatalogId={rl.catalogId}
                          catalogs={catalogs}
                          onRegistered={(asset) => {
                            // เพิ่มเครื่องใหม่เข้า available list แล้ว pick ทันที
                            setAvailableByModel(prev => ({
                              ...prev,
                              [rl.id]: [asset, ...(prev[rl.id] || [])],
                            }))
                            pickAsset(rl.id, asset)
                            setQuickRegisterFor(null)
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Already dispatched */}
            {loan.lines.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> จัดไปแล้ว ({loan.lines.length})
                </h3>
                <div className="space-y-1">
                  {loan.lines.map((line) => (
                    <div key={line.id} className="flex items-center gap-2 p-1.5 text-xs bg-slate-50 rounded">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="font-mono">{line.assetTagId}</span>
                      <span className="text-slate-600">{line.brand} {line.model}</span>
                      <SourceBadge source={line.source} className="ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div>
              <label className="text-xs text-slate-600">ชื่อเจ้าหน้าที่จัด <span className="text-rose-500">*</span></label>
              <div className="relative mt-1">
                <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input value={dispatchedBy} onChange={(e) => setDispatchedBy(e.target.value)} className="pl-7 h-9 text-sm" />
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t p-3 space-y-2">
          <div className="bg-slate-50 border rounded p-2 text-xs space-y-0.5">
            <div className="flex justify-between"><span>เลือกไป:</span> <b>{pickedCount} เครื่อง</b></div>
            <div className="flex justify-between"><span>สแกนยืนยันแล้ว:</span> <b>{verifiedCount} เครื่อง</b></div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => submit(false)}
              disabled={submitting || pickedCount === 0 || verifiedCount !== pickedCount}
            >
              บันทึก (ยังจัดไม่ครบ)
            </Button>
            <Button
              className="flex-1"
              onClick={() => submit(true)}
              disabled={submitting || pickedCount === 0 || verifiedCount !== pickedCount || !allFulfilled}
            >
              {submitting ? 'กำลังบันทึก...' : 'จัดเสร็จ พร้อมส่งมอบ'}
            </Button>
          </div>
          {!allFulfilled && (
            <p className="text-xs text-amber-700 text-center">
              ยังจัดไม่ครบ — กด "บันทึก" เพื่อเก็บสถานะกำลังจัด แล้วกลับมาต่อได้
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
