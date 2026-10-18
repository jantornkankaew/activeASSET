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
  EmptyState, LoadingState, PurposeBadge,
} from './shared'
import {
  Plus, Clock, CheckCircle2, Bell, X, User,
} from 'lucide-react'
import {
  formatThaiDate, daysUntil, INDUSTRY_LABELS, PURPOSE_LABELS,
} from '@/lib/activeasset-constants'

interface WaitingListItem {
  id: string
  catalogId: string
  model: string
  brand: string
  category: string
  customerName: string
  customerCompany: string | null
  customerIndustry: string | null
  salesRepName: string
  purpose: string
  quantity: number
  position: number
  status: string
  loanDocNo: string | null
  availableCount: number
  canFulfill: boolean
  createdAt: string
  notifiedAt: string | null
  fulfilledAt: string | null
  fulfilledLoanDocNo: string | null
}

export function WaitingListTab() {
  const { toast } = useToast()
  const [items, setItems] = useState<WaitingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('Waiting')

  // New entry form
  const [showForm, setShowForm] = useState(false)
  const [catalogs, setCatalogs] = useState<Array<{ id: string; model: string; brand: string; category: string; available: number }>>([])
  const [formCatalogId, setFormCatalogId] = useState('')
  const [formCustomer, setFormCustomer] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formIndustry, setFormIndustry] = useState('Logistics')
  const [formSalesRep, setFormSalesRep] = useState('')
  const [formPurpose, setFormPurpose] = useState('Demo')
  const [formQty, setFormQty] = useState(1)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/waiting-list?status=${statusFilter}`)
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/catalog').then((r) => r.json()).then((d) => setCatalogs(d.catalogs || []))
  }, [])

  const create = async () => {
    if (!formCatalogId || !formCustomer || !formQty) {
      toast({ title: 'ข้อมูลไม่ครบ', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: formCatalogId,
          customerName: formCustomer,
          customerCompany: formCompany || null,
          customerIndustry: formIndustry,
          salesRepName: formSalesRep || 'ไม่ระบุ',
          purpose: formPurpose,
          quantity: formQty,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: '✓ เพิ่มคิวสำเร็จ' })
      setShowForm(false)
      setFormCatalogId(''); setFormCustomer(''); setFormCompany(''); setFormQty(1)
      await load()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const cancel = async (id: string) => {
    const res = await fetch('/api/waiting-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    })
    if (res.ok) {
      toast({ title: 'ยกเลิกคิวแล้ว' })
      await load()
    }
  }

  const fulfill = async (id: string) => {
    const res = await fetch('/api/waiting-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'fulfill' }),
    })
    if (res.ok) {
      toast({ title: '✓ ทำเครื่องหมายว่าจัดให้แล้ว' })
      await load()
    }
  }

  const notifyNext = async (id: string, customerName: string) => {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitingListId: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'เกิดข้อผิดพลาด', description: data.error, variant: 'destructive' })
      return
    }
    if (data.sent) {
      // ส่งผ่าน LINE Messaging API สำเร็จ
      toast({ title: `✓ ส่งการแจ้งเตือนถึง ${customerName} แล้ว (LINE)` })
    } else if (data.shareUrl) {
      // ไม่มี LINE config → เปิด share URL
      window.open(data.shareUrl, '_blank')
      toast({ title: 'เปิด LINE share แล้ว', description: 'กรุณาเลือกผู้รับและส่งข้อความ' })
    }
    await load()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" /> Waiting List — คิวยืมรุ่นที่ขาดสต็อก
        </h2>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่มคิว
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { v: 'Waiting', l: 'รอคิว' },
          { v: 'Notified', l: 'แจ้งแล้ว' },
          { v: 'Fulfilled', l: 'จัดให้แล้ว' },
          { v: 'Cancelled', l: 'ยกเลิก' },
          { v: 'all', l: 'ทั้งหมด' },
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

      {/* New entry form */}
      {showForm && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardContent className="p-3 space-y-2">
            <div className="text-sm font-medium">เพิ่มคิวใหม่</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-600">รุ่นสินค้า</label>
                <Select value={formCatalogId} onValueChange={setFormCatalogId}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
                  <SelectContent>
                    {catalogs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.brand} {c.model} (พร้อมใช้ {c.available})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">จำนวน</label>
                <Input type="number" min="1" value={formQty} onChange={(e) => setFormQty(parseInt(e.target.value) || 1)} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">ชื่อลูกค้า <span className="text-rose-500">*</span></label>
                <Input value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)} placeholder="คุณ..." className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">บริษัท</label>
                <Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="บจก. ..." className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-600">อุตสาหกรรม</label>
                <Select value={formIndustry} onValueChange={setFormIndustry}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INDUSTRY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">วัตถุประสงค์</label>
                <Select value={formPurpose} onValueChange={setFormPurpose}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={create} disabled={creating || !formCatalogId || !formCustomer}>
                {creating ? 'กำลังเพิ่ม...' : 'เพิ่มคิว'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>ยกเลิก</Button>
            </div>
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
                <EmptyState icon={<CheckCircle2 className="h-12 w-12" />} message="ไม่มีคิวรอ" />
              )}
              {items.map((item) => {
                const days = daysUntil(item.createdAt)
                return (
                  <div key={item.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">คิวที่ {item.position}</Badge>
                          <span className="font-medium text-sm">{item.brand} {item.model}</span>
                          <Badge variant="outline" className="text-xs">× {item.quantity}</Badge>
                          <PurposeBadge purpose={item.purpose} />
                          {item.status === 'Waiting' && <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50">รอคิว</Badge>}
                          {item.status === 'Notified' && <Badge variant="outline" className="text-xs text-emerald-700 bg-emerald-50"><Bell className="h-3 w-3 mr-1" />พร้อมจัด</Badge>}
                          {item.status === 'Fulfilled' && <Badge variant="outline" className="text-xs text-slate-700 bg-slate-100">จัดให้แล้ว</Badge>}
                        </div>
                        <div className="text-sm mt-1">{item.customerName} {item.customerCompany ? `— ${item.customerCompany}` : ''}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          พนักงาน: {item.salesRepName} • รอ {Math.abs(days)} วัน
                          {item.loanDocNo && <span className="ml-2">• ใบยืม {item.loanDocNo}</span>}
                        </div>
                        {/* Stock info */}
                        <div className="text-xs mt-1">
                          สต็อกปัจจุบัน: <b className={item.canFulfill ? 'text-emerald-600' : 'text-rose-600'}>
                            {item.availableCount} ว่าง
                          </b> {item.canFulfill
                            ? <span className="text-emerald-600">✓ พอจัดให้ได้</span>
                            : <span className="text-rose-600">• ยังไม่พอ</span>}
                        </div>
                      </div>
                      {item.status === 'Waiting' || item.status === 'Notified' ? (
                        <div className="flex flex-col gap-1">
                          {item.canFulfill && (
                            <>
                              <Button size="sm" onClick={() => notifyNext(item.id, item.customerName)} className="bg-[#06C755] hover:bg-[#05b04b]">
                                <Bell className="h-3 w-3 mr-1" /> แจ้งคนถัดไป (LINE)
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => fulfill(item.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> จัดให้แล้ว
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => cancel(item.id)}>
                            <X className="h-3 w-3 mr-1" /> ยกเลิก
                          </Button>
                        </div>
                      ) : null}
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
