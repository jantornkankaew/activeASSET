'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Bell, BellOff, Send, CheckCircle2, AlertCircle } from 'lucide-react'

// PushNotificationManager — จัดการ push notification subscription
// แสดงในหน้า management หรือ settings
export function PushNotificationManager() {
  const { toast } = useToast()
  const [supported, setSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [hasVapid, setHasVapid] = useState(false)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    // เช็ค browser support
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }

    // ดึง VAPID status
    fetch('/api/push/subscribe').then(r => r.json()).then(data => {
      setHasVapid(data.hasVapid || false)
      setSubscriptionCount(data.subscriptionCount || 0)
    }).finally(() => setLoading(false))
  }, [])

  const subscribe = async () => {
    if (!supported) return
    setSubscribing(true)
    try {
      // ขอ permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        toast({ title: 'ไม่ได้รับอนุญาต', description: 'กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์', variant: 'destructive' })
        return
      }

      // ดึง VAPID public key
      const vapidRes = await fetch('/api/push/subscribe')
      const vapidData = await vapidRes.json()
      if (!vapidData.publicKey) {
        toast({ title: 'VAPID ไม่พร้อม', description: 'ผู้ดูแลยังไม่ได้ตั้ง VAPID keys', variant: 'destructive' })
        return
      }

      // สมัคร push subscription
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey) as unknown as BufferSource,
      })

      // ส่งไปยัง server
      const sub = subscription.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: sub.keys,
        }),
      })

      if (res.ok) {
        toast({ title: '✓ เปิดการแจ้งเตือนสำเร็จ' })
        setSubscriptionCount(prev => prev + 1)
      }
    } catch (e: unknown) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setSubscribing(false)
    }
  }

  const testPush = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'ไม่สามารถส่งได้', description: data.error, variant: 'destructive' })
        return
      }
      toast({
        title: `✓ ส่ง test push สำเร็จ`,
        description: `ส่งไป ${data.sent}/${data.total} subscription`,
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) return null
  if (!supported) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          เบราว์เซอร์นี้ไม่รองรับ Push Notifications
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="text-sm font-medium">Push Notifications</span>
          </div>
          <Badge variant="outline" className={`text-xs ${permission === 'granted' ? 'text-emerald-700 bg-emerald-50' : permission === 'denied' ? 'text-rose-700 bg-rose-50' : 'text-slate-500'}`}>
            {permission === 'granted' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : null}
            {permission === 'granted' ? 'อนุญาตแล้ว' : permission === 'denied' ? 'ปฏิเสธ' : 'ยังไม่ได้ตั้ง'}
          </Badge>
        </div>

        {subscriptionCount > 0 && (
          <div className="text-xs text-slate-500">
            มี {subscriptionCount} subscription ในระบบ
          </div>
        )}

        {!hasVapid && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠️ ผู้ดูแลยังไม่ได้ตั้ง VAPID keys — Push notifications จะทำงานไม่ได้จนกว่าจะตั้ง
          </div>
        )}

        <div className="flex gap-2">
          {permission !== 'granted' && (
            <Button size="sm" onClick={subscribe} disabled={subscribing || !hasVapid} className="flex-1">
              <Bell className="h-3.5 w-3.5 mr-1" />
              {subscribing ? 'กำลังสมัคร...' : 'เปิดการแจ้งเตือน'}
            </Button>
          )}
          {permission === 'granted' && subscriptionCount > 0 && (
            <Button size="sm" variant="outline" onClick={testPush} disabled={testing} className="flex-1">
              <Send className="h-3.5 w-3.5 mr-1" />
              {testing ? 'กำลังส่ง...' : 'ส่ง Test Push'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Helper: แปลง base64 → Uint8Array สำหรับ VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
