'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import {
  Settings2, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, GripVertical, X,
} from 'lucide-react'

interface WidgetPref {
  id: string
  widgetKey: string
  position: number
  visible: boolean
  config: string | null
}

const WIDGET_LABELS: Record<string, string> = {
  stats: 'สถิติทั่วไป (Stats)',
  quickActions: 'ปุ่ม Quick Actions',
  overdue: 'ใบยืมเกินกำหนด',
  standby: 'เครื่องสำรองซ่อม',
  supplierAlerts: 'แจ้งเตือน Supplier',
  brandDistribution: 'สัดส่วนแบรนด์',
  deadStock: 'ของดอง',
}

interface WidgetEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

// WidgetEditor — drag-drop ไม่ใช้ library แต่ใช้ up/down buttons + toggle visible
// (เรียบง่าย + ไม่ต้องติดตั้ง dependency เพิ่ม)
export function WidgetEditor({ open, onOpenChange, onChanged }: WidgetEditorProps) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<WidgetPref[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard-prefs')
      const data = await res.json()
      setPrefs(data.preferences || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const move = (id: string, direction: 'up' | 'down') => {
    setPrefs(prev => {
      const sorted = [...prev].sort((a, b) => a.position - b.position)
      const idx = sorted.findIndex(p => p.id === id)
      if (idx < 0) return prev
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= sorted.length) return prev
      // swap positions
      const tmp = sorted[idx].position
      sorted[idx].position = sorted[newIdx].position
      sorted[newIdx].position = tmp
      return [...sorted]
    })
  }

  const toggleVisible = (id: string) => {
    setPrefs(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))
  }

  const save = async () => {
    setSaving(true)
    try {
      // ส่งทุก pref ไปอัปเดต
      for (const p of prefs) {
        await fetch('/api/dashboard-prefs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            widgetKey: p.widgetKey,
            visible: p.visible,
            position: p.position,
          }),
        })
      }
      toast({ title: '✓ บันทึกการจัดเรียงสำเร็จ' })
      onChanged()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    if (!confirm('รีเซ็ตเป็นค่า default?')) return
    setSaving(true)
    try {
      await fetch('/api/dashboard-prefs', { method: 'POST' })
      await load()
      toast({ title: '✓ รีเซ็ตเป็น default แล้ว' })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...prefs].sort((a, b) => a.position - b.position)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> จัดเรียง Dashboard
          </SheetTitle>
          <SheetDescription>
            ลากขึ้น/ลงเพื่อจัดลำดับ + เปิด/ปิด widget
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && <p className="text-center text-slate-500 text-sm py-4">กำลังโหลด...</p>}
          {!loading && sorted.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 p-2 border rounded ${p.visible ? 'bg-white' : 'bg-slate-50 opacity-60'}`}
            >
              <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
              <span className="font-mono text-xs text-slate-400 w-6">{idx + 1}</span>
              <span className="flex-1 text-sm">{WIDGET_LABELS[p.widgetKey] || p.widgetKey}</span>
              <Badge variant="outline" className={`text-xs ${p.visible ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500'}`}>
                {p.visible ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                {p.visible ? 'แสดง' : 'ซ่อน'}
              </Badge>
              <div className="flex flex-col">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-6 p-0"
                  disabled={idx === 0}
                  onClick={() => move(p.id, 'up')}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-6 p-0"
                  disabled={idx === sorted.length - 1}
                  onClick={() => move(p.id, 'down')}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => toggleVisible(p.id)}
              >
                {p.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t p-3 flex gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> รีเซ็ต
          </Button>
          <Button size="sm" onClick={save} disabled={saving} className="flex-1">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
