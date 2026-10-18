'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import {
  Package, AlertTriangle, Wrench, Clock, Calendar, MapPin, ScanLine,
  TrendingUp, ArrowLeft, CheckCircle2, XCircle, Plus, Search,
  ClipboardCheck, ShieldCheck, BarChart3, Boxes
} from 'lucide-react'
import {
  getLoanStatusLabel, getPurposeLabel, formatThaiDate, formatThaiDateTime,
  daysUntil, ASSET_STATUS_LABELS, CATEGORY_LABELS,
} from '@/lib/activeasset-constants'

interface DashboardData {
  summary: {
    totalAssets: number
    available: number
    onLoan: number
    inRepair: number
    inInspection: number
    lost: number
    disposed: number
    activeLoans: number
    overdueLoans: number
    partialLoans: number
    openTickets: number
    deadStockCount: number
  }
  overdueLoans: Array<{
    docNo: string
    customerName: string
    customerCompany: string | null
    salesRepName: string
    purpose: string
    checkoutDate: string
    expectedReturnDate: string
    status: string
    items: Array<{ tagId: string; serialNo: string; model: string; brand: string }>
  }>
  standbyLoans: Array<{
    docNo: string
    customerName: string
    customerCompany: string | null
    checkoutDate: string
    expectedReturnDate: string
    items: Array<{ tagId: string; serialNo: string; model: string; brand: string }>
  }>
  brandDistribution: Array<{ brand: string; count: number }>
  deadStockAssets: Array<{
    tagId: string
    serialNo: string
    purchaseDate: string | null
    model: string
    brand: string
  }>
}

interface AuditSessionListItem {
  id: string
  sessionNo: string
  location: { name: string; zone: string | null }
  auditorName: string
  startedAt: string
  closedAt: string | null
  status: string
  expectedCount: number
  scannedCount: number
  unexpectedCount: number
  notes: string | null
  itemCount: number
}

interface Location {
  id: string
  name: string
  zone: string | null
  assetCount: number
}

type ManagerTab = 'dashboard' | 'audit' | 'audit-detail'

export function ManagerView() {
  const [tab, setTab] = useState<ManagerTab>('dashboard')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)

  const [auditSessions, setAuditSessions] = useState<AuditSessionListItem[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [activeAuditId, setActiveAuditId] = useState<string | null>(null)

  // New audit form
  const [newAuditLocation, setNewAuditLocation] = useState('')
  const [newAuditAuditor, setNewAuditAuditor] = useState('ผจก. คลัง (Manager)')
  const [newAuditNotes, setNewAuditNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setData(d)
    setLoading(false)
  }, [])

  const loadAuditSessions = useCallback(async () => {
    const res = await fetch('/api/audit')
    const d = await res.json()
    setAuditSessions(d.sessions || [])
  }, [])

  const loadLocations = useCallback(async () => {
    const res = await fetch('/api/locations')
    const d = await res.json()
    setLocations(d.locations || [])
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])
  useEffect(() => {
    if (tab === 'audit') {
      loadAuditSessions()
      loadLocations()
    }
  }, [tab, loadAuditSessions, loadLocations])

  const createAudit = async () => {
    if (!newAuditLocation) {
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: newAuditLocation,
          auditorName: newAuditAuditor,
          notes: newAuditNotes,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'สร้างไม่สำเร็จ')
      await loadAuditSessions()
      setNewAuditLocation('')
      setNewAuditNotes('')
      // open the new session
      setActiveAuditId(d.session.id)
      setTab('audit-detail')
    } catch (e: unknown) {
      // handled by parent toast
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  if (tab === 'audit-detail' && activeAuditId) {
    return <AuditDetailPanel sessionId={activeAuditId} onBack={() => { setTab('audit'); setActiveAuditId(null) }} />
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        <Button variant={tab === 'dashboard' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('dashboard')}>
          <BarChart3 className="h-4 w-4 mr-2" /> ภาพรวม
        </Button>
        <Button variant={tab === 'audit' ? 'default' : 'ghost'} size="sm" onClick={() => setTab('audit')}>
          <ClipboardCheck className="h-4 w-4 mr-2" /> ตรวจนับทรัพย์สิน
        </Button>
      </div>

      {tab === 'dashboard' && data && <DashboardPanel data={data} loading={loading} />}
      {tab === 'audit' && (
        <AuditPanel
          sessions={auditSessions}
          locations={locations}
          newAuditLocation={newAuditLocation}
          setNewAuditLocation={setNewAuditLocation}
          newAuditAuditor={newAuditAuditor}
          setNewAuditAuditor={setNewAuditAuditor}
          newAuditNotes={newAuditNotes}
          setNewAuditNotes={setNewAuditNotes}
          creating={creating}
          onCreate={createAudit}
          onOpen={(id) => { setActiveAuditId(id); setTab('audit-detail') }}
          onReload={loadAuditSessions}
        />
      )}
    </div>
  )
}

