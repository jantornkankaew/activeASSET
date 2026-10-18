'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  LoanStatusBadge, PurposeBadge, SourceBadge, GradeBadge,
} from './shared'
import {
  ScanLine, CheckCircle2, AlertCircle, ShieldCheck, User, Wrench,
  History, Package,
} from 'lucide-react'
import {
  getLoanStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime,
  GRADE_LABELS, SOURCE_LABELS,
} from '@/lib/activeasset-constants'

interface LoanLineItem {
  id: string
  assetTagId: string
  serialNo: string
  model: string
  brand: string
  source: string
  status: string
  returnedAt: string | null
  accessoriesHandedOver: string[]
  photos?: Array<{ id: string; photoPath: string; caption: string | null }>
}

interface ReturnEvent {
  id: string
  returnDate: string
  inspectorName: string
  inspectorSignAt: string | null
  notes: string | null
  items: Array<{
    id: string
    conditionGrade: string
    isDamaged: boolean
    damageDescription: string | null
    sendToRepair: boolean
    returnToSource: boolean
    accessoriesReturned: string[]
    loanLineItem: { asset: { tagId: string; serialNo: string; catalog: { model: string; brand: string } } }
  }>
}

interface LoanDetail {
  docNo: string
  customerName: string
  customerCompany: string | null
  salesRepName: string
  purpose: string
  expectedReturnDate: string
  status: string
  lines: LoanLineItem[]
  returnEvents?: ReturnEvent[]
}

interface ReturnItemForm {
  loanLineItemId: string
  selected: boolean
  conditionGrade: 'A' | 'B' | 'C' | 'D'
  accessoriesReturned: string[]
  isDamaged: boolean
  damageDescription: string
  sendToRepair: boolean
  returnToSource: boolean // default true — คืนตาม source ต้นทาง
}

interface ReturnLoanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: LoanDetail | null
  onDone: () => void
}

