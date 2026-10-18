'use client'

import { useState, useEffect } from 'react'
import { useSimpleAuth, authFetch } from '@/components/auth/SimpleAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Building2, RefreshCw } from 'lucide-react'

interface TenantInfo {
  id: string
  name: string
  code: string
  plan: string
  active: boolean
  role: string
}

// TenantSwitcher — แสดงเฉพาะเมื่อ user มีหลาย tenant
export function TenantSwitcher() {
  const { user } = useSimpleAuth()
  const [tenants, setTenants] = useState<TenantInfo[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.resolve().then(async () => {
      if (cancelled) return
      try {
        const res = await authFetch('/api/user-tenants')
        if (!res.ok) return
        const data = await res.json()
        setTenants(data.tenants || [])
        setActiveTenantId(data.activeTenantId)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user])

  if (loading || tenants.length <= 1) return null

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === activeTenantId) return
    setSwitching(true)
    try {
      const res = await authFetch('/api/user-tenants/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (res.ok) {
        setActiveTenantId(tenantId)
        setTimeout(() => window.location.reload(), 500)
      }
    } finally {
      setSwitching(false)
    }
  }

  const active = tenants.find(t => t.id === activeTenantId) || tenants[0]

  return (
    <div className="flex items-center gap-1.5">
      <Building2 className="h-3.5 w-3.5 text-slate-400" />
      <Select value={activeTenantId || undefined} onValueChange={handleSwitch} disabled={switching}>
        <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs border-slate-200">
          <SelectValue>
            <span className="flex items-center gap-1">
              {switching && <RefreshCw className="h-3 w-3 animate-spin" />}
              {active?.code} — {active?.name.substring(0, 15)}
              {active?.name.length > 15 ? '...' : ''}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {tenants.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{t.code}</span>
                <span>{t.name}</span>
                <Badge variant="outline" className="text-[10px] ml-1">{t.role}</Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
