'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { EmptyState, LoadingState } from './shared'
import {
  Search, Plus, X, ChevronDown, Users as UsersIcon, Mail, Shield,
  CheckCircle2, Clock, FileText, Trash2, Grid3x3, List as ListIcon, MoreVertical,
  Calendar, MapPin, ArrowLeft, Edit, Activity, Star,
} from 'lucide-react'
import {
  formatThaiDate, formatThaiDateTime,
} from '@/lib/activeasset-constants'

// Velzon color tokens
const VZ = { primary: '#405189', teal: '#0ab39c', amber: '#f7b84b', rose: '#f06548', purple: '#a071f0', slate: '#74788d' }
const VZ_SOFT: Record<string, string> = {
  primary: 'rgba(64,81,137,0.10)', teal: 'rgba(10,179,156,0.10)',
  amber: 'rgba(247,184,75,0.12)', rose: 'rgba(240,101,72,0.10)',
  purple: 'rgba(160,113,240,0.10)', slate: 'rgba(116,120,141,0.12)',
}

// Role labels + Velzon-style gradient cover colors
const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  sales: 'พนักงานขาย',
  store: 'เจ้าหน้าที่คลัง',
  manager: 'ผู้จัดการ',
}

const ROLE_COLORS: Record<string, { fg: string; bg: string; cover: string }> = {
  admin:   { fg: VZ.rose,   bg: VZ_SOFT.rose,   cover: `linear-gradient(135deg, ${VZ.rose}, ${VZ.primary})` },
  sales:   { fg: VZ.amber,  bg: VZ_SOFT.amber,  cover: `linear-gradient(135deg, ${VZ.amber}, ${VZ.teal})` },
  store:   { fg: VZ.teal,   bg: VZ_SOFT.teal,   cover: `linear-gradient(135deg, ${VZ.teal}, ${VZ.primary})` },
  manager: { fg: VZ.purple, bg: VZ_SOFT.purple, cover: `linear-gradient(135deg, ${VZ.purple}, ${VZ.primary})` },
}

interface TeamUser {
  id: string
  email: string
  name: string
  role: string
  tenantId: string | null
  activeTenantId: string | null
  createdAt: string
  updatedAt: string
  stats: {
    activities: number
    notifications: number
    loans: number
  }
}

