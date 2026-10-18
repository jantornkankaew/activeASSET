'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { EmptyState, LoadingState } from './shared'
import {
  Plus, Building2, X, ArrowLeft, Trash2, Save, Package, Tag, FileText,
  MapPin, Calendar, Shield, DollarSign, Truck, Layers, Clock, Info, Image as ImageIcon,
} from 'lucide-react'
import {
  CATEGORY_LABELS, SOURCE_LABELS,
} from '@/lib/activeasset-constants'

interface CatalogItem {
  id: string
  model: string
  brand: string
  category: string
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

// ===== Register Asset View — Velzon Add Product style =====
export function RegisterAssetView({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { toast } = useToast()
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [locations, setLocations] = useState<Array<{ id: string; name: string; zone: string | null; assetCount: number }>>([])
  const [form, setForm] = useState({
    tagId: '', serialNo: '', catalogId: '', source: 'Demo_Stock',
    supplierId: '', supplierLoanDue: '', depositPrice: '', maxLoanCount: '3',
    locationId: '', conditionGrade: 'A', purchaseDate: '', warrantyExpireDate: '', notes: '',
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

  // Find selected catalog (for image panel preview)
  const selectedCatalog = catalogs.find((c) => c.id === form.catalogId)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ===== Velzon page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            ลงทะเบียนทรัพย์สินใหม่
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={onBack} className="text-muted-foreground hover:text-primary transition-smooth">ทรัพย์สิน</button>
          <span className="text-muted-foreground/60">›</span>
          <span className="text-primary font-medium">ลงทะเบียน</span>
        </div>
      </div>

      {/* ===== Velzon 2-column layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — main form (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* === Card 1 — Basic Info === */}
          <div className="vz-card">
            <div className="p-4 lg:p-5 space-y-4">
              {/* Tag ID + S/N row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Tag ID <span className="text-rose-500">*</span></label>
                  <Input value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} placeholder="ACT-099" className="font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Serial Number <span className="text-rose-500">*</span></label>
                  <Input value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} placeholder="25AB1234CD" className="font-mono" />
                </div>
              </div>
              {/* Catalog select */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">รุ่นสินค้า <span className="text-rose-500">*</span></label>
                <Select value={form.catalogId} onValueChange={(v) => setForm({ ...form, catalogId: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
                  <SelectContent>
                    {catalogs.map((c) => (<SelectItem key={c.id} value={c.id}>{c.brand} {c.model} ({c.category})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* === Card 2 — Product Image panel (Velzon gallery) === */}
          <div className="vz-card">
            {/* Card header */}
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(64,81,137,0.10)' }}>
                <ImageIcon className="h-4 w-4" style={{ color: '#405189' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">รูปทรัพย์สิน</div>
                <div className="text-[10px] text-muted-foreground">อัปโหลดรูปเครื่อง (ไม่บังคับ)</div>
              </div>
            </div>
            {/* Card body */}
            <div className="p-4 lg:p-5">
              {/* Single image upload — Velzon avatar-lg pattern */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-24 w-24 rounded-md bg-muted/40 border border-dashed border-border flex items-center justify-center overflow-hidden">
                    {selectedCatalog ? (
                      <Package className="h-10 w-10 text-muted-foreground/40" />
                    ) : (
                      <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  {/* Floating upload button (Velzon pattern) */}
                  <button
                    type="button"
                    className="absolute -bottom-1 -right-1 vz-icon-soft h-7 w-7 bg-card border border-border rounded-full shadow-sm hover:bg-muted transition-smooth"
                    title="เลือกรูป"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">คลิกปุ่มลูกศรเพื่อเลือกรูป</p>
              </div>

              {/* Dropzone placeholder (Velzon style) */}
              <div className="mt-4 border border-dashed border-border rounded-md p-6 text-center hover:border-primary/40 transition-smooth cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                  <h6 className="text-xs font-semibold text-foreground mb-0">ลากไฟล์มาวางหรือคลิกเพื่ออัปโหลด</h6>
                  <p className="text-[10px] text-muted-foreground mb-0">รองรับ PNG, JPG, WebP</p>
                </div>
              </div>
            </div>
          </div>

          {/* === Card 3 — General Info with tabs === */}
          <div className="vz-card">
            {/* Card header with tabs */}
            <div className="px-2 pt-2 vz-divider">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="vz-tabs-custom bg-transparent p-0 h-auto">
                  <TabsTrigger value="general" className="vz-tabs-custom-trigger">
                    ข้อมูลทั่วไป
                  </TabsTrigger>
                  <TabsTrigger value="dates" className="vz-tabs-custom-trigger">
                    วันที่
                  </TabsTrigger>
                  <TabsTrigger value="supplier" className="vz-tabs-custom-trigger">
                    Supplier
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — General Info */}
                <TabsContent value="general" className="vz-tab-content mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">แหล่งที่มา</label>
                      <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Demo_Stock">คลังเดโม</SelectItem>
                          <SelectItem value="Sales_Stock">คลังขาย</SelectItem>
                          <SelectItem value="Supplier">ยืมจาก Supplier</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">สถานะเริ่มต้น</label>
                      <div className="h-9 px-3 flex items-center bg-muted/30 border border-border rounded-md">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Available</Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">สถานที่จัดเก็บ</label>
                      <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                        <SelectTrigger><SelectValue placeholder="ไม่ระบุ..." /></SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name} {l.zone ? `(${l.zone})` : ''}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">เกรดสภาพ</label>
                      <Select value={form.conditionGrade} onValueChange={(v) => setForm({ ...form, conditionGrade: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['A', 'B', 'C', 'D'].map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2 — Dates */}
                <TabsContent value="dates" className="vz-tab-content mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">วันที่ซื้อ</label>
                      <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1.5">รับประกันถึง</label>
                      <Input type="date" value={form.warrantyExpireDate} onChange={(e) => setForm({ ...form, warrantyExpireDate: e.target.value })} />
                    </div>
                    {form.source === 'Supplier' && (
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">กำหนดคืน Supplier</label>
                        <Input type="date" value={form.supplierLoanDue} onChange={(e) => setForm({ ...form, supplierLoanDue: e.target.value })} />
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Tab 3 — Supplier info (only shown when source === Supplier) */}
                <TabsContent value="supplier" className="vz-tab-content mt-0">
                  {form.source === 'Supplier' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Supplier <span className="text-rose-500">*</span></label>
                        <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                          <SelectTrigger><SelectValue placeholder="เลือก Supplier..." /></SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}{s.contactName ? ` (${s.contactName})` : ''}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">มัดจำ (บาท)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">฿</span>
                            <Input type="number" value={form.depositPrice} onChange={(e) => setForm({ ...form, depositPrice: e.target.value })} placeholder="0" className="pl-7" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1.5">ยืมสูงสุด (ครั้ง)</label>
                          <Input type="number" value={form.maxLoanCount} onChange={(e) => setForm({ ...form, maxLoanCount: e.target.value })} min="1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Truck className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                      <div className="text-sm font-medium text-foreground">ไม่ใช้ Supplier</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">เปลี่ยน "แหล่งที่มา" ในแทปข้อมูลทั่วไปเป็น "ยืมจาก Supplier" เพื่อเปิดใช้งาน</div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Submit button — Velzon text-end btn-success */}
          <div className="flex justify-end gap-2">
            <Button variant="soft" onClick={onBack} className="text-xs">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> ยกเลิก
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              className="text-xs"
              style={{ backgroundColor: '#0ab39c', color: 'white' }}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {submitting ? 'กำลังบันทึก...' : 'ลงทะเบียน'}
            </Button>
          </div>
        </div>

        {/* RIGHT — sidebar (1/3) */}
        <div className="lg:col-span-1 space-y-4">
          {/* === Card — Publish / Status === */}
          <div className="vz-card">
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(10,179,156,0.10)' }}>
                <Info className="h-4 w-4" style={{ color: '#0ab39c' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">สถานะ</div>
                <div className="text-[10px] text-muted-foreground">การเผยแพร่</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">แหล่งที่มา</label>
                <div className="h-9 px-3 flex items-center bg-muted/30 border border-border rounded-md text-xs">
                  <span className="font-medium text-foreground">{SOURCE_LABELS[form.source]?.label || form.source}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">สถานะเริ่มต้น</label>
                <div className="h-9 px-3 flex items-center bg-muted/30 border border-border rounded-md">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Available</Badge>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">เกรด</label>
                <div className="h-9 px-3 flex items-center bg-muted/30 border border-border rounded-md">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Grade {form.conditionGrade}</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* === Card — Loan Settings === */}
          <div className="vz-card">
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(247,184,75,0.12)' }}>
                <Layers className="h-4 w-4" style={{ color: '#f7b84b' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">ตั้งค่าการยืม</div>
                <div className="text-[10px] text-muted-foreground">ข้อจำกัด</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">ยืมสูงสุด (ครั้ง)</label>
                <Input type="number" value={form.maxLoanCount} onChange={(e) => setForm({ ...form, maxLoanCount: e.target.value })} min="1" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">มัดจำ (บาท)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">฿</span>
                  <Input type="number" value={form.depositPrice} onChange={(e) => setForm({ ...form, depositPrice: e.target.value })} placeholder="0" className="pl-7" />
                </div>
              </div>
              {form.source === 'Supplier' && (
                <div className="pt-2 border-t border-border text-[11px] text-muted-foreground">
                  <Truck className="h-3 w-3 inline mr-1" /> Source = Supplier — ต้องระบุข้อมูลในแทป Supplier ด้วย
                </div>
              )}
            </div>
          </div>

          {/* === Card — Schedule / Dates === */}
          <div className="vz-card">
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(64,81,137,0.10)' }}>
                <Calendar className="h-4 w-4" style={{ color: '#405189' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">ปฏิทิน</div>
                <div className="text-[10px] text-muted-foreground">วันที่สำคัญ</div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">วันที่ซื้อ</label>
                <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">รับประกันถึง</label>
                <Input type="date" value={form.warrantyExpireDate} onChange={(e) => setForm({ ...form, warrantyExpireDate: e.target.value })} />
              </div>
              {form.source === 'Supplier' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">กำหนดคืน Supplier</label>
                  <Input type="date" value={form.supplierLoanDue} onChange={(e) => setForm({ ...form, supplierLoanDue: e.target.value })} />
                </div>
              )}
            </div>
          </div>

          {/* === Card — Notes === */}
          <div className="vz-card">
            <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
              <span className="vz-icon-soft h-8 w-8" style={{ backgroundColor: 'rgba(116,120,141,0.12)' }}>
                <FileText className="h-4 w-4" style={{ color: '#74788d' }} />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">หมายเหตุ</div>
                <div className="text-[10px] text-muted-foreground">บันทึกเพิ่มเติม</div>
              </div>
            </div>
            <div className="p-4">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="บันทึกเพิ่มเติมเกี่ยวกับทรัพย์สิน..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Suppliers View (unchanged) =====
export function SuppliersView({ onBack }: { onBack: () => void }) {
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
    if (!form.name.trim()) { toast({ title: 'ระบุชื่อ Supplier', variant: 'destructive' }); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✓ เพิ่ม Supplier: ${form.name}` })
      setForm({ name: '', contactName: '', phone: '', email: '', notes: '' })
      setShowForm(false)
      load()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`ลบ Supplier "${name}" ใช่ไหม?`)) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) { toast({ title: `ลบ ${name} แล้ว` }); load() }
    else { toast({ title: 'ลบไม่สำเร็จ', description: data.error, variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
        <h2 className="text-lg font-bold tracking-tight">Suppliers</h2>
      </div>
      <Card className="shadow-premium">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> ทั้งหมด ({suppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showForm && (
            <div className="border-2 border-dashed border-accent/30 bg-accent/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">เพิ่ม Supplier ใหม่</h4>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">ชื่อ <span className="text-rose-500">*</span></label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Honeywell Thailand" className="mt-1 h-9 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">ผู้ติดต่อ</label>
                  <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 h-9 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">เบอร์โทร</label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 h-9 rounded-lg" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">อีเมล</label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 h-9 rounded-lg" />
                </div>
              </div>
              <Button size="sm" onClick={create} disabled={submitting} className="w-full rounded-lg">{submitting ? 'กำลังบันทึก...' : 'เพิ่ม Supplier'}</Button>
            </div>
          )}
          {!showForm && <Button size="sm" onClick={() => setShowForm(true)} className="w-full rounded-xl"><Plus className="h-4 w-4 mr-1" /> เพิ่ม Supplier</Button>}
          {loading && <LoadingState />}
          {!loading && suppliers.length === 0 && <EmptyState icon={<Building2 className="h-12 w-12" />} message="ยังไม่มี Supplier" />}
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.id} className="border border-border/50 rounded-xl p-3 text-sm hover-lift transition-smooth">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-semibold">{s.name}</div>
                    {s.contactName && <div className="text-xs text-muted-foreground">ผู้ติดต่อ: {s.contactName}</div>}
                    {s.phone && <div className="text-xs text-muted-foreground">โทร: {s.phone}</div>}
                    {s.email && <div className="text-xs text-muted-foreground">อีเมล: {s.email}</div>}
                    <div className="text-xs mt-1.5 flex gap-1.5">
                      <Badge variant="outline" className="text-xs">ทั้งหมด {s.assetCount}</Badge>
                      <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50">รอคืน {s.activeLoanCount}</Badge>
                      <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50">คืนแล้ว {s.returnedCount}</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id, s.name)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
