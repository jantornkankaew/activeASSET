'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Download, X, Smartphone } from 'lucide-react'

// PWARegister — ลงทะเบียน service worker + แสดง install prompt
export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        setSwRegistration(reg)
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true)
              }
            })
          }
        })
      }).catch((err) => console.warn('SW registration failed:', err))
    }

    // Detect if already installed (PWA mode) — defer to escape effect sync phase
    Promise.resolve().then(() => {
      if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as { standalone?: boolean }).standalone) {
        setIsInstalled(true)
      }
    })

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const promptEvent = e as unknown as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
      setInstallPrompt(promptEvent)
      // แสดง banner ถ้ายังไม่ได้ dismiss
      const dismissed = localStorage.getItem('pwa-install-dismissed')
      if (!dismissed) {
        setTimeout(() => setShowInstall(true), 3000)
      }
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstall(false)
      setInstallPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setIsInstalled(true)
    }
    setInstallPrompt(null)
    setShowInstall(false)
  }

  const handleDismiss = () => {
    setShowInstall(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  const handleUpdate = () => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    window.location.reload()
  }

  return (
    <>
      {/* Install prompt banner */}
      {showInstall && installPrompt && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
          <Card className="border-slate-300 shadow-lg">
            <CardContent className="p-3 flex items-start gap-2">
              <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">ติดตั้ง activeASSET</div>
                <p className="text-xs text-slate-500 mt-0.5">ใช้งานแบบเต็มจอ + ออฟไลน์ได้</p>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleInstall}>
                    <Download className="h-3 w-3 mr-1" /> ติดตั้ง
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleDismiss}>
                    ไม่ใช่ตอนนี้
                  </Button>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleDismiss}>
                <X className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="border-emerald-300 bg-emerald-50 shadow-lg">
            <CardContent className="p-2 flex items-center gap-2">
              <span className="text-xs text-emerald-800">มีเวอร์ชันใหม่</span>
              <Button size="sm" className="h-7 text-xs" onClick={handleUpdate}>
                อัปเดต
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
