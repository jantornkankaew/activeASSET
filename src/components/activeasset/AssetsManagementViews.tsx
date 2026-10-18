'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { EmptyState, LoadingState } from './shared'
import { Plus, Building2, X, ArrowLeft, Trash2 } from 'lucide-react'

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

// ===== Register Asset View =====
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

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
        <h2 className="text-lg font-bold tracking-tight">ลงทะเบียนสินค้าใหม่</h2>
      </div>
      <Card className="shadow-premium">
        <CardContent className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tag ID <span className="text-rose-500">*</span></label>
              <Input value={form.tagId} onChange={(e) => setForm({ ...form, tagId: e.target.value })} placeholder="ACT-099" className="mt-1 h-10 rounded-xl font-mono" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Serial Number <span className="text-rose-500">*</span></label>
              <Input value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} placeholder="25AB1234CD" className="mt-1 h-10 rounded-xl font-mono" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">รุ่นสินค้า <span className="text-rose-500">*</span></label>
              <Select value={form.catalogId} onValueChange={(v) => setForm({ ...form, catalogId: v })}>
                <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
                <SelectContent>
                  {catalogs.map((c) => (<SelectItem key={c.id} value={c.id}>{c.brand} {c.model} ({c.category})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Source</label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Demo_Stock">คลังเดโม</SelectItem>
                  <SelectItem value="Sales_Stock">คลังขาย</SelectItem>
                  <SelectItem value="Supplier">ยืมจาก Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">สถานะเริ่มต้น</label>
              <div className="mt-1.5"><Badge variant="outline" className="bg-emerald-50 text-emerald-700">Available</Badge></div>
            </div>
            {form.source === 'Supplier' && (
              <>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">Supplier <span className="text-rose-500">*</span></label>
                  <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                    <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="เลือก..." /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}{s.contactName ? ` (${s.contactName})` : ''}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">กำหนดคืน Supplier</label>
                  <Input type="date" value={form.supplierLoanDue} onChange={(e) => setForm({ ...form, supplierLoanDue: e.target.value })} className="mt-1 h-10 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">มัดจำ (บาท)</label>
                  <Input type="number" value={form.depositPrice} onChange={(e) => setForm({ ...form, depositPrice: e.target.value })} placeholder="0" className="mt-1 h-10 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">ยืมสูงสุด (ครั้ง)</label>
                  <Input type="number" value={form.maxLoanCount} onChange={(e) => setForm({ ...form, maxLoanCount: e.target.value })} min="1" className="mt-1 h-10 rounded-xl" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">สถานที่จัดเก็บ</label>
              <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue placeholder="ไม่ระบุ..." /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name} {l.zone ? `(${l.zone})` : ''}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">เกรดสภาพ</label>
              <Select value={form.conditionGrade} onValueChange={(v) => setForm({ ...form, conditionGrade: v })}>
                <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['A', 'B', 'C', 'D'].map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">วันที่ซื้อ</label>
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">รับประกันถึง</label>
              <Input type="date" value={form.warrantyExpireDate} onChange={(e) => setForm({ ...form, warrantyExpireDate: e.target.value })} className="mt-1 h-10 rounded-xl" />
            </div>
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full rounded-xl h-11">
            {submitting ? 'กำลังบันทึก...' : 'ลงทะเบียนสินค้า'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Suppliers View =====
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
