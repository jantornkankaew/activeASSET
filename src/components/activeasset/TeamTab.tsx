'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { EmptyState, LoadingState } from './shared'
import {
  Search, Plus, X, ChevronDown, Users as UsersIcon, Mail, Shield,
  CheckCircle2, Clock, FileText, Trash2, Grid3x3, List as ListIcon, MoreVertical,
} from 'lucide-react'

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

  return (
    <div className="space-y-4 animate-fade-in">
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
