'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import {
  EmptyState, LoadingState, PurposeBadge, IndustryBadge,
} from './shared'
import {
  Plus, Calendar, X, CheckCircle2, AlertTriangle, Clock, User, Building2, Bell,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil, PURPOSE_LABELS, INDUSTRY_LABELS,
} from '@/lib/activeasset-constants'

interface ReservationItem {
  id: string
  resNo: string
  customerName: string
  customerCompany: string | null
  customerIndustry: string | null
  salesRepName: string
  purpose: string
  catalogId: string
  model: string
  brand: string
  category: string
  quantity: number
  startDate: string
  endDate: string
  notes: string | null
  origin: string
  sourceLoanDocNo: string | null
  status: string
  approvedBy: string | null
  approvedAt: string | null
  rejectedReason: string | null
  convertedLoanDocNo: string | null
  notifiedAt: string | null
  createdAt: string
  totalStock: number
  overlappingQty: number
  onLoanNow: number
  availableForDates: number
  canApprove: boolean
}

interface CatalogItem {
  id: string
  model: string
  brand: string
  category: string
  available: number
  total: number
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  Pending: { label: 'รอคิว', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  Approved: { label: 'พร้อมจัด', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  Notified: { label: 'แจ้งแล้ว', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  Rejected: { label: 'ปฏิเสธ', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  Converted: { label: 'แปลงเป็นใบยืม', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' },
  Cancelled: { label: 'ยกเลิก', color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' },
}

const ORIGIN_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  manual: { label: 'จองอิสระ', icon: <Calendar className="h-3 w-3" /> },
  auto_queue: { label: 'จากใบยืม', icon: <Clock className="h-3 w-3" /> },
}

export function ReservationTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<ReservationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [catalogs, setCatalogs] = useState<CatalogItem[]>([])

  // Form
  const [form, setForm] = useState({
    customerName: '',
    customerCompany: '',
    customerIndustry: 'Logistics',
    salesRepName: '',
    purpose: 'Demo',
    catalogId: '',
    quantity: 1,
    startDate: '',
    endDate: '',
    notes: '',
  })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reservations?status=${statusFilter}`)
    const data = await res.json()
    setItems(data.reservations || [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(d => setCatalogs(d.catalogs || []))
  }, [])

  const create = async () => {
    if (!form.customerName.trim() || !form.catalogId || !form.startDate || !form.endDate) {
      toast({ title: 'กรอกข้อมูลให้ครบ', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: `✓ สร้าง reservation: ${data.reservation.resNo}`,
        description: data.hasConflict
          ? `มี conflict — รอการอนุมัติ (เหลือ ${data.availableForDates} ว่าง)`
          : `อนุมัติอัตโนมัติ (ไม่มี conflict)`,
      })
      setForm({
        customerName: '', customerCompany: '', customerIndustry: 'Logistics',
        salesRepName: '', purpose: 'Demo', catalogId: '', quantity: 1,
        startDate: '', endDate: '', notes: '',
      })
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const action = async (id: string, actionName: string, extra?: Record<string, unknown>) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' })
      return
    }
    toast({ title: `✓ ${actionName} สำเร็จ` })
    await load()
  }

  const notifyNext = async (id: string, customerName: string) => {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `🔔 แจ้งจาก Reservation\n\nคุณ ${customerName}\nสินค้าที่จองพร้อมแล้ว กรุณาติดต่อเจ้าหน้าที่คลัง\n\n— activeASSET`,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' })
      return
    }
    if (data.sent) {
      toast({ title: `✓ ส่งการแจ้งเตือนถึง ${customerName} แล้ว` })
    } else if (data.shareUrl) {
      window.open(data.shareUrl, '_blank')
      toast({ title: 'เปิด LINE share แล้ว' })
    }
    // อัปเดต status เป็น Notified
    await action(id, 'approve', { approvedBy: 'Notify' })
    // ย้ายกลับเป็น Notified ผ่าน PATCH แบบพิเศษ
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'notify' }),
    }).catch(() => {})
    await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" /> จองล่วงหน้า & คิวยืม
        </h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> จองใหม่
        </Button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { v: 'all', l: 'ทั้งหมด' },
          { v: 'Pending', l: 'รอคิว' },
          { v: 'Approved', l: 'พร้อมจัด' },
          { v: 'Notified', l: 'แจ้งแล้ว' },
          { v: 'Converted', l: 'แปลงเป็นใบยืม' },
          { v: 'Rejected', l: 'ปฏิเสธ' },
          { v: 'Cancelled', l: 'ยกเลิก' },
        ].map((f) => (
          <Button
            key={f.v}
            variant={statusFilter === f.v ? 'default' : 'outline'}
            size="sm"
            className="h-7"
            onClick={() => setStatusFilter(f.v)}
          >
            {f.l}
          </Button>
        ))}
      </div>

      {/* New reservation form */}
      {showForm && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">จองล่วงหน้าใหม่</h4>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}><X className="h-3 w-3" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">ชื่อลูกค้า <span className="text-rose-500">*</span></label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">บริษัท</label>
                <Input value={form.customerCompany} onChange={(e) => setForm({ ...form, customerCompany: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">อุตสาหกรรม</label>
                <Select value={form.customerIndustry} onValueChange={(v) => setForm({ ...form, customerIndustry: v })}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDUSTRY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">พนักงานขาย</label>
                <Input value={form.salesRepName} onChange={(e) => setForm({ ...form, salesRepName: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">รุ่นสินค้า <span className="text-rose-500">*</span></label>
                <Select value={form.catalogId} onValueChange={(v) => setForm({ ...form, catalogId: v })}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
                  <SelectContent>
                    {catalogs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.brand} {c.model} (สต็อก {c.available}/{c.total})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">จำนวน <span className="text-rose-500">*</span></label>
                <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">วัตถุประสงค์</label>
                <Select value={form.purpose} onValueChange={(v) => setForm({ ...form, purpose: v })}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">วันที่ต้องการเครื่อง <span className="text-rose-500">*</span></label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">วันที่คืน <span className="text-rose-500">*</span></label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">หมายเหตุ</label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 h-9 text-sm" />
              </div>
            </div>
            <Button size="sm" onClick={create} disabled={creating} className="w-full">
              {creating ? 'กำลังสร้าง...' : 'สร้าง reservation'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="divide-y">
              {loading && <LoadingState />}
              {!loading && items.length === 0 && (
                <EmptyState icon={<Calendar className="h-12 w-12" />} message="ไม่พบ reservation" />
              )}
              {items.map((r) => {
                const st = STATUS_LABELS[r.status] || { label: r.status, color: '', bg: '' }
                const daysUntilStart = daysUntil(r.startDate)
                const duration = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24))
                const hasConflict = r.availableForDates < r.quantity
                return (
                  <div key={r.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm">{r.resNo}</span>
                          <Badge variant="outline" className={`text-xs ${st.color} ${st.bg}`}>{st.label}</Badge>
                          {r.origin && ORIGIN_LABELS[r.origin] && (
                            <Badge variant="outline" className="text-xs text-slate-500 bg-slate-50">
                              {ORIGIN_LABELS[r.origin].icon}
                              <span className="ml-1">{ORIGIN_LABELS[r.origin].label}</span>
                            </Badge>
                          )}
                          <PurposeBadge purpose={r.purpose} />
                          {r.sourceLoanDocNo && (
                            <Badge variant="outline" className="text-xs text-blue-600 bg-blue-50">
                              ใบยืม {r.sourceLoanDocNo}
                            </Badge>
                          )}
                          {r.status === 'Pending' && hasConflict && (
                            <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50">
                              <AlertTriangle className="h-3 w-3 mr-1" />รอคิว
                            </Badge>
                          )}
                          {r.status === 'Pending' && !hasConflict && (
                            <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50">
                              พอจัดได้
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm mt-1">{r.customerName} {r.customerCompany ? `— ${r.customerCompany}` : ''}</div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{r.brand} {r.model} × {r.quantity}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatThaiDate(r.startDate)} → {formatThaiDate(r.endDate)} ({duration} วัน)
                          </span>
                          {daysUntilStart > 0 && (
                            <span className="text-amber-600">• อีก {daysUntilStart} วัน</span>
                          )}
                          {daysUntilStart === 0 && <span className="text-blue-600">• วันนี้</span>}
                          {daysUntilStart < 0 && r.status === 'Approved' && (
                            <span className="text-rose-600">• เลิกเวลาแล้ว</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">พนักงาน: {r.salesRepName}</div>

                        {/* Availability info */}
                        <div className="text-xs mt-1 flex items-center gap-3 flex-wrap">
                          <span>สต็อกทั้งหมด: <b>{r.totalStock}</b></span>
                          <span className="text-amber-600">กำลังยืม: <b>{r.onLoanNow}</b></span>
                          <span className="text-purple-600">จองซ้อน: <b>{r.overlappingQty}</b></span>
                          <span className={hasConflict ? 'text-rose-600' : 'text-emerald-600'}>
                            ว่างในช่วงนี้: <b>{r.availableForDates}</b> / ต้องการ {r.quantity}
                          </span>
                        </div>

                        {r.notes && <div className="text-xs text-slate-500 mt-1">หมายเหตุ: {r.notes}</div>}
                        {r.rejectedReason && <div className="text-xs text-rose-600 mt-1">เหตุผลที่ปฏิเสธ: {r.rejectedReason}</div>}
                        {r.convertedLoanDocNo && (
                          <div className="text-xs text-blue-600 mt-1">แปลงเป็นใบยืม: {r.convertedLoanDocNo}</div>
                        )}
                      </div>

                      {/* Actions */}
                      {r.status === 'Pending' && (
                        <div className="flex flex-col gap-1">
                          {r.canApprove && (
                            <>
                              <Button size="sm" onClick={() => action(r.id, 'approve', { approvedBy: 'Admin' })}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> อนุมัติ
                              </Button>
                              <Button size="sm" variant="outline" className="bg-[#06C755]/5 border-[#06C755]/30 text-[#06C755]" onClick={() => notifyNext(r.id, r.customerName)}>
                                <Bell className="h-3 w-3 mr-1" /> แจ้งคนถัดไป
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" onClick={() => {
                            const reason = prompt('เหตุผลที่ปฏิเสธ:')
                            if (reason) action(r.id, 'reject', { rejectedReason: reason })
                          }}>
                            <X className="h-3 w-3 mr-1" /> ปฏิเสธ
                          </Button>
                        </div>
                      )}
                      {r.status === 'Approved' && (
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            onClick={async () => {
                              const res = await fetch(`/api/reservations/${r.id}/convert`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({}),
                              })
                              const data = await res.json()
                              if (!res.ok) {
                                toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' })
                                return
                              }
                              toast({
                                title: `✓ แปลงเป็นใบยืมสำเร็จ`,
                                description: `${data.loan.docNo} — รอ Store จัดของ`,
                              })
                              await load()
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> แปลงเป็นใบยืม
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => action(r.id, 'cancel')}>
                            ยกเลิก
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
