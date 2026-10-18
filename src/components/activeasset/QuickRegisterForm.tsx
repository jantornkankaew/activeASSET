'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, X, User, Building2, Calendar, AlertTriangle,
} from 'lucide-react'

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
}

interface QuickRegisteredAsset {
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
  registeredAccessories: string[]
  defaultAccessories: string[]
}

interface QuickRegisterFormProps {
  open: boolean
  onClose: () => void
  defaultCatalogId?: string
  catalogs: CatalogItem[]
  onRegistered: (asset: QuickRegisteredAsset) => void
}

// QuickRegisterForm — ลงทะเบียนด่วนสำหรับยืมจาก Supplier หรือ คลังขาย
export function QuickRegisterForm({
  open, onClose, defaultCatalogId, catalogs, onRegistered,
}: QuickRegisterFormProps) {
  const { toast } = useToast()
  const [catalogId, setCatalogId] = useState(defaultCatalogId || '')
  const [serialNo, setSerialNo] = useState('')
  const [source, setSource] = useState<'Supplier' | 'Sales_Stock'>('Supplier')
  const [supplierId, setSupplierId] = useState('')
  const [supplierLoanDue, setSupplierLoanDue] = useState('')
  const [depositPrice, setDepositPrice] = useState('')
  const [maxLoanCount, setMaxLoanCount] = useState('3')
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  useEffect(() => {
    if (open) {
      setCatalogId(defaultCatalogId || '')
      setSerialNo('')
      setSource('Supplier')
      setSupplierId('')
      setSupplierLoanDue('')
      setDepositPrice('')
      setMaxLoanCount('3')
      // โหลด suppliers
      fetch('/api/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers || []))
    }
  }, [open, defaultCatalogId])

  if (!open) return null

  const submit = async () => {
    if (!catalogId) {
      toast({ title: 'เลือกรุ่นสินค้า', variant: 'destructive' })
      return
    }
    if (!serialNo.trim()) {
      toast({ title: 'กรอก Serial Number', variant: 'destructive' })
      return
    }
    if (source === 'Supplier' && !supplierId) {
      toast({ title: 'เลือก Supplier', variant: 'destructive' })
      return
    }
    if (source === 'Supplier' && !supplierLoanDue) {
      toast({ title: 'ระบุวันกำหนดคืน Supplier', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/assets/quick-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId,
          serialNo: serialNo.trim(),
          source,
          supplierId: source === 'Supplier' ? supplierId : null,
          supplierLoanStart: new Date().toISOString(),
          supplierLoanDue: source === 'Supplier' ? supplierLoanDue : null,
          depositPrice: depositPrice || null,
          maxLoanCount: source === 'Supplier' ? parseInt(maxLoanCount) || 3 : null,
          conditionGrade: 'A',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({
        title: `✓ ลงทะเบียนด่วนสำเร็จ`,
        description: `${data.asset.tagId} • ${data.asset.brand} ${data.asset.model} • S/N: ${data.asset.serialNo}`,
      })
      onRegistered(data.asset)
      onClose()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-purple-300 bg-purple-50 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5 text-purple-800">
          <Plus className="h-4 w-4" /> Quick Register — ยืมจาก Supplier / คลังขาย
        </h4>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="h-3 w-3" /></Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-600">รุ่นสินค้า <span className="text-rose-500">*</span></label>
          <Select value={catalogId} onValueChange={setCatalogId}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือกรุ่น..." /></SelectTrigger>
            <SelectContent>
              {catalogs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.brand} {c.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-600">Serial Number <span className="text-rose-500">*</span></label>
          <Input
            value={serialNo}
            onChange={(e) => setSerialNo(e.target.value)}
            placeholder="เช่น 25AB1234CD"
            className="mt-1 h-9 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-slate-600">Source <span className="text-rose-500">*</span></label>
          <Select value={source} onValueChange={(v) => setSource(v as 'Supplier' | 'Sales_Stock')}>
            <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Supplier">ยืมจาก Supplier</SelectItem>
              <SelectItem value="Sales_Stock">ยืมจากคลังขาย</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {source === 'Supplier' && (
          <div>
            <label className="text-xs text-slate-600">Supplier <span className="text-rose-500">*</span></label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue placeholder="เลือก Supplier..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{s.contactName ? ` (${s.contactName})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {source === 'Supplier' && (
          <>
            <div>
              <label className="text-xs text-slate-600">กำหนดคืน Supplier <span className="text-rose-500">*</span></label>
              <div className="relative mt-1">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="date"
                  value={supplierLoanDue}
                  onChange={(e) => setSupplierLoanDue(e.target.value)}
                  className="pl-7 h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600">ราคามัดจำ (บาท)</label>
              <Input
                type="number"
                value={depositPrice}
                onChange={(e) => setDepositPrice(e.target.value)}
                placeholder="0"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">จำกัดยืมสูงสุด (ครั้ง)</label>
              <Input
                type="number"
                value={maxLoanCount}
                onChange={(e) => setMaxLoanCount(e.target.value)}
                min="1"
                className="mt-1 h-9 text-sm"
              />
            </div>
          </>
        )}
      </div>

      {source === 'Supplier' && (
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div>
            เครื่องจาก Supplier มักยืมได้ {maxLoanCount} ครั้ง แล้วต้องส่งคืน
            หลังลูกค้าคืน → Store เลือก "คืนไปยัง source ต้นทาง" → ระบบเปลี่ยนสถานะเป็น "คืน Supplier แล้ว"
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={submit} disabled={submitting} className="flex-1">
          {submitting ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน + ใช้ยืมเลย'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>ยกเลิก</Button>
      </div>
    </div>
  )
}
