'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { EmptyState, LoadingState } from './shared'
import { useToast } from '@/hooks/use-toast'
import {
  Plus, ArrowLeft, ClipboardCheck, MapPin, ScanLine, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck, Clock,
} from 'lucide-react'
import {
  formatThaiDateTime,
} from '@/lib/activeasset-constants'

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

interface AuditTabProps {
  startNewTrigger?: number
}

export function AuditTab({ startNewTrigger }: AuditTabProps) {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<AuditSessionListItem[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  // New session form
  const [newLocation, setNewLocation] = useState('')
  const [newAuditor, setNewAuditor] = useState('ผจก. คลัง (Manager)')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const loadSessions = async () => {
    setLoading(true)
    const res = await fetch('/api/audit')
    const d = await res.json()
    setSessions(d.sessions || [])
    setLoading(false)
  }
  const loadLocations = async () => {
    const res = await fetch('/api/locations')
    const d = await res.json()
    setLocations(d.locations || [])
  }

  useEffect(() => { loadSessions(); loadLocations() }, [])
  useEffect(() => {
    if (startNewTrigger) setShowNewForm(true)
  }, [startNewTrigger])

  const createSession = async () => {
    if (!newLocation) {
      toast({ title: 'เลือกจุดจัดเก็บ', variant: 'destructive' })
      return
    }
    if (!newAuditor.trim()) {
      toast({ title: 'ระบุชื่อผู้ตรวจนับ', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: newLocation, auditorName: newAuditor, notes: newNotes }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast({ title: '✓ เริ่ม audit แล้ว', description: 'ระบบ freeze expected items จากสถานะปัจจุบัน' })
      setShowNewForm(false)
      setNewLocation('')
      setNewNotes('')
      await loadSessions()
      setActiveSessionId(d.session.id)
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  // Render scan panel if active
  if (activeSessionId) {
    return <AuditScanPanel sessionId={activeSessionId} onBack={async () => { setActiveSessionId(null); await loadSessions() }} />
  }

  // Render new form if active
  if (showNewForm) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
          </Button>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" /> เริ่มตรวจนับใหม่
          </h2>
        </div>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">จุดจัดเก็บที่จะตรวจนับ</label>
              <Select value={newLocation} onValueChange={setNewLocation}>
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
              <label className="text-sm font-medium text-slate-700">ชื่อผู้ตรวจนับ</label>
              <Input value={newAuditor} onChange={(e) => setNewAuditor(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">หมายเหตุ</label>
              <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="เช่น ตรวจนับกลางเดือน" className="mt-1" />
            </div>
            <Button className="w-full" disabled={creating || !newLocation || !newAuditor} onClick={createSession}>
              <ClipboardCheck className="h-4 w-4 mr-2" /> {creating ? 'กำลังสร้าง...' : 'เริ่มตรวจนับ'}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              ระบบจะ freeze รายการเครื่องที่ควรอยู่ในจุดนี้เป็น Expected Items ทันที
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Default: list of sessions
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" /> ตรวจนับทรัพย์สิน
        </h2>
        <Button onClick={() => setShowNewForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> เริ่มตรวจนับใหม่
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[640px]">
            <div className="divide-y">
              {loading && <LoadingState />}
              {!loading && sessions.length === 0 && (
                <EmptyState icon={<ClipboardCheck className="h-12 w-12" />} message="ยังไม่มี audit session" />
              )}
              {sessions.map((s) => {
                const pct = s.expectedCount > 0 ? (s.scannedCount / s.expectedCount) * 100 : 0
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className="w-full text-left p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
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
                            <span className="text-slate-600">{s.scannedCount} / {s.expectedCount}</span>
                            <span className="font-medium">{pct.toFixed(0)}%</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

// ===== Audit Scan Panel =====
function AuditScanPanel({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const { toast } = useToast()
  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'warning' | 'info' | 'error'; message: string } | null>(null)
  const [closing, setClosing] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/audit/${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setSession(d.session); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId, reloadTick])

  useEffect(() => {
    if (reloadTick === 0) return
    let cancelled = false
    fetch(`/api/audit/${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSession(d.session) })
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

  if (loading) return <LoadingState />
  if (!session) return <EmptyState message="ไม่พบ session" />

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
    <div className="space-y-3">
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
            <span className="text-sm font-medium">ความคืบหน้า</span>
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
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <ScanLine className="h-4 w-4 text-blue-700" />
              <label className="text-sm font-medium text-blue-900">สแกน Tag ID หรือ S/N</label>
            </div>
            <div className="flex gap-2">
              <Input
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') doScan() }}
                placeholder="สแกนหรือพิมพ์แล้วกด Enter..."
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <Clock className="h-4 w-4" /> รอยิงสแกน ({pendingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {pendingItems.length === 0 && <EmptyState message="สแกนครบแล้ว" />}
                {pendingItems.map((it) => (
                  <div key={String(it.id)} className="p-2 flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-amber-500" />
                    <span className="font-mono">{String(asset(it)?.tagId ?? '')}</span>
                    <span className="text-xs text-slate-500">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> สแกนแล้ว ({scannedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="divide-y">
                {scannedItems.length === 0 && <EmptyState message="ยังไม่ได้สแกน" />}
                {scannedItems.map((it) => (
                  <div key={String(it.id)} className="p-2 flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-mono">{String(asset(it)?.tagId ?? '')}</span>
                    <span className="text-xs text-slate-500">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
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
            <CardTitle className="text-sm flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> เครื่องแปลกปลอม ({unexpectedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {unexpectedItems.map((it) => (
                <div key={String(it.id)} className="p-2 flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <span className="font-mono">{String(asset(it)?.tagId ?? '')}</span>
                  <span className="text-xs text-slate-500">{String(catalog(it)?.brand ?? '')} {String(catalog(it)?.model ?? '')}</span>
                  <Badge variant="outline" className="text-xs text-rose-700 bg-rose-100 ml-auto">ไม่ได้อยู่ในทะเบียน</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