function DashboardPanel({ data, loading }: { data: DashboardData; loading: boolean }) {
  const s = data.summary
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="ทรัพย์สินทั้งหมด" value={s.totalAssets} icon={<Package className="h-4 w-4" />} tone="slate" />
        <StatCard label="พร้อมใช้" value={s.available} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="กำลังยืม" value={s.onLoan} icon={<Boxes className="h-4 w-4" />} tone="amber" />
        <StatCard label="ส่งซ่อม" value={s.inRepair} icon={<Wrench className="h-4 w-4" />} tone="purple" />
        <StatCard label="เปิดใบยืม" value={s.activeLoans} icon={<ClipboardCheck className="h-4 w-4" />} tone="blue" />
        <StatCard label="เกินกำหนด" value={s.overdueLoans} icon={<AlertTriangle className="h-4 w-4" />} tone="rose" />
        <StatCard label="Dead Stock" value={s.deadStockCount} icon={<Clock className="h-4 w-4" />} tone="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue loans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> ใบยืมเกินกำหนด ({data.overdueLoans.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {data.overdueLoans.length === 0 && (
                  <p className="p-6 text-center text-slate-500 text-sm">ไม่มีใบยืมเกินกำหนด</p>
                )}
                {data.overdueLoans.map((l) => {
                  const days = daysUntil(l.expectedReturnDate)
                  return (
                    <div key={l.docNo} className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{l.docNo}</span>
                        <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50">เกิน {Math.abs(days)} วัน</Badge>
                      </div>
                      <div className="text-sm mt-1">{l.customerName} {l.customerCompany ? `— ${l.customerCompany}` : ''}</div>
                      <div className="text-xs text-slate-500">พนักงาน: {l.salesRepName} • ครบกำหนด: {formatThaiDate(l.expectedReturnDate)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        เครื่อง: {l.items.map((i) => i.tagId).join(', ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Standby loans */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <Wrench className="h-4 w-4" /> เครื่องสำรองระหว่างซ่อม ({data.standbyLoans.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {data.standbyLoans.length === 0 && (
                  <p className="p-6 text-center text-slate-500 text-sm">ไม่มีเครื่องสำรองที่ค้างอยู่</p>
                )}
                {data.standbyLoans.map((l) => {
                  const days = daysUntil(l.expectedReturnDate)
                  return (
                    <div key={l.docNo} className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{l.docNo}</span>
                        <Badge variant="outline" className="text-xs">{getPurposeLabel('Standby_Repair')}</Badge>
                        {days < 0 && <Badge variant="outline" className="text-xs text-rose-700 bg-rose-50">เกิน {Math.abs(days)} วัน</Badge>}
                      </div>
                      <div className="text-sm mt-1">{l.customerName} {l.customerCompany ? `— ${l.customerCompany}` : ''}</div>
                      <div className="text-xs text-slate-500">ยืม: {formatThaiDate(l.checkoutDate)} • กำหนดคืน: {formatThaiDate(l.expectedReturnDate)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        เครื่องที่ยืม: {l.items.map((i) => `${i.tagId} (${i.model})`).join(', ')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Brand distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> สัดส่วนแบรนด์
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.brandDistribution.map((b) => {
                const pct = (b.count / s.totalAssets) * 100
                return (
                  <div key={b.brand}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{b.brand}</span>
                      <span className="text-slate-500">{b.count} เครื่อง ({pct.toFixed(0)}%)</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dead stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-slate-700">
              <Clock className="h-4 w-4" /> Dead Stock — ไม่เคยถูกยืม ({data.deadStockAssets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {data.deadStockAssets.length === 0 && (
                  <p className="p-6 text-center text-slate-500 text-sm">ไม่มี dead stock</p>
                )}
                {data.deadStockAssets.map((a) => {
                  const age = a.purchaseDate ? daysUntil(a.purchaseDate) : null
                  return (
                    <div key={a.tagId} className="p-3 flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs">{a.tagId}</span>
                      <div className="flex-1">
                        <div>{a.brand} {a.model}</div>
                        <div className="text-xs text-slate-500">S/N: {a.serialNo}</div>
                      </div>
                      {age !== null && (
                        <Badge variant="outline" className="text-xs text-slate-500">เข้าคลัง {Math.abs(age)} วัน</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: 'slate' | 'emerald' | 'amber' | 'purple' | 'blue' | 'rose' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return (
    <Card className={`${tones[tone]}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs opacity-80">
          {icon}
          <span>{label}</span>
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  )
}

// ===== Audit Panel =====
function AuditPanel({
  sessions, locations, newAuditLocation, setNewAuditLocation,
  newAuditAuditor, setNewAuditAuditor, newAuditNotes, setNewAuditNotes,
  creating, onCreate, onOpen, onReload,
}: {
  sessions: AuditSessionListItem[]
  locations: Location[]
  newAuditLocation: string
  setNewAuditLocation: (v: string) => void
  newAuditAuditor: string
  setNewAuditAuditor: (v: string) => void
  newAuditNotes: string
  setNewAuditNotes: (v: string) => void
  creating: boolean
  onCreate: () => void
  onOpen: (id: string) => void
  onReload: () => void
}) {
  const { toast } = useToast()
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> เริ่มตรวจนับใหม่</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">จุดจัดเก็บที่จะตรวจนับ</label>
            <Select value={newAuditLocation} onValueChange={setNewAuditLocation}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกจุดจัดเก็บ..." /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id} disabled={l.assetCount === 0}>
                    {l.name} {l.zone ? `(${l.zone})` : ''} — {l.assetCount} เครื่อง
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">ชื่อผู้ตรวจนับ</label>
            <Input value={newAuditAuditor} onChange={(e) => setNewAuditAuditor(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">หมายเหตุ</label>
            <Input value={newAuditNotes} onChange={(e) => setNewAuditNotes(e.target.value)} placeholder="เช่น ตรวจนับกลางเดือน" className="mt-1" />
          </div>
          <Button
            className="w-full"
            disabled={creating || !newAuditLocation || !newAuditAuditor}
            onClick={async () => {
              try {
                await onCreate()
                toast({ title: 'เริ่ม audit session แล้ว', description: 'ระบบ freeze รายการ expected items จากสถานะปัจจุบัน' })
              } catch (e: unknown) {
                toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
              }
            }}
          >
            <ClipboardCheck className="h-4 w-4 mr-2" /> {creating ? 'กำลังสร้าง...' : 'เริ่มตรวจนับ'}
          </Button>
          <p className="text-xs text-slate-500">
            ระบบจะ freeze รายการเครื่องที่ควรอยู่ในจุดนี้เป็น Expected Items ทันที
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Audit Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[560px]">
            <div className="divide-y">
              {sessions.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มี audit session</p>
                </div>
              )}
              {sessions.map((s) => {
                const pct = s.expectedCount > 0 ? (s.scannedCount / s.expectedCount) * 100 : 0
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm">{s.sessionNo}</span>
                          <Badge variant="outline" className={`text-xs ${s.status === 'Closed' ? 'bg-slate-100' : 'bg-emerald-50 text-emerald-700'}`}>
                            {s.status === 'Closed' ? 'ปิดแล้ว' : 'กำลังตรวจ'}
                          </Badge>
                          {s.unexpectedCount > 0 && <Badge variant="outline" className="text-xs text-amber-700 bg-amber-50">พบแปลก {s.unexpectedCount}</Badge>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.location.name} {s.location.zone ? `• ${s.location.zone}` : ''}
                        </div>
                        <div className="text-xs text-slate-500">ผู้ตรวจ: {s.auditorName} • เริ่ม: {formatThaiDateTime(s.startedAt)}</div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-600">ความคืบหน้า: {s.scannedCount} / {s.expectedCount}</span>
                            <span className="font-medium">{pct.toFixed(0)}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onOpen(s.id)}>
                        <Search className="h-4 w-4 mr-1" /> เปิด
                      </Button>
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

// ===== Audit Detail Panel =====
function AuditDetailPanel({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { toast } = useToast()
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'warning' | 'info' | 'error'; message: string } | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/audit/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSession(d.session)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [sessionId])

  // Reload trigger counter (incremented after each scan/close)
  const [reloadTick, setReloadTick] = useState(0)
  useEffect(() => {
    if (reloadTick === 0) return
    let cancelled = false
    fetch(`/api/audit/${sessionId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSession(d.session)
      })
    return () => { cancelled = true }
  }, [sessionId, reloadTick])

  const reload = () => setReloadTick((t) => t + 1)

  const doScan = async () => {
    if (!scanInput.trim()) return
    setScanResult(null)
    const res = await fetch(`/api/audit/${sessionId}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanInput: scanInput.trim() }),
    })
    const d = await res.json()
    if (d.ok) {
      if (d.result === 'scanned') {
        setScanResult({ type: 'success', message: d.message })
        toast({ title: '✓ สแกนสำเร็จ', description: d.message })
      } else if (d.result === 'already_scanned') {
        setScanResult({ type: 'info', message: d.message })
        toast({ title: 'สแกนซ้ำ', description: d.message })
      } else if (d.result === 'unexpected') {
        setScanResult({ type: 'warning', message: d.message })
        toast({ title: '⚠️ พบเครื่องไม่คาดฝัน', description: d.message, variant: 'destructive' })
      }
      reload()
    } else {
      setScanResult({ type: 'error', message: d.error || 'สแกนไม่สำเร็จ' })
      toast({ title: 'สแกนไม่สำเร็จ', description: d.error, variant: 'destructive' })
    }
    setScanInput('')
  }

  const closeSession = async () => {
    setClosing(true)
    const res = await fetch(`/api/audit/${sessionId}/close`, { method: 'POST' })
    const d = await res.json()
    if (res.ok) {
      toast({ title: 'ปิด session แล้ว' })
      reload()
    } else {
      toast({ title: 'ปิดไม่สำเร็จ', description: d.error, variant: 'destructive' })
    }
    setClosing(false)
  }

  if (loading) return <p className="text-center text-slate-500 py-8">กำลังโหลด...</p>
  if (!session) return <p className="text-center text-slate-500 py-8">ไม่พบ session</p>

  const items = (session.items as Array<Record<string, unknown>>) || []
  const asset = (it: Record<string, unknown>) => it.asset as Record<string, unknown>
  const catalog = (it: Record<string, unknown>) => asset(it)?.catalog as Record<string, unknown>
  const scannedItems = items.filter((i) => i.scanned)
  const pendingItems = items.filter((i) => !i.scanned && i.expected)
  const unexpectedItems = items.filter((i) => !i.expected)

  const expectedCount = session.expectedCount as number
  const scannedCount = session.scannedCount as number
  const pct = expectedCount > 0 ? (scannedCount / expectedCount) * 100 : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> กลับ</Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold">{String(session.sessionNo ?? '')}</span>
            <Badge variant="outline" className={`text-xs ${session.status === 'Closed' ? 'bg-slate-100' : 'bg-emerald-50 text-emerald-700'}`}>
              {session.status === 'Closed' ? 'ปิดแล้ว' : 'กำลังตรวจ'}
            </Badge>
          </div>
          <div className="text-xs text-slate-500">
            {(session.location as Record<string, unknown>)?.name as string} • ผู้ตรวจ: {String(session.auditorName ?? '')} • เริ่ม: {formatThaiDateTime(session.startedAt as string)}
          </div>
        </div>
        {session.status !== 'Closed' && (
          <Button variant="outline" size="sm" onClick={closeSession} disabled={closing}>
            <ShieldCheck className="h-4 w-4 mr-1" /> {closing ? 'กำลังปิด...' : 'ปิด Session'}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">ความคืบหน้าการตรวจนับ</span>
            <span className="text-sm text-slate-600">{scannedCount} / {expectedCount} ({pct.toFixed(0)}%)</span>
          </div>
          <Progress value={pct} className="h-3" />
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="text-center bg-emerald-50 border border-emerald-200 rounded p-2">
              <div className="font-bold text-emerald-700 text-lg">{scannedItems.length}</div>
              <div className="text-emerald-600">สแกนแล้ว</div>
            </div>
            <div className="text-center bg-amber-50 border border-amber-200 rounded p-2">
              <div className="font-bold text-amber-700 text-lg">{pendingItems.length}</div>
              <div className="text-amber-600">รอยิงสแกน</div>
            </div>
            <div className="text-center bg-rose-50 border border-rose-200 rounded p-2">
              <div className="font-bold text-rose-700 text-lg">{unexpectedItems.length}</div>
              <div className="text-rose-600">แปลกปลอม</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {session.status !== 'Closed' && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ScanLine className="h-5 w-5 text-blue-700" />
              <label className="text-sm font-medium text-blue-900">สแกน Tag ID หรือ S/N เครื่องที่ตรวจพบ</label>
            </div>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doScan() }}
                placeholder="สแกนหรือพิมพ์ Tag ID / S/N แล้วกด Enter..."
                className="bg-white"
              />
              <Button onClick={doScan} disabled={!scanInput.trim()}>ยืนยัน</Button>
            </div>
            {scanResult && (
              <div className={`mt-2 p-2 rounded text-sm ${
                scanResult.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
                scanResult.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                scanResult.type === 'error' ? 'bg-rose-100 text-rose-800' :
                'bg-slate-100 text-slate-700'
              }`}>
                {scanResult.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" /> รอยิงสแกน ({pendingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {pendingItems.length === 0 && <p className="p-6 text-center text-slate-500 text-sm">สแกนครบแล้ว</p>}
                {pendingItems.map((it) => (
                  <div key={String(it.id)} className="p-3 flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-amber-500" />
                    <div className="flex-1">
                      <span className="font-mono text-sm">{String(asset(it)?.tagId ?? '')}</span>
                      <span className="text-xs text-slate-500 ml-2">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> สแกนแล้ว ({scannedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {scannedItems.length === 0 && <p className="p-6 text-center text-slate-500 text-sm">ยังไม่ได้สแกน</p>}
                {scannedItems.map((it) => (
                  <div key={String(it.id)} className="p-3 flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <div className="flex-1">
                      <span className="font-mono text-sm">{String(asset(it)?.tagId ?? '')}</span>
                      <span className="text-xs text-slate-500 ml-2">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
                    </div>
                    <span className="text-xs text-slate-400">{it.scannedAt ? formatThaiDateTime(it.scannedAt as string) : ''}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {unexpectedItems.length > 0 && (
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> เครื่องแปลกปลอม ({unexpectedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {unexpectedItems.map((it) => (
                <div key={String(it.id)} className="p-3 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <div className="flex-1">
                    <span className="font-mono text-sm">{String(asset(it)?.tagId ?? '')}</span>
                    <span className="text-xs text-slate-500 ml-2">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
                  </div>
                  <Badge variant="outline" className="text-xs text-rose-700 bg-rose-100">ไม่ได้อยู่ในทะเบียนจุดนี้</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