export function TeamTab() {
  const { toast } = useToast()
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' })
  const [submitting, setSubmitting] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users || [])
      } else {
        toast({ title: 'โหลดข้อมูลไม่ได้', description: data.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'โหลดข้อมูลไม่ได้', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: 'กรอกข้อมูลให้ครบ: ชื่อ, email, password', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `✓ เพิ่มสมาชิก: ${form.name} (${ROLE_LABELS[form.role]})` })
      setForm({ name: '', email: '', password: '', role: 'sales' })
      setShowForm(false)
      load()
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`ลบสมาชิก "${name}" ใช่ไหม?`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      toast({ title: `ลบ ${name} แล้ว` })
      load()
    } else {
      toast({ title: 'ลบไม่สำเร็จ', description: data.error, variant: 'destructive' })
    }
  }

  const changeRole = async (id: string, role: string, name: string) => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: `เปลี่ยน role ของ ${name} เป็น ${ROLE_LABELS[role]}` })
      load()
    } else {
      toast({ title: 'เปลี่ยน role ไม่สำเร็จ', description: data.error, variant: 'destructive' })
    }
  }

  // Filter by search term (name OR email OR role label)
  const filtered = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (ROLE_LABELS[u.role] || '').toLowerCase().includes(q)
    )
  })

  // === If a user is selected → show profile view ===
  if (selectedUserId) {
    const selectedUser = users.find((u) => u.id === selectedUserId)
    if (!selectedUser) {
      setSelectedUserId(null)
      return null
    }
    return (
      <UserProfileView
        user={selectedUser}
        onBack={() => setSelectedUserId(null)}
        onUserUpdated={() => load()}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* ===== Velzon page-title-box ===== */}
      <div className="vz-card p-4 flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            ทีมงาน
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">จัดการสมาชิกในระบบ + สิทธิ์การเข้าถึง</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Pages</span>
          <span className="text-muted-foreground/60">›</span>
          <span className="text-primary font-medium">Team</span>
        </div>
      </div>

      {/* ===== Velzon filter card (search + view toggle + Add Members) ===== */}
      <div className="vz-card">
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือตำแหน่ง..."
                className="pl-9"
              />
            </div>
            {/* View toggle buttons (Velzon list-grid-nav pattern) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`vz-icon-soft h-9 w-9 border rounded ${view === 'grid' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/30'}`}
                onClick={() => setView('grid')}
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`vz-icon-soft h-9 w-9 border rounded ${view === 'list' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/30'}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
            {/* Add Members button — btn-success */}
            <Button
              size="sm"
              className="text-xs"
              style={{ backgroundColor: VZ.teal, color: 'white' }}
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> เพิ่มสมาชิก
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Inline Add Member form (Velzon modal-style) ===== */}
      {showForm && (
        <div className="vz-card">
          <div className="px-4 py-3 vz-divider flex items-center justify-between">
            <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
              เพิ่มสมาชิกใหม่
            </h5>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">ชื่อ <span className="text-rose-500">*</span></label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="สมชาย ใจดี" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email <span className="text-rose-500">*</span></label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@activeasset.local" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">รหัสผ่าน <span className="text-rose-500">*</span></label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role</label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="px-4 pb-4 flex justify-end gap-2">
            <Button variant="soft" size="sm" className="text-xs" onClick={() => setShowForm(false)}>
              ยกเลิก
            </Button>
            <Button size="sm" className="text-xs" style={{ backgroundColor: VZ.teal, color: 'white' }} onClick={create} disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'เพิ่มสมาชิก'}
            </Button>
          </div>
        </div>
      )}

      {/* ===== Loading ===== */}
      {loading && <LoadingState />}

      {/* ===== Empty state — Velzon noresult pattern ===== */}
      {!loading && filtered.length === 0 && (
        <div className="vz-card p-8 text-center">
          <UsersIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <h5 className="text-sm font-semibold text-foreground mb-1">
            {search ? 'ไม่พบผลลัพธ์' : 'ยังไม่มีสมาชิก'}
          </h5>
          <p className="text-xs text-muted-foreground mb-0">
            {search ? 'ลองค้นหาด้วยคำอื่น' : 'คลิก "เพิ่มสมาชิก" เพื่อเพิ่มรายการใหม่'}
          </p>
        </div>
      )}

      {/* ===== Team members grid (Velzon grid-view-filter pattern) ===== */}
      {!loading && filtered.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u) => {
            const roleCfg = ROLE_COLORS[u.role] || ROLE_COLORS.sales
            const initials = u.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase()
            return (
              <div key={u.id} className="vz-card overflow-hidden hover-lift transition-smooth">
                {/* Team cover — Velzon team-cover gradient pattern */}
                <div className="h-20 relative" style={{ background: roleCfg.cover }}>
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }} />
                  {/* Favorite star (top-left) */}
                  <button
                    className="absolute top-2 left-2 h-7 w-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-smooth"
                    title="ทำเครื่องหมาย"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </button>
                  {/* More dropdown (top-right) */}
                  <div className="absolute top-2 right-2 group">
                    <button
                      className="h-7 w-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-smooth"
                      title="เพิ่มเติม"
                      onClick={() => remove(u.id, u.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* Card body */}
                <div className="p-4 -mt-10 text-center relative">
                  {/* Avatar-lg overlapping cover (Velzon team-profile-img pattern) */}
                  <div
                    className="vz-avatar h-20 w-20 mx-auto border-4 border-card text-base"
                    style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}
                  >
                    {initials}
                  </div>
                  {/* Member name */}
                  <h5 className="text-sm font-semibold text-foreground mt-2 mb-0.5" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                    {u.name}
                  </h5>
                  {/* Designation (role) */}
                  <p className="text-xs text-muted-foreground mb-3">{ROLE_LABELS[u.role] || u.role}</p>
                  {/* Email */}
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground mb-3">
                    <Mail className="h-3 w-3" /> <span className="truncate">{u.email}</span>
                  </div>
                  {/* 2 stats with border-end-dashed (Velzon pattern) */}
                  <div className="grid grid-cols-3 text-center border-t border-dashed border-border pt-3 mt-2">
                    <div className="border-r border-dashed border-border">
                      <h5 className="text-base font-bold tabular-nums text-foreground mb-0">{u.stats.loans}</h5>
                      <p className="text-[10px] text-muted-foreground mb-0">ใบยืม</p>
                    </div>
                    <div className="border-r border-dashed border-border">
                      <h5 className="text-base font-bold tabular-nums mb-0" style={{ color: VZ.teal }}>{u.stats.activities}</h5>
                      <p className="text-[10px] text-muted-foreground mb-0">กิจกรรม</p>
                    </div>
                    <div>
                      <h5 className="text-base font-bold tabular-nums mb-0" style={{ color: VZ.amber }}>{u.stats.notifications}</h5>
                      <p className="text-[10px] text-muted-foreground mb-0">แจ้งเตือน</p>
                    </div>
                  </div>
                  {/* Role selector (Velzon View Profile pattern, adapted) */}
                  <div className="mt-3">
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v, u.name)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* View Profile button — Velzon btn-light w-100 pattern */}
                  <button
                    className="w-full mt-2 px-3 py-1.5 text-xs font-medium bg-muted/30 hover:bg-muted text-foreground border border-border rounded transition-smooth flex items-center justify-center gap-1"
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    <UsersIcon className="h-3 w-3" /> ดูโปรไฟล์
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===== Team members list (Velzon list-view-filter pattern) ===== */}
      {!loading && filtered.length > 0 && view === 'list' && (
        <div className="vz-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="vz-crm-table">
              <thead>
                <tr>
                  <th>สมาชิก</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th className="text-right">ใบยืม</th>
                  <th className="text-right">กิจกรรม</th>
                  <th className="text-right">แจ้งเตือน</th>
                  <th>ลบ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const roleCfg = ROLE_COLORS[u.role] || ROLE_COLORS.sales
                  const initials = u.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase()
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div
                            className="vz-avatar h-8 w-8 text-[10px] flex-shrink-0"
                            style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}
                          >
                            {initials}
                          </div>
                          <span className="text-foreground font-medium truncate">{u.name}</span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{u.email}</td>
                      <td>
                        <span
                          className="vz-pill"
                          style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="text-right tabular-nums font-medium text-foreground">{u.stats.loans}</td>
                      <td className="text-right tabular-nums" style={{ color: VZ.teal }}>{u.stats.activities}</td>
                      <td className="text-right tabular-nums" style={{ color: VZ.amber }}>{u.stats.notifications}</td>
                      <td>
                        <button
                          className="vz-icon-soft h-7 w-7 hover:bg-rose-500/10 border border-border rounded"
                          onClick={() => remove(u.id, u.name)}
                          title="ลบ"
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: VZ.rose }} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Summary ===== */}
      {!loading && filtered.length > 0 && (
        <div className="vz-card p-3 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Showing 1 to <span className="font-medium text-foreground">{filtered.length}</span> of <span className="font-medium text-foreground">{users.length}</span> สมาชิก
          </div>
          <div className="flex items-center gap-2">
            {Object.entries(ROLE_LABELS).map(([role, label]) => {
              const count = users.filter((u) => u.role === role).length
              if (count === 0) return null
              const cfg = ROLE_COLORS[role]
              return (
                <span key={role} className="vz-pill" style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
                  {label}: {count}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== UserProfileView — Velzon pages-profile pattern =====
function UserProfileView({
  user, onBack, onUserUpdated,
}: {
  user: TeamUser
  onBack: () => void
  onUserUpdated: () => void
}) {
  const { toast } = useToast()
  const [activities, setActivities] = useState<Array<{ id: string; action: string; description: string; targetType: string; createdAt: string }>>([])
  const [loans, setLoans] = useState<Array<{ docNo: string; customerName: string; customerCompany: string | null; status: string; expectedReturnDate: string; requestedAt: string }>>([])
  const [loadingData, setLoadingData] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: user.name, role: user.role })

  const roleCfg = ROLE_COLORS[user.role] || ROLE_COLORS.sales
  const initials = user.name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase()

  useEffect(() => {
    Promise.all([
      fetch('/api/activities?limit=200').then(r => r.json()),
      fetch('/api/loans').then(r => r.json()),
    ]).then(([actData, loanData]) => {
      // Filter activities by this user
      setActivities((actData.activities || []).filter((a: { userId: string }) => a.userId === user.id).slice(0, 20))
      // Filter loans where salesRepName matches user.name
      setLoans((loanData.loans || []).filter((l: { salesRepName: string }) => l.salesRepName === user.name).slice(0, 10))
      setLoadingData(false)
    })
  }, [user.id])

  const saveEdit = async () => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (res.ok) {
      toast({ title: `✓ อัปเดต ${editForm.name} เรียบร้อย` })
      setEditMode(false)
      onUserUpdated()
    } else {
      toast({ title: 'อัปเดตไม่สำเร็จ', description: data.error, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* ===== Velzon profile-foreground — full-width gradient cover ===== */}
      <div className="vz-card overflow-hidden">
        {/* Cover gradient */}
        <div className="h-32 relative" style={{ background: roleCfg.cover }}>
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          {/* Back button */}
          <button
            className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-white bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-smooth"
            onClick={onBack}
          >
            <ArrowLeft className="h-3 w-3" /> กลับ
          </button>
          {/* Edit Profile button — Velzon btn-success pattern */}
          <button
            className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-white shadow-sm"
            style={{ backgroundColor: VZ.teal }}
            onClick={() => { setEditMode(!editMode); setEditForm({ name: user.name, role: user.role }) }}
          >
            <Edit className="h-3 w-3" /> {editMode ? 'ยกเลิก' : 'แก้ไขโปรไฟล์'}
          </button>
        </div>
        {/* Profile wrapper — overlapping avatar + name + stats */}
        <div className="px-4 pb-4 -mt-12 relative">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Avatar-lg overlapping cover */}
            <div
              className="vz-avatar h-24 w-24 border-4 border-card text-2xl flex-shrink-0"
              style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}
            >
              {initials}
            </div>
            {/* Name + designation */}
            <div className="flex-1 min-w-0 pb-2">
              <h3 className="text-lg font-bold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                {user.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-1">{ROLE_LABELS[user.role] || user.role}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> เข้าร่วม {formatThaiDate(user.createdAt)}</span>
              </div>
            </div>
            {/* 3 stats — Velzon profile-wrapper stats pattern */}
            <div className="flex items-center gap-4 pb-2">
              <div className="text-center">
                <h4 className="text-lg font-bold tabular-nums text-foreground mb-0">{user.stats.loans}</h4>
                <p className="text-[10px] text-muted-foreground mb-0">ใบยืม</p>
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold tabular-nums mb-0" style={{ color: VZ.teal }}>{user.stats.activities}</h4>
                <p className="text-[10px] text-muted-foreground mb-0">กิจกรรม</p>
              </div>
              <div className="text-center">
                <h4 className="text-lg font-bold tabular-nums mb-0" style={{ color: VZ.amber }}>{user.stats.notifications}</h4>
                <p className="text-[10px] text-muted-foreground mb-0">แจ้งเตือน</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Edit form (Velzon profile-settings inline) ===== */}
      {editMode && (
        <div className="vz-card p-4">
          <h5 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
            แก้ไขข้อมูลสมาชิก
          </h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">ชื่อ</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role</label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="soft" size="sm" className="text-xs" onClick={() => setEditMode(false)}>ยกเลิก</Button>
            <Button size="sm" className="text-xs" style={{ backgroundColor: VZ.teal, color: 'white' }} onClick={saveEdit}>บันทึก</Button>
          </div>
        </div>
      )}

      {/* ===== Velzon profile-nav tabs ===== */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="vz-card px-2 pt-2">
          <TabsList className="vz-tabs-custom bg-transparent p-0 h-auto">
            <TabsTrigger value="overview" className="vz-tabs-custom-trigger">Overview</TabsTrigger>
            <TabsTrigger value="activities" className="vz-tabs-custom-trigger">Activities</TabsTrigger>
            <TabsTrigger value="loans" className="vz-tabs-custom-trigger">ใบยืม</TabsTrigger>
          </TabsList>
        </div>

        {/* === Overview tab === */}
        <TabsContent value="overview" className="vz-tab-content mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT sidebar — Info card */}
            <div className="lg:col-span-1 space-y-4">
              {/* Info table — Velzon table-borderless pattern */}
              <div className="vz-card p-4">
                <h5 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                  ข้อมูลพื้นฐาน
                </h5>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><th className="text-muted-foreground text-left py-1.5 font-normal">ชื่อ:</th><td className="text-foreground text-right">{user.name}</td></tr>
                    <tr><th className="text-muted-foreground text-left py-1.5 font-normal">Email:</th><td className="text-foreground text-right truncate">{user.email}</td></tr>
                    <tr><th className="text-muted-foreground text-left py-1.5 font-normal">Role:</th><td className="text-right"><span className="vz-pill" style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}>{ROLE_LABELS[user.role]}</span></td></tr>
                    <tr><th className="text-muted-foreground text-left py-1.5 font-normal">เข้าร่วม:</th><td className="text-foreground text-right">{formatThaiDate(user.createdAt)}</td></tr>
                    <tr><th className="text-muted-foreground text-left py-1.5 font-normal">ID:</th><td className="text-muted-foreground text-right font-mono text-[10px]">{user.id}</td></tr>
                  </tbody>
                </table>
              </div>
              {/* Role permissions — Velzon "Skills" badges pattern */}
              <div className="vz-card p-4">
                <h5 className="text-sm font-semibold text-foreground mb-3" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                  สิทธิ์การเข้าถึง
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_PERMISSIONS[user.role]?.map((perm) => (
                    <span key={perm} className="vz-pill vz-pill-info">{perm}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* RIGHT — Recent activity feed */}
            <div className="lg:col-span-2">
              <div className="vz-card overflow-hidden">
                <div className="px-4 py-3 vz-divider flex items-center gap-2.5">
                  <span className="vz-icon-soft h-7 w-7" style={{ backgroundColor: VZ_SOFT.primary }}>
                    <Activity className="h-4 w-4" style={{ color: VZ.primary }} />
                  </span>
                  <h5 className="text-sm font-semibold text-foreground mb-0" style={{ fontFamily: 'var(--font-display), var(--font-display-thai)' }}>
                    กิจกรรมล่าสุด
                  </h5>
                </div>
                <ScrollArea className="h-[300px]">
                  <div>
                    {loadingData && <div className="p-4 text-xs text-muted-foreground text-center">กำลังโหลด...</div>}
                    {!loadingData && activities.length === 0 && (
                      <div className="p-6 text-center text-xs text-muted-foreground">ยังไม่มีกิจกรรม</div>
                    )}
                    {activities.map((a, i) => (
                      <div key={a.id} className={`px-4 py-2.5 flex items-start gap-2.5 ${i < activities.length - 1 ? 'border-b border-border/40' : ''}`}>
                        <div className="vz-avatar h-7 w-7 text-[10px] flex-shrink-0" style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}>{initials}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground">{a.description}</div>
                          <div className="text-[10px] text-muted-foreground">{formatThaiDateTime(a.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* === Activities tab — full list === */}
        <TabsContent value="activities" className="vz-tab-content mt-0">
          <div className="vz-card overflow-hidden">
            <ScrollArea className="h-[400px]">
              {loadingData && <div className="p-4 text-xs text-muted-foreground text-center">กำลังโหลด...</div>}
              {!loadingData && activities.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">ยังไม่มีกิจกรรม</div>
              )}
              {activities.map((a, i) => (
                <div key={a.id} className={`px-4 py-3 flex items-start gap-3 ${i < activities.length - 1 ? 'border-b border-border/40' : ''}`}>
                  <div className="vz-avatar h-8 w-8 text-xs flex-shrink-0" style={{ backgroundColor: roleCfg.bg, color: roleCfg.fg }}>{initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground">{a.description}</div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{a.action}</span>
                      <span>·</span>
                      <span>{a.targetType}</span>
                      <span>·</span>
                      <span>{formatThaiDateTime(a.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </TabsContent>

        {/* === Loans tab — user's loans as sales rep === */}
        <TabsContent value="loans" className="vz-tab-content mt-0">
          <div className="vz-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="vz-crm-table">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>ลูกค้า</th>
                    <th>สถานะ</th>
                    <th>กำหนดคืน</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingData && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">กำลังโหลด...</td></tr>}
                  {!loadingData && loans.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-1 text-muted-foreground/30" />
                      ยังไม่มีใบยืมของพนักงานคนนี้
                    </td></tr>
                  )}
                  {!loadingData && loans.map((l) => (
                    <tr key={l.docNo}>
                      <td><span className="font-mono font-semibold text-foreground">{l.docNo}</span></td>
                      <td>
                        <div className="text-foreground">{l.customerName}</div>
                        {l.customerCompany && <div className="text-[10px] text-muted-foreground">{l.customerCompany}</div>}
                      </td>
                      <td><span className="vz-pill vz-pill-muted">{l.status}</span></td>
                      <td className="text-muted-foreground text-[11px]">{formatThaiDate(l.expectedReturnDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Role permissions matrix
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin:   ['จัดการ users', 'จัดการ suppliers', 'จัดการทรัพย์สิน', 'สร้าง/แก้ใบยืม', 'จัดของ/ส่งมอบ/รับคืน', 'ตรวจนับ', 'ดู analytics', 'Export ข้อมูล'],
  sales:   ['สร้างใบยืม', 'ดูทรัพย์สิน', 'ดูใบยืมของตัวเอง'],
  store:   ['ลงทะเบียนทรัพย์สิน', 'จัดของ/ส่งมอบ/รับคืน', 'จัดการ suppliers', 'ตรวจนับ'],
  manager: ['ดูทุกหน้า', 'Export ข้อมูล', 'ดู analytics', 'อนุมัติใบยืม'],
}
