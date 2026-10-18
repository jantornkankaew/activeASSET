'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, Check, CheckCheck, X } from 'lucide-react'
import { formatThaiDateTime } from '@/lib/activeasset-constants'

interface NotificationItem {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  createdAt: string
}

// NotificationBell — แสดง notification icon + badge + drawer
// Polling-based (จริงๆ ควรใช้ WebSocket แต่สำหรับ prototype ใช้ polling ทุก 30 วินาที)
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=50')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
    } catch {}
  }, [])

  // Poll ทุก 30 วินาที + โหลดครั้งแรก
  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) load() })
    const interval = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [load])

  // โหลดเมื่อเปิด sheet
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) load() })
    return () => { cancelled = true }
  }, [open, load])

  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    load()
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="relative h-8 w-8 p-0"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-rose-500 text-white border-0">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> การแจ้งเตือน
              </span>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={markAllRead}>
                  <CheckCheck className="h-3 w-3 mr-1" /> อ่านทั้งหมด
                </Button>
              )}
            </SheetTitle>
            <SheetDescription>
              {unreadCount > 0 ? `มี ${unreadCount} ข้อความที่ยังไม่ได้อ่าน` : 'ไม่มีการแจ้งเตือนใหม่'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="divide-y">
              {notifications.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  ยังไม่มีการแจ้งเตือน
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 ${!n.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                      <div className="text-xs text-slate-400 mt-1">{formatThaiDateTime(n.createdAt)}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!n.read && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => markAsRead(n.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      {n.link && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs"
                          onClick={() => {
                            window.location.href = n.link!
                            setOpen(false)
                          }}
                        >
                          ดู
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
