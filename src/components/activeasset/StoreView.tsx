'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { SignaturePad, SignaturePadHandle } from './SignaturePad'
import {
  Search, ScanLine, ArrowLeft, FileText, CheckCircle2, AlertCircle,
  Package, Wrench, Calendar, User, ClipboardCheck, ShieldCheck, History, Eye
} from 'lucide-react'
import {
  getLoanStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime,
  GRADE_LABELS, ASSET_STATUS_LABELS,
} from '@/lib/activeasset-constants'

interface LoanListItem {
  docNo: string
  customerName: string
  customerCompany: string | null
  salesRepName: string
  purpose: string
  checkoutDate: string
  expectedReturnDate: string
  closedAt: string | null
  status: string
  termsAndNotes: string | null
  customerSignedAt: string | null
  customerSignedBy: string | null
  totalItems: number
  returnedItems: number
  pendingItems: number
  lines: {
    id: string
    assetTagId: string
    serialNo: string
    model: string
    brand: string
    status: string
    returnedAt: string | null
    accessoriesHandedOver: string[]
  }[]
}

interface ReturnItemForm {
  loanLineItemId: string
  selected: boolean
  conditionGrade: 'A' | 'B' | 'C' | 'D'
  accessoriesReturned: string[]
  isDamaged: boolean
  damageDescription: string
  sendToRepair: boolean
  nextLocationId: string
}

