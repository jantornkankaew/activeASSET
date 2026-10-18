'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle, Clock, Phone, User, X, ChevronDown, ChevronUp,
} from 'lucide-react'
import { formatThaiDate } from '@/lib/activeasset-constants'

interface AlertData {
  overdue: Array<{
    tagId: string
    serialNo: string
    model: string
    brand: string
    supplierName: string
    supplierPhone: string
    supplierContact: string
    supplierLoanDue: string
    daysOverdue: number
    depositPrice: number | null
    status: string
  }>
  dueSoon: Array<{
    tagId: string
    serialNo: string
    model: string
    brand: string
    supplierName: string
    supplierPhone: string
    supplierContact: string
    supplierLoanDue: string
    daysUntilDue: number
    depositPrice: number | null
    status: string
  }>
  overLoanCount: Array<{
    tagId: string
    serialNo: string
    model: string
    brand: string
    supplierName: string
    loanCount: number
    maxLoanCount: number | null
    status: string
  }>
  summary: {
    overdueCount: number
    dueSoonCount: number
    overLoanCount: number
  }
}

// แสดง alert banner เมื่อมีเครื่อง Supplier ที่ใกล้/เลยกำหนดคืน หรือเกินจำนวนครั้งยืม
// สามารถ collapse/expand ได้
export function SupplierAlertsWidget() {
  const [data, setData] = useState<AlertData | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/notify')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
  }, [])

  if (!data) return null
  const totalAlerts = data.summary.overdueCount + data.summary.dueSoonCount + data.summary.overLoanCount
  if (totalAlerts === 0 || dismissed) return null

  return (
    <Card className={`mb-3 ${data.summary.overdueCount > 0 ? 'border-rose-300 bg-rose-50' : 'border-orange-300 bg-orange-50'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm flex items-center gap-2 ${data.summary.overdueCount > 0 ? 'text-rose-800' : 'text-orange-800'}`}>
            <AlertTriangle className="h-4 w-4" />
            แจ้งเตือน Supplier ({totalAlerts})
            {data.summary.overdueCount > 0 && (
              <Badge variant="outline" className="text-xs bg-rose-100 text-rose-700 border-rose-300">
                เลยกำหนด {data.summary.overdueCount}
              </Badge>
            )}
            {data.summary.dueSoonCount > 0 && (
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                ใกล้ครบ {data.summary.dueSoonCount}
              </Badge>
            )}
            {data.summary.overLoanCount > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                เกินจำนวนยืม {data.summary.overLoanCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {/* Overdue */}
              {data.overdue.map((a) => (
                <AlertRow
                  key={a.tagId}
                  tone="rose"
                  tagId={a.tagId}
                  model={`${a.brand} ${a.model}`}
                  supplierName={a.supplierName}
                  supplierPhone={a.supplierPhone}
                  supplierContact={a.supplierContact}
                  badge={`เลยกำหนด ${a.daysOverdue} วัน`}
                  dueInfo={`ครบกำหนด ${formatThaiDate(a.supplierLoanDue)}`}
                  extra={a.depositPrice ? `มัดจำ ฿${a.depositPrice.toLocaleString()}` : ''}
                  status={a.status}
                />
              ))}
              {/* Due soon */}
              {data.dueSoon.map((a) => (
                <AlertRow
                  key={a.tagId}
                  tone="orange"
                  tagId={a.tagId}
                  model={`${a.brand} ${a.model}`}
                  supplierName={a.supplierName}
                  supplierPhone={a.supplierPhone}
                  supplierContact={a.supplierContact}
                  badge={`ครบกำหนดใน ${a.daysUntilDue} วัน`}
                  dueInfo={`ครบกำหนด ${formatThaiDate(a.supplierLoanDue)}`}
                  extra={a.depositPrice ? `มัดจำ ฿${a.depositPrice.toLocaleString()}` : ''}
                  status={a.status}
                />
              ))}
              {/* Over loan count */}
              {data.overLoanCount.map((a) => (
                <AlertRow
                  key={a.tagId}
                  tone="amber"
                  tagId={a.tagId}
                  model={`${a.brand} ${a.model}`}
                  supplierName={a.supplierName}
                  badge={`ยืม ${a.loanCount}/${a.maxLoanCount} ครั้ง`}
                  dueInfo={`ควรส่งคืน Supplier แล้ว`}
                  status={a.status}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  )
}

function AlertRow({
  tone, tagId, model, supplierName, supplierPhone, supplierContact, badge, dueInfo, extra, status,
}: {
  tone: 'rose' | 'orange' | 'amber'
  tagId: string
  model: string
  supplierName: string
  supplierPhone?: string
  supplierContact?: string
  badge: string
  dueInfo: string
  extra?: string
  status: string
}) {
  const toneClasses = {
    rose: 'bg-rose-100 border-rose-300 text-rose-800',
    orange: 'bg-orange-100 border-orange-300 text-orange-800',
    amber: 'bg-amber-100 border-amber-300 text-amber-800',
  }
  return (
    <div className={`p-2 rounded border text-xs ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-semibold">{tagId}</span>
        <span className="text-slate-600">{model}</span>
        <Badge variant="outline" className="text-xs bg-white">{badge}</Badge>
        <Badge variant="outline" className="text-xs bg-white">{status}</Badge>
      </div>
      <div className="mt-1 text-slate-700">
        <Clock className="inline h-3 w-3 mr-1" />
        {dueInfo}
        {extra && <span className="ml-2">• {extra}</span>}
      </div>
      <div className="mt-0.5 text-slate-700">
        Supplier: <b>{supplierName}</b>
        {supplierContact && <span className="ml-2 flex items-center gap-0.5 inline-flex"><User className="h-3 w-3" />{supplierContact}</span>}
        {supplierPhone && (
          <a href={`tel:${supplierPhone}`} className="ml-2 flex items-center gap-0.5 inline-flex text-blue-700 hover:underline">
            <Phone className="h-3 w-3" />{supplierPhone}
          </a>
        )}
      </div>
    </div>
  )
}
