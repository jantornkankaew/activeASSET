'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Activity as ActivityIcon, Package, Truck, ScanLine, Plus, Calendar, Wrench,
} from 'lucide-react'
import { formatThaiDateTime } from '@/lib/activeasset-constants'

interface ActivityItem {
  id: string
  userId: string | null
  userName: string
  action: string
  targetType: string | null
  targetId: string | null
  description: string
  createdAt: string
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create_loan: <Plus className="h-3.5 w-3.5" />,
  dispatch: <Package className="h-3.5 w-3.5" />,
  deliver: <Truck className="h-3.5 w-3.5" />,
  return: <ScanLine className="h-3.5 w-3.5" />,
  create_reservation: <Calendar className="h-3.5 w-3.5" />,
  register_asset: <Package className="h-3.5 w-3.5" />,
  repair: <Wrench className="h-3.5 w-3.5" />,
}

const ACTION_COLORS: Record<string, string> = {
  create_loan: 'bg-primary/10 text-primary ring-primary/20',
  dispatch: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  deliver: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
  return: 'bg-accent/10 text-accent ring-accent/20',
  create_reservation: 'bg-purple-500/10 text-purple-500 ring-purple-500/20',
  register_asset: 'bg-primary/10 text-primary ring-primary/20',
  repair: 'bg-rose-500/10 text-rose-500 ring-rose-500/20',
}

// ActivityFeed — แสดงกิจกรรมล่าสุดของระบบ
export function ActivityFeed({ embedded = false }: { embedded?: boolean }) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/activities?limit=15')
      if (!res.ok) return
      const data = await res.json()
      setActivities(data.activities || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) load() })
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [load])

  const list = (
    <div className="divide-y divide-border">
      {loading && <p className="p-4 text-center text-muted-foreground text-xs">กำลังโหลด...</p>}
      {!loading && activities.length === 0 && (
        <div className="p-8 text-center text-xs text-muted-foreground">
          <ActivityIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          ยังไม่มีกิจกรรม
        </div>
      )}
      {activities.map(a => {
        const colorClass = ACTION_COLORS[a.action] || 'bg-muted text-muted-foreground ring-border'
        return (
          <div key={a.id} className="px-4 py-2.5 flex items-start gap-3 text-xs hover:bg-muted/30 transition-smooth">
            <div className={`h-7 w-7 rounded-md ${colorClass} ring-1 flex items-center justify-center flex-shrink-0 mt-0.5`}>
              {ACTION_ICONS[a.action] || <ActivityIcon className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-foreground font-medium leading-snug">{a.description}</div>
              <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-[10px]">
                <span className="font-medium">{a.userName}</span>
                <span className="text-muted-foreground/50">•</span>
                <span>{formatThaiDateTime(a.createdAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (embedded) {
    return (
      <ScrollArea className="h-[300px]">{list}</ScrollArea>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ActivityIcon className="h-4 w-4" /> กิจกรรมล่าสุด
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">{list}</ScrollArea>
      </CardContent>
    </Card>
  )
}