// ReturnLoanSheet (Phase 4) — รับคืน + ตรวจสภาพ + Grade + รองรับ source-based return
export function ReturnLoanSheet({ open, onOpenChange, loan, onDone }: ReturnLoanSheetProps) {
  const { toast } = useToast()
  const [forms, setForms] = useState<Record<string, ReturnItemForm>>({})
  const [inspectorName, setInspectorName] = useState('เจ้าหน้าที่คลัง (Store)')
  const [returnNotes, setReturnNotes] = useState('')
  const [sigHasContent, setSigHasContent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)

  useEffect(() => {
    if (open && loan) {
      const f: Record<string, ReturnItemForm> = {}
      for (const line of loan.lines) {
        if (line.status === 'Out') {
          const acc = Array.isArray(line.accessoriesHandedOver) ? line.accessoriesHandedOver : []
          f[line.id] = {
            loanLineItemId: line.id,
            selected: false,
            conditionGrade: 'A',
            accessoriesReturned: [...acc],
            isDamaged: false,
            damageDescription: '',
            sendToRepair: false,
            returnToSource: true, // default คืนตาม source ต้นทาง
          }
        }
      }
      setForms(f)
      setReturnNotes('')
      sigRef.current?.clear()
      setSigHasContent(false)
    }
  }, [open, loan])

  if (!loan) return null

  const updateForm = (lineId: string, patch: Partial<ReturnItemForm>) => {
    setForms((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))
  }
  const toggleAccessory = (lineId: string, acc: string) => {
    const f = forms[lineId]
    if (!f) return
    const has = f.accessoriesReturned.includes(acc)
    updateForm(lineId, {
      accessoriesReturned: has ? f.accessoriesReturned.filter((x) => x !== acc) : [...f.accessoriesReturned, acc],
    })
  }

  const pendingLines = loan.lines.filter((l) => l.status === 'Out')
  const returnedLines = loan.lines.filter((l) => l.status === 'Returned')
  const selectedCount = Object.values(forms).filter((f) => f.selected).length

  const submit = async () => {
    if (!loan) return
    const selected = Object.values(forms).filter((f) => f.selected)
    if (selected.length === 0) {
      toast({ title: 'เลือกเครื่องที่จะรับคืน', variant: 'destructive' })
      return
    }
    if (!inspectorName.trim()) {
      toast({ title: 'ต้องระบุชื่อเจ้าหน้าที่', variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'เจ้าหน้าที่ต้องลงลายมือชื่อ', variant: 'destructive' })
      return
    }
    for (const item of selected) {
      if (item.conditionGrade === 'D' && !item.damageDescription.trim()) {
        toast({ title: 'Grade D ต้องระบุรายละเอียดความเสียหาย', variant: 'destructive' })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${loan.docNo}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorName,
          inspectorSignature: sig,
          notes: returnNotes,
          items: selected.map((f) => ({
            loanLineItemId: f.loanLineItemId,
            conditionGrade: f.conditionGrade,
            accessoriesReturned: f.accessoriesReturned,
            isDamaged: f.isDamaged || f.conditionGrade === 'D',
            damageDescription: f.damageDescription,
            sendToRepair: f.sendToRepair || f.conditionGrade === 'D',
            returnToSource: f.returnToSource,
            nextLocationId: null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'รับคืนไม่สำเร็จ')
      toast({
        title: `✓ รับคืนสำเร็จ (${selected.length} เครื่อง)`,
        description: data.loanStatus === 'Returned' ? 'ใบยืมปิดสมบูรณ์' : `คงค้าง ${data.remaining} เครื่อง`,
      })
      onOpenChange(false)
      onDone()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" /> รับคืน — {loan.docNo}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <LoanStatusBadge status={loan.status} />
            <span>{loan.customerName}{loan.customerCompany ? ` • ${loan.customerCompany}` : ''}</span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Package className="h-4 w-4" /> รอรับคืน ({pendingLines.length})
              </h3>
              <div className="space-y-2">
                {pendingLines.map((line) => {
                  const f = forms[line.id]
                  if (!f) return null
                  return (
                    <div key={line.id} className="border rounded-md p-2.5">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={f.selected} onCheckedChange={(v) => updateForm(line.id, { selected: !!v })} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-medium">{line.assetTagId}</span>
                            <Badge variant="outline" className="text-xs">{line.brand} {line.model}</Badge>
                            <SourceBadge source={line.source} />
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">S/N: <span className="font-mono">{line.serialNo}</span></div>
                          {/* Source return hint */}
                          {line.source === 'Supplier' && (
                            <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded p-1 mt-1">
                              ⚠ เครื่องนี้ยืมจาก Supplier — คืนตาม source = ส่งคืน Supplier
                            </div>
                          )}
                          {line.source === 'Sales_Stock' && (
                            <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-1 mt-1">
                              เครื่องนี้จากคลังขาย — คืนตาม source = กลับคลังขาย
                            </div>
                          )}
                        </div>
                      </div>

                      {f.selected && (
                        <div className="mt-2 ml-6 space-y-2 border-l-2 border-slate-200 pl-3">
                          {/* Accessories */}
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">อุปกรณ์เสริมที่คืน</div>
                            <div className="space-y-1">
                              {line.accessoriesHandedOver.map((acc) => {
                                const checked = f.accessoriesReturned.includes(acc)
                                return (
                                  <div key={acc} className={`flex items-center gap-1.5 p-1.5 rounded border text-xs ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                                    <Checkbox checked={checked} onCheckedChange={() => toggleAccessory(line.id, acc)} className="h-3 w-3" />
                                    <span className={checked ? 'text-emerald-700' : 'text-rose-700 line-through'}>{acc}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Grade */}
                          <div>
                            <div className="text-xs font-medium text-slate-700 mb-1">เกรดสภาพ</div>
                            <RadioGroup value={f.conditionGrade} onValueChange={(g) => updateForm(line.id, {
                              conditionGrade: g as 'A' | 'B' | 'C' | 'D',
                              sendToRepair: g === 'D' ? true : f.sendToRepair,
                              isDamaged: g === 'D' ? true : f.isDamaged,
                            })} className="grid grid-cols-2 gap-1">
                              {(['A', 'B', 'C', 'D'] as const).map((g) => {
                                const info = GRADE_LABELS[g]
                                return (
                                  <label key={g} className={`flex items-start gap-1.5 p-1.5 border rounded cursor-pointer text-xs ${f.conditionGrade === g ? `${info.bg} border-current` : 'bg-white border-slate-200'}`}>
                                    <RadioGroupItem value={g} className="mt-0.5 h-3 w-3" />
                                    <div>
                                      <div className={`font-bold ${info.color}`}>Grade {info.label}</div>
                                      <div className="text-slate-600">{info.description}</div>
                                    </div>
                                  </label>
                                )
                              })}
                            </RadioGroup>
                          </div>

                          {/* Source return option */}
                          {line.source !== 'Demo_Stock' && (
                            <label className="flex items-center gap-1.5 text-xs">
                              <Checkbox
                                checked={f.returnToSource}
                                onCheckedChange={(v) => updateForm(line.id, { returnToSource: !!v })}
                                className="h-3 w-3"
                              />
                              <span>คืนไปยัง source ต้นทาง ({SOURCE_LABELS[line.source]?.label})</span>
                            </label>
                          )}

                          {/* Damage */}
                          {(f.isDamaged || f.conditionGrade === 'D') && (
                            <div className="space-y-1.5">
                              <Textarea
                                value={f.damageDescription}
                                onChange={(e) => updateForm(line.id, { damageDescription: e.target.value })}
                                placeholder="รายละเอียดความเสียหาย..."
                                className="min-h-[50px] text-xs"
                              />
                              <label className="flex items-center gap-1.5 text-xs">
                                <Checkbox checked={f.sendToRepair} onCheckedChange={(v) => updateForm(line.id, { sendToRepair: !!v })} className="h-3 w-3" />
                                <span className="text-purple-700">ส่งเข้าคิวซ่อม (สร้าง RMA อัตโนมัติ)</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {returnedLines.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> รับคืนแล้ว ({returnedLines.length})
                  </h3>
                  <div className="space-y-1">
                    {returnedLines.map((line) => (
                      <div key={line.id} className="flex items-center gap-2 p-1.5 text-xs bg-slate-50 rounded">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="font-mono">{line.assetTagId}</span>
                        <span className="text-slate-500">{line.brand} {line.model}</span>
                        <SourceBadge source={line.source} className="ml-auto" />
                        <span className="text-slate-400">{line.returnedAt ? formatThaiDate(line.returnedAt) : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {loan.returnEvents && loan.returnEvents.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <History className="h-4 w-4" /> ประวัติรับคืน ({loan.returnEvents.length})
                  </h3>
                  <div className="space-y-1.5">
                    {loan.returnEvents.map((ev, i) => (
                      <div key={ev.id} className="border rounded p-2 bg-slate-50 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">ครั้งที่ {i + 1} — {ev.inspectorName}</span>
                          <span className="text-slate-500">{formatThaiDateTime(ev.returnDate)}</span>
                        </div>
                        {ev.notes && <div className="text-slate-500 mt-0.5">หมายเหตุ: {ev.notes}</div>}
                        <div className="mt-1 space-y-0.5">
                          {ev.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 bg-white p-1 rounded border">
                              <span className="font-mono">{item.loanLineItem.asset.tagId}</span>
                              <span className="text-slate-600">{item.loanLineItem.asset.catalog.brand} {item.loanLineItem.asset.catalog.model}</span>
                              <span className="ml-auto flex items-center gap-1">
                                <GradeBadge grade={item.conditionGrade} />
                                {item.sendToRepair && <Badge variant="outline" className="text-xs text-purple-700">ซ่อม</Badge>}
                                {!item.returnToSource && <Badge variant="outline" className="text-xs text-amber-700">เปลี่ยน source</Badge>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-2">
              <h3 className="text-sm font-medium">ข้อมูลเจ้าหน้าที่</h3>
              <div>
                <label className="text-xs text-slate-600">ชื่อเจ้าหน้าที่ <span className="text-rose-500">*</span></label>
                <div className="relative mt-1">
                  <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} className="pl-7 h-9 text-sm" />
                </div>
              </div>
              <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="หมายเหตุ..." className="min-h-[50px] text-sm" />
            </div>

            <SignaturePad ref={sigRef} label="ลายมือชื่อเจ้าหน้าที่รับคืน" required height={120} onChange={setSigHasContent} />
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <Button
            className="w-full"
            size="lg"
            onClick={submit}
            disabled={submitting || selectedCount === 0 || !sigHasContent || !inspectorName}
          >
            {submitting ? 'กำลังบันทึก...' : <><ShieldCheck className="h-4 w-4 mr-2" /> ยืนยันรับคืน ({selectedCount})</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