export function StoreView() {
  const { toast } = useToast()
  const [loans, setLoans] = useState<LoanListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedLoan, setSelectedLoan] = useState<LoanListItem | null>(null)

  // Return form state
  const [returnForms, setReturnForms] = useState<Record<string, ReturnItemForm>>({})
  const [inspectorName, setInspectorName] = useState('เจ้าหน้าที่คลัง (Store)')
  const [returnNotes, setReturnNotes] = useState('')
  const [sigHasContent, setSigHasContent] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)
  const [submitting, setSubmitting] = useState(false)

  // History modal
  const [historyDocNo, setHistoryDocNo] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<unknown>(null)

  const loadLoans = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/loans?${params.toString()}`)
    const data = await res.json()
    setLoans(data.loans || [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    const t = setTimeout(loadLoans, 250)
    return () => clearTimeout(t)
  }, [loadLoans])

  const openLoan = (loan: LoanListItem) => {
    setSelectedLoan(loan)
    // Initialize return forms for items that are still Out
    const forms: Record<string, ReturnItemForm> = {}
    for (const line of loan.lines) {
      if (line.status === 'Out') {
        forms[line.id] = {
          loanLineItemId: line.id,
          selected: false,
          conditionGrade: 'A',
          accessoriesReturned: [...line.accessoriesHandedOver],
          isDamaged: false,
          damageDescription: '',
          sendToRepair: false,
          nextLocationId: '',
        }
      }
    }
    setReturnForms(forms)
  }

  const updateForm = (lineId: string, patch: Partial<ReturnItemForm>) => {
    setReturnForms((prev) => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }))
  }

  const toggleAccessory = (lineId: string, acc: string) => {
    const form = returnForms[lineId]
    if (!form) return
    const has = form.accessoriesReturned.includes(acc)
    updateForm(lineId, {
      accessoriesReturned: has
        ? form.accessoriesReturned.filter((x) => x !== acc)
        : [...form.accessoriesReturned, acc],
    })
  }

  const submitReturn = async () => {
    if (!selectedLoan) return
    const selectedItems = Object.values(returnForms).filter((f) => f.selected)
    if (selectedItems.length === 0) {
      toast({ title: 'เลือกเครื่องที่จะรับคืนอย่างน้อย 1 เครื่อง', variant: 'destructive' })
      return
    }
    if (!inspectorName.trim()) {
      toast({ title: 'ต้องระบุชื่อเจ้าหน้าที่ตรวจรับ', variant: 'destructive' })
      return
    }
    const sig = sigRef.current?.toDataURL()
    if (!sig) {
      toast({ title: 'เจ้าหน้าที่ต้องลงลายมือชื่อก่อนยืนยัน', variant: 'destructive' })
      return
    }
    // ตรวจ D ที่ไม่ได้ระบุ damage
    for (const item of selectedItems) {
      if (item.conditionGrade === 'D' && !item.damageDescription.trim()) {
        toast({
          title: `เครื่องในรายการเป็น Grade D ต้องระบุรายละเอียดความเสียหาย`,
          variant: 'destructive',
        })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/loans/${selectedLoan.docNo}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectorName,
          inspectorSignature: sig,
          notes: returnNotes,
          items: selectedItems.map((f) => ({
            loanLineItemId: f.loanLineItemId,
            conditionGrade: f.conditionGrade,
            accessoriesReturned: f.accessoriesReturned,
            isDamaged: f.isDamaged || f.conditionGrade === 'D',
            damageDescription: f.damageDescription,
            sendToRepair: f.sendToRepair || f.conditionGrade === 'D',
            nextLocationId: f.nextLocationId || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'รับคืนไม่สำเร็จ')
      toast({
        title: `รับคืนสำเร็จ (${selectedItems.length} เครื่อง)`,
        description: data.loanStatus === 'Returned' ? 'ใบยืมปิดสมบูรณ์แล้ว' : `สถานะใบยืม: ${getLoanStatusLabel(data.loanStatus).label} • คงค้าง ${data.remaining} เครื่อง`,
      })
      // Reload loans
      await loadLoans()
      setSelectedLoan(null)
      sigRef.current?.clear()
      setSigHasContent(false)
      setReturnNotes('')
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const openHistory = async (docNo: string) => {
    setHistoryDocNo(docNo)
    setHistoryData(null)
    const res = await fetch(`/api/loans/${docNo}`)
    const data = await res.json()
    setHistoryData(data.loan)
  }

  if (selectedLoan) {
    return (
      <LoanReturnPanel
        loan={selectedLoan}
        returnForms={returnForms}
        inspectorName={inspectorName}
        setInspectorName={setInspectorName}
        returnNotes={returnNotes}
        setReturnNotes={setReturnNotes}
        sigRef={sigRef}
        sigHasContent={sigHasContent}
        setSigHasContent={setSigHasContent}
        submitting={submitting}
        onBack={() => setSelectedLoan(null)}
        onToggleAccessory={toggleAccessory}
        onUpdateForm={updateForm}
        onSubmit={submitReturn}
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ค้นหาเลขที่ใบยืม / ชื่อลูกค้า / บริษัท..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { v: 'all', l: 'ทั้งหมด' },
                { v: 'Active', l: 'เปิดอยู่' },
                { v: 'Partially_Returned', l: 'คืนบางส่วน' },
                { v: 'Overdue', l: 'เกินกำหนด' },
                { v: 'Returned', l: 'ปิดแล้ว' },
              ].map((f) => (
                <Button
                  key={f.v}
                  variant={statusFilter === f.v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(f.v)}
                >
                  {f.l}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> รายการใบยืม ({loans.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[560px]">
            <div className="divide-y">
              {loading && <p className="p-6 text-center text-slate-500">กำลังโหลด...</p>}
              {!loading && loans.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่พบใบยืม</p>
                </div>
              )}
              {loans.map((l) => {
                const st = getLoanStatusLabel(l.status)
                return (
                  <div key={l.docNo} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-slate-900">{l.docNo}</span>
                          <Badge variant="outline" className={`text-xs ${st.color} ${st.bg}`}>{st.label}</Badge>
                          <Badge variant="outline" className="text-xs">{getPurposeLabel(l.purpose)}</Badge>
                        </div>
                        <div className="text-sm text-slate-700 mt-1">{l.customerName}{l.customerCompany ? ` — ${l.customerCompany}` : ''}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          ยืม {formatThaiDate(l.checkoutDate)} • ครบกำหนด {formatThaiDate(l.expectedReturnDate)} • พนักงาน {l.salesRepName}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-3">
                          <span className="text-slate-600">ทั้งหมด <b>{l.totalItems}</b> เครื่อง</span>
                          <span className="text-emerald-600">คืนแล้ว <b>{l.returnedItems}</b></span>
                          <span className="text-amber-600">ค้าง <b>{l.pendingItems}</b></span>
                          {l.customerSignedAt && <span className="text-slate-500">ลูกค้าเซ็นแล้ว</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {l.pendingItems > 0 && (
                          <Button size="sm" onClick={() => openLoan(l)}>
                            <ScanLine className="h-4 w-4 mr-1" /> รับคืน
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openHistory(l.docNo)}>
                          <History className="h-4 w-4 mr-1" /> ประวัติ
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {historyDocNo && (
        <HistoryModal docNo={historyDocNo} data={historyData} onClose={() => setHistoryDocNo(null)} />
      )}
    </div>
  )
}

// ===== Loan Return Panel =====
function LoanReturnPanel({
  loan, returnForms, inspectorName, setInspectorName, returnNotes, setReturnNotes,
  sigRef, sigHasContent, setSigHasContent, submitting, onBack,
  onToggleAccessory, onUpdateForm, onSubmit,
}: {
  loan: LoanListItem
  returnForms: Record<string, ReturnItemForm>
  inspectorName: string
  setInspectorName: (v: string) => void
  returnNotes: string
  setReturnNotes: (v: string) => void
  sigRef: React.RefObject<SignaturePadHandle>
  sigHasContent: boolean
  setSigHasContent: (v: boolean) => void
  submitting: boolean
  onBack: () => void
  onToggleAccessory: (lineId: string, acc: string) => void
  onUpdateForm: (lineId: string, patch: Partial<ReturnItemForm>) => void
  onSubmit: () => void
}) {
  const pendingLines = loan.lines.filter((l) => l.status === 'Out')
  const returnedLines = loan.lines.filter((l) => l.status === 'Returned')
  const selectedCount = Object.values(returnForms).filter((f) => f.selected).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-lg">{loan.docNo}</span>
            <Badge variant="outline" className={`text-xs ${getLoanStatusLabel(loan.status).color} ${getLoanStatusLabel(loan.status).bg}`}>{getLoanStatusLabel(loan.status).label}</Badge>
          </div>
          <div className="text-sm text-slate-600">{loan.customerName}{loan.customerCompany ? ` — ${loan.customerCompany}` : ''}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: items to return */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" /> เครื่องที่รอรับคืน ({pendingLines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pendingLines.length === 0 && <p className="p-6 text-center text-slate-500">ไม่มีเครื่องค้างคืน</p>}
              <div className="divide-y">
                {pendingLines.map((line) => {
                  const form = returnForms[line.id]
                  if (!form) return null
                  return (
                    <ReturnItemCard
                      key={line.id}
                      line={line}
                      form={form}
                      onToggleSelected={(v) => onUpdateForm(line.id, { selected: v })}
                      onGradeChange={(g) => onUpdateForm(line.id, {
                        conditionGrade: g,
                        sendToRepair: g === 'D' ? true : form.sendToRepair,
                        isDamaged: g === 'D' ? true : form.isDamaged,
                      })}
                      onToggleAccessory={(acc) => onToggleAccessory(line.id, acc)}
                      onDamagedChange={(v) => onUpdateForm(line.id, { isDamaged: v })}
                      onDamageDescChange={(v) => onUpdateForm(line.id, { damageDescription: v })}
                      onSendRepairChange={(v) => onUpdateForm(line.id, { sendToRepair: v })}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {returnedLines.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> รับคืนแล้ว ({returnedLines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {returnedLines.map((line) => (
                    <div key={line.id} className="p-3 flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <div className="flex-1">
                        <span className="font-mono">{line.assetTagId}</span>
                        <span className="text-slate-500"> • {line.brand} {line.model}</span>
                      </div>
                      <span className="text-xs text-slate-500">คืน {line.returnedAt ? formatThaiDate(line.returnedAt) : '-'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: inspector info + signature */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">ข้อมูลเจ้าหน้าที่</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">ชื่อเจ้าหน้าที่ตรวจรับ <span className="text-rose-500">*</span></label>
                <div className="relative mt-1">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} className="pl-8" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">หมายเหตุ</label>
                <Textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} placeholder="หมายเหตุการรับคืน..." className="mt-1 min-h-[60px]" />
              </div>
              <div className="bg-slate-50 border rounded-md p-3 text-xs space-y-1">
                <div className="font-medium text-slate-700">สรุปการรับคืน</div>
                <div className="flex justify-between"><span>เลือกรับคืน:</span> <b>{selectedCount} เครื่อง</b></div>
                <div className="flex justify-between"><span>คงค้างหลังยืนยัน:</span> <b>{pendingLines.length - selectedCount} เครื่อง</b></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <SignaturePad ref={sigRef} label="ลายมือชื่อเจ้าหน้าที่รับคืน" required onChange={setSigHasContent} />
              <p className="text-xs text-slate-400 mt-2">ประทับเวลา: {new Date().toLocaleString('th-TH')}</p>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={onSubmit}
            disabled={submitting || selectedCount === 0 || !sigHasContent || !inspectorName}
          >
            {submitting ? 'กำลังบันทึก...' : <><ShieldCheck className="h-4 w-4 mr-2" /> ยืนยันรับคืน ({selectedCount})</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ReturnItemCard({
  line, form, onToggleSelected, onGradeChange, onToggleAccessory, onDamagedChange, onDamageDescChange, onSendRepairChange,
}: {
  line: LoanListItem['lines'][0]
  form: ReturnItemForm
  onToggleSelected: (v: boolean) => void
  onGradeChange: (g: 'A' | 'B' | 'C' | 'D') => void
  onToggleAccessory: (acc: string) => void
  onDamagedChange: (v: boolean) => void
  onDamageDescChange: (v: string) => void
  onSendRepairChange: (v: boolean) => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Checkbox checked={form.selected} onCheckedChange={(v) => onToggleSelected(!!v)} className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold">{line.assetTagId}</span>
            <Badge variant="outline" className="text-xs">{line.brand} {line.model}</Badge>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">S/N: <span className="font-mono">{line.serialNo}</span></div>
        </div>
      </div>

      {form.selected && (
        <div className="mt-3 ml-7 space-y-3 border-l-2 border-slate-200 pl-4">
          {/* Accessories checklist */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">ตรวจสอบอุปกรณ์เสริมที่คืน</div>
            <div className="space-y-1.5">
              {line.accessoriesHandedOver.map((acc) => {
                const checked = form.accessoriesReturned.includes(acc)
                return (
                  <div key={acc} className={`flex items-center gap-2 p-2 rounded border ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <Checkbox checked={checked} onCheckedChange={() => onToggleAccessory(acc)} />
                    <span className={`text-sm ${checked ? 'text-emerald-700' : 'text-rose-700 line-through'}`}>{acc}</span>
                    {checked ? <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" /> : <AlertCircle className="h-3 w-3 text-rose-500 ml-auto" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grade */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2">ประเมินเกรดสภาพเครื่อง</div>
            <RadioGroup value={form.conditionGrade} onValueChange={(v) => onGradeChange(v as 'A' | 'B' | 'C' | 'D')} className="grid grid-cols-2 gap-2">
              {(['A', 'B', 'C', 'D'] as const).map((g) => {
                const info = GRADE_LABELS[g]
                return (
                  <label key={g} className={`flex items-start gap-2 p-2 border rounded-md cursor-pointer ${form.conditionGrade === g ? `${info.bg} border-current` : 'bg-white border-slate-200'}`}>
                    <RadioGroupItem value={g} className="mt-0.5" />
                    <div>
                      <div className={`text-sm font-bold ${info.color}`}>Grade {info.label}</div>
                      <div className="text-xs text-slate-600">{info.description}</div>
                    </div>
                  </label>
                )
              })}
            </RadioGroup>
          </div>

          {/* Damage (auto-shown for D) */}
          {(form.isDamaged || form.conditionGrade === 'D') && (
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-700">รายละเอียดความเสียหาย</label>
                <Textarea value={form.damageDescription} onChange={(e) => onDamageDescChange(e.target.value)} placeholder="เช่น จอแตก, หัวพิมพ์ขาด, ปุ่มกดไม่ทำงาน..." className="mt-1 min-h-[60px]" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.sendToRepair} onCheckedChange={(v) => onSendRepairChange(!!v)} />
                <span className="text-purple-700">ส่งเข้าคิวซ่อม (สร้าง RMA Ticket อัตโนมัติ)</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryModal({ docNo, data, onClose }: { docNo: string; data: unknown; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2"><History className="h-4 w-4" /> ประวัติใบยืม {docNo}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {!data && <p className="text-center text-slate-500 py-8">กำลังโหลด...</p>}
            {data && <HistoryContent loan={data as Record<string, unknown>} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function HistoryContent({ loan }: { loan: Record<string, unknown> }) {
  const returnEvents = (loan.returnEvents as Array<Record<string, unknown>>) || []
  const lines = (loan.lines as Array<Record<string, unknown>>) || []
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-md">
        <div>ลูกค้า: <b>{String(loan.customerName ?? '')}</b></div>
        <div>บริษัท: <b>{String(loan.customerCompany ?? '-')}</b></div>
        <div>พนักงาน: <b>{String(loan.salesRepName ?? '')}</b></div>
        <div>วัตถุประสงค์: <b>{getPurposeLabel(String(loan.purpose ?? ''))}</b></div>
        <div>วันยืม: <b>{formatThaiDate(loan.checkoutDate as string)}</b></div>
        <div>กำหนดคืน: <b>{formatThaiDate(loan.expectedReturnDate as string)}</b></div>
      </div>

      {loan.customerSignAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> ลูกค้าลงนามแล้ว
          </div>
          <div className="mt-1">ผู้ลงนาม: {String(loan.customerSignBy ?? '-')} • เวลา: {formatThaiDateTime(loan.customerSignAt as string)}</div>
          {loan.customerSignature && (
            <img src={loan.customerSignature as string} alt="ลายเซ็นลูกค้า" className="mt-2 max-h-24 border rounded bg-white" />
          )}
        </div>
      )}

      <div>
        <h4 className="font-semibold mb-2">รายการเครื่อง ({lines.length})</h4>
        <div className="divide-y border rounded">
          {lines.map((line, i) => {
            const asset = line.asset as Record<string, unknown>
            const catalog = asset?.catalog as Record<string, unknown>
            return (
              <div key={String(line.id ?? i)} className="p-2 flex items-center gap-2">
                <span className="font-mono text-xs">{String(asset?.tagId ?? '')}</span>
                <span className="text-xs text-slate-600">{String(catalog?.brand ?? '')} {String(catalog?.model ?? '')}</span>
                <Badge variant="outline" className="ml-auto text-xs">{String(line.status ?? '')}</Badge>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">ประวัติการรับคืน ({returnEvents.length})</h4>
        {returnEvents.length === 0 ? (
          <p className="text-slate-500 text-xs">ยังไม่มีการรับคืน</p>
        ) : (
          <div className="space-y-2">
            {returnEvents.map((ev, i) => (
              <div key={String(ev.id ?? i)} className="border rounded p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">รับคืนครั้งที่ {i + 1}</span>
                  <span className="text-xs text-slate-500">{formatThaiDateTime(ev.returnDate as string)}</span>
                </div>
                <div className="text-xs text-slate-600">เจ้าหน้าที่: {String(ev.inspectorName ?? '-')}</div>
                {ev.inspectorSignAt && <div className="text-xs text-slate-600">เวลาลงนาม: {formatThaiDateTime(ev.inspectorSignAt as string)}</div>}
                {ev.notes && <div className="text-xs text-slate-500 mt-1">หมายเหตุ: {String(ev.notes)}</div>}
                <div className="mt-2 space-y-1">
                  {((ev.items as Array<Record<string, unknown>>) || []).map((item, j) => {
                    const lineItem = item.loanLineItem as Record<string, unknown>
                    const a = lineItem?.asset as Record<string, unknown>
                    const c = a?.catalog as Record<string, unknown>
                    return (
                      <div key={String(item.id ?? j)} className="text-xs flex items-center gap-2 bg-white p-2 rounded border">
                        <span className="font-mono">{String(a?.tagId ?? '')}</span>
                        <span>{String(c?.brand ?? '')} {String(c?.model ?? '')}</span>
                        <Badge variant="outline" className="ml-auto">Grade {String(item.conditionGrade ?? '')}</Badge>
                        {item.sendToRepair ? <Badge variant="outline" className="text-purple-700 text-xs">ส่งซ่อม</Badge> : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
