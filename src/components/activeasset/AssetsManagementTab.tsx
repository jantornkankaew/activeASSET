'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  AssetStatusBadge, SourceBadge, EmptyState, LoadingState,
} from './shared'
import { PushNotificationManager } from '@/components/pwa/PushNotificationManager'
import {
  Plus, Search, Package, Building2, X, AlertTriangle, ArrowLeft,
  CheckCircle2, Trash2,
} from 'lucide-react'
import {
  ASSET_STATUS_LABELS, SOURCE_LABELS,
} from '@/lib/activeasset-constants'

interface AssetItem {
  tagId: string
  serialNo: string
  model: string
  brand: string
  category: string
  source: string
  supplierId: string | null
  supplierName: string | null
  supplierLoanStart: string | null
  supplierLoanDue: string | null
  depositPrice: number | null
  maxLoanCount: number | null
  loanCount: number
  status: string
  conditionGrade: string | null
  location: { name: string; zone: string } | null
  catalogId: string
}

interface CatalogItem {
  id: string
  model: string
  brand: string
  category: string
  defaultAccessories: string[]
}

interface Supplier {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  assetCount: number
  activeLoanCount: number
  returnedCount: number
}

type View = 'list' | 'register' | 'suppliers'

export function AssetsManagementTab() {
  const { toast } = useToast()
  const [view, setView] = useState<View>('list')
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('serialNo', search)
    if (sourceFilter !== 'all') params.set('source', sourceFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/assets?${params.toString()}`)
    const data = await res.json()
    let list: AssetItem[] = data.assets || []
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.tagId.toLowerCase().includes(q) ||
        a.serialNo.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q)
      )
    }
    setAssets(list)
    setLoading(false)
  }, [search, sourceFilter, statusFilter])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" /> จัดการสินค้า (Admin)
        </h2>
        <div className="flex gap-2">
          <Button variant={view === 'suppliers' ? 'default' : 'outline'} size="sm" onClick={() => setView(view === 'suppliers' ? 'list' : 'suppliers')}>
            <Building2 className="h-4 w-4 mr-1" /> Suppliers
          </Button>
          <Button size="sm" onClick={() => setView(view === 'register' ? 'list' : 'register')}>
            <Plus className="h-4 w-4 mr-1" /> ลงทะเบียนใหม่
          </Button>
        </div>
      </div>

      {view === 'suppliers' && <SuppliersView />}
      {view === 'register' && <RegisterAssetView onDone={() => { setView('list'); load() }} />}
      {view === 'list' && (
        <>
          <PushNotificationManager />
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหา Tag ID, S/N, รุ่น, ยี่ห้อ..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full md:w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Source ทั้งหมด</SelectItem>
                    <SelectItem value="Demo_Stock">คลังเดโม</SelectItem>
                    <SelectItem value="Sales_Stock">คลังขาย</SelectItem>
                    <SelectItem value="Supplier">ยืมจาก Supplier</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                    {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                <span>ทั้งหมด <b>{assets.length}</b></span>
                <span className="text-amber-600">Supplier: {assets.filter(a => a.source === 'Supplier').length}</span>
                <span className="text-purple-600">รอคืน Supplier: {assets.filter(a => a.source === 'Supplier' && a.status === 'Available').length}</span>
                <span className="text-slate-600">คืนแล้ว: {assets.filter(a => a.status === 'Returned_To_Supplier').length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {loading && <LoadingState />}
                  {!loading && assets.length === 0 && (
                    <EmptyState icon={<Package className="h-12 w-12" />} message="ไม่พบสินค้า" />
                  )}
                  {assets.map((a) => {
                    const isSupplier = a.source === 'Supplier'
                    const isWaitingReturn = isSupplier && a.status === 'Available'
                    const isReturned = a.status === 'Returned_To_Supplier'
                    const overLoan = a.maxLoanCount && a.loanCount >= a.maxLoanCount
                    return (
                      <div key={a.tagId} className="p-3 flex items-start gap-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-semibold">{a.tagId}</span>
                            <Badge variant="outline" className="text-xs">{a.brand} {a.model}</Badge>
                            <AssetStatusBadge status={a.status} />
                            <SourceBadge source={a.source} />
                            {a.conditionGrade && <Badge variant="outline" className="text-xs">Grade {a.conditionGrade}</Badge>}
                            {isSupplier && a.maxLoanCount && (
                              <Badge variant="outline" className={`text-xs ${overLoan ? 'text-rose-700 bg-rose-50' : 'text-amber-700 bg-amber-50'}`}>
                                ยืม {a.loanCount}/{a.maxLoanCount}
                              </Badge>
                            )}
                            {overLoan && <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50"><AlertTriangle className="h-3 w-3 mr-1" />เกินขีด</Badge>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            S/N: <span className="font-mono">{a.serialNo}</span>
                            {a.location && <span className="ml-2">• 📍 {a.location.name}</span>}
                          </div>
                          {isSupplier && a.supplierName && (
                            <div className="text-xs text-purple-700 mt-0.5">
                              Supplier: {a.supplierName}
                              {a.supplierLoanDue && <span className="ml-2">• คืนถึง {new Date(a.supplierLoanDue).toLocaleDateString('th-TH')}</span>}
                              {a.depositPrice && <span className="ml-2">• มัดจำ ฿{a.depositPrice.toLocaleString()}</span>}
                            </div>
                          )}
                        </div>
                        {isWaitingReturn && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-300 text-purple-700 hover:bg-purple-50"
                            onClick={async () => {
                              if (!confirm(`ส่งคืน Supplier ${a.supplierName} ใช่ไหม?`)) return
                              const res = await fetch('/api/assets/return-to-supplier', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tagId: a.tagId }),
                              })
                              const data = await res.json()
                              if (res.ok) {
                                toast({ title: `✓ ส่งคืน ${a.supplierName} แล้ว` })
                                load()
                              } else {
                                toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' })
                              }
                            }}
                          >
                            ส่งคืน Supplier
                          </Button>
                        )}
                        {isReturned && (
                          <Badge variant="outline" className="text-xs text-slate-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />คืนแล้ว
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ===== Register New Asset View =====
function RegisterAssetView({ onDone }: { onDone: () => void }) {
  const { toast } = useToast()
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Array<{ id: string; name: string; zone: string | null; assetCount: number }>>([])
  const [form, setForm] = useState({
    tagId: '',
    serialNo: '',
    catalogId: '',
    source: 'Demo_Stock',
    supplierId: '',
    supplierLoanDue: '',
    depositPrice: '',
    maxLoanCount: '3',
    locationId: '',
    conditionGrade: 'A',
    purchaseDate: '',
    warrantyExpireDate: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(d => setCatalogs(d.catalogs || []))
    fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || []))
    fetch('/api/locations').then(r => r.json()).then(d => setLocations(d.locations || []))
  }, [])

  const submit = async () => {
    if (!form.tagId.trim() || !form.serialNo.trim() || !form.catalogId) {
      toast({ title: 'กรอกข้อมูลให้ครบ: Tag ID, S/N, รุ่น', variant: 'destructive' })
      return
    }
    if (form.source === 'Supplier' && !form.supplierId) {
      toast({ title: 'เลือก Supplier', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          supplierLoanStart: form.source === 'Supplier' ? new Date().toISOString() : null,
          maxLoanCount: form.source === 'Supplier' ? parseInt(form.maxLoanCount) || 3 : null,
          depositPrice: form.depositPrice || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✓ ลงทะเบียนสำเร็จ: ${data.asset.tagId}` })
      onDone()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="sm" onClick={onDone}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
          <h3 className="text-base font-medium">ลงทะเบียนสินค้าใหม่</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-600">Tag ID <span className="text-rose-500">*</span></label>
            <Input value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} placeholder="ACT-099" className="mt-1 h-9 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-slate-600">Serial Number <span className="text-rose-500">*</span></label>
            <Input value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} placeholder="25AB1234CD" className="mt-1 h-9 text-sm font-mono" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-600">รุ่นสินค้า <span className="text-rose-500">*</span></label>
            <Select value={form.catalogId} onValueChange={(v) => setForm({ ...form, catalogId: v })}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
              <SelectContent>
                {catalogs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.brand} {c.model} ({c.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Source <span className="text-rose-500">*</span></label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Demo_Stock">คลังเดโม</SelectItem>
                <SelectItem value="Sales_Stock">คลังขาย</SelectItem>
                <SelectItem value="Supplier">ยืมจาก Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-600">สถานะเริ่มต้น</label>
            <Badge variant="outline" className="mt-1.5 text-xs">Available</Badge>
          </div>
          {form.source === 'Supplier' && (
            <>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Supplier <span className="text-rose-500">*</span></label>
                <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือก Supplier..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}{s.contactName ? ` (${s.contactName})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">กำหนดคืน Supplier</label>
                <Input type="date" value={form.supplierLoanDue} onChange={(e) => setForm({ ...form, supplierLoanDue: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">ราคามัดจำ (บาท)</label>
                <Input type="number" value={form.depositPrice} onChange={(e) => setForm({ ...form, depositPrice: e.target.value })} placeholder="0" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">จำกัดยืมสูงสุด (ครั้ง)</label>
                <Input type="number" value={form.maxLoanCount} onChange={(e) => setForm({ ...form, maxLoanCount: e.target.value })} min="1" className="mt-1 h-9 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="text-xs text-slate-600">สถานที่จัดเก็บ</label>
            <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="ไม่ระบุ..." /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name} {l.zone ? `(${l.zone})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-600">เกรดสภาพ</label>
            <Select value={form.conditionGrade} onValueChange={(v) => setForm({ ...form, conditionGrade: v })}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['A', 'B', 'C', 'D'].map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-slate-600">วันที่ซื้อ</label>
            <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-600">รับประกันถึง</label>
            <Input type="date" value={form.warrantyExpireDate} onChange={(e) => setForm({ ...form, warrantyExpireDate: e.target.value })} className="mt-1 h-9 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-600">หมายเหตุ</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-9 text-sm" />
          </div>
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting ? 'กำลังบันทึก...' : 'ลงทะเบียนสินค้า'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ===== Suppliers View =====
function SuppliersView() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/suppliers')
    const data = await res.json()
    setSuppliers(data.suppliers || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.name.trim()) {
      toast({ title: 'ระบุชื่อ Supplier', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✓ เพิ่ม Supplier: ${form.name}` })
      setForm({ name: '', contactName: '', phone: '', email: '', notes: '' })
      setShowForm(false)
      load()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`ลบ Supplier "${name}" ใช่ไหม?`)) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      toast({ title: `ลบ ${name} แล้ว` })
      load()
    } else {
      toast({ title: 'ลบไม่สำเร็จ', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Suppliers ({suppliers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border-2 border-dashed border-blue-300 bg-blue-50 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">เพิ่ม Supplier ใหม่</h4>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">ชื่อ <span className="text-rose-500">*</span></label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Honeywell Thailand" className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">ผู้ติดต่อ</label>
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">เบอร์โทร</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">อีเมล</label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={create} disabled={submitting} className="w-full">
              {submitting ? 'กำลังบันทึก...' : 'เพิ่ม Supplier'}
            </Button>
          </div>
        )}

        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> เพิ่ม Supplier
          </Button>
        )}

        {loading && <LoadingState />}
        {!loading && suppliers.length === 0 && (
          <EmptyState icon={<Building2 className="h-12 w-12" />} message="ยังไม่มี Supplier" />
        )}
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.id} className="border rounded p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium">{s.name}</div>
                  {s.contactName && <div className="text-xs text-slate-500">ผู้ติดต่อ: {s.contactName}</div>}
                  {s.phone && <div className="text-xs text-slate-500">โทร: {s.phone}</div>}
                  {s.email && <div className="text-xs text-slate-500">อีเมล: {s.email}</div>}
                  <div className="text-xs mt-1 flex gap-2">
                    <Badge variant="outline" className="text-xs">ทั้งหมด {s.assetCount}</Badge>
                    <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50">รอคืน {s.activeLoanCount}</Badge>
                    <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50">คืนแล้ว {s.returnedCount}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(s.id, s.name)}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
