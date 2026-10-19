'use client'

import { useState } from 'react'
import { useSimpleAuth } from '@/components/auth/SimpleAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Boxes, LogIn, LogOut, User as UserIcon } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { TenantSwitcher } from '@/components/auth/TenantSwitcher'
import { Badge } from '@/components/ui/badge'

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  sales: 'พนักงานขาย',
  store: 'เจ้าหน้าที่คลัง',
  manager: 'ผู้จัดการ',
}

const DEMO_ACCOUNTS = [
  { email: 'admin@activeasset.local', password: 'admin123', role: 'admin', label: 'ผู้ดูแลระบบ' },
  { email: 'sales@activeasset.local', password: 'sales123', role: 'sales', label: 'พนักงานขาย' },
  { email: 'store@activeasset.local', password: 'store123', role: 'store', label: 'เจ้าหน้าที่คลัง' },
  { email: 'manager@activeasset.local', password: 'manager123', role: 'manager', label: 'ผู้จัดการ' },
]

export function AuthGate({
  children,
  initialIsAuthenticated = false,
}: {
  children: React.ReactNode
  initialIsAuthenticated?: boolean
}) {
  const { user, login, logout } = useSimpleAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  // On server (SSR): use initialIsAuthenticated from cookie to render correct state immediately.
  // On client: use synchronously resolved user from localStorage.
  const isAuthed = typeof window === 'undefined' ? initialIsAuthenticated : !!user

  // ถ้ายังไม่ login → แสดง login form
  // ถ้า login แล้ว → แสดง children (AppShell)
  if (!isAuthed) {
    const handleLogin = async (e?: React.FormEvent, preset?: { email: string; password: string }) => {
      e?.preventDefault()
      const emailVal = preset?.email || email
      const passVal = preset?.password || password
      if (!emailVal || !passVal) {
        setError('กรุณากรอก email และ password')
        return
      }
      setLoadingLogin(true)
      setError('')
      const result = await login(emailVal, passVal)
      setLoadingLogin(false)
      if (!result.ok) {
        setError(result.error || 'เข้าสู่ระบบไม่สำเร็จ')
      }
    }

    return (
      <div className="min-h-screen flex items-stretch bg-background">
        {/* Left — Brand panel */}
        <div className="hidden lg:flex lg:w-1/2 gradient-brand relative overflow-hidden items-center justify-center p-12">
          <div className="absolute inset-0 mesh-bg opacity-30" />
          <div className="absolute top-20 left-20 h-32 w-32 rounded-full bg-accent/20 blur-2xl animate-pulse" />
          <div className="absolute bottom-20 right-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative z-10 text-primary-foreground max-w-md">
            <div className="h-16 w-16 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center mb-6 border border-primary-foreground/20">
              <Boxes className="h-9 w-9" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-3">activeASSET</h1>
            <p className="text-lg text-primary-foreground/70 mb-8 leading-relaxed">
              ระบบบริหารทรัพย์สินถาวรและเครื่องเดโมระดับองค์กร
            </p>

            <div className="space-y-4">
              {[
                { icon: '🔄', title: '3-Phase Loan Workflow', desc: 'ขอยืม → จัดของ → ส่งมอบ' },
                { icon: '📊', title: 'Real-time Analytics', desc: 'วิเคราะห์การใช้งาน + Demand vs Supply' },
                { icon: '🔐', title: 'Multi-tenant + RBAC', desc: 'แยกบริษัท + สิทธิ์ 4 บทบาท' },
                { icon: '📱', title: 'PWA + Offline', desc: 'ติดตั้งบนมือถือ + ใช้งานออฟไลน์' },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="h-10 w-10 rounded-xl bg-primary-foreground/10 backdrop-blur-sm flex items-center justify-center text-xl flex-shrink-0 border border-primary-foreground/10">
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{f.title}</div>
                    <div className="text-xs text-primary-foreground/50">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Login form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
          <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-accent/8 blur-3xl pointer-events-none" />

          <div className="w-full max-w-sm relative z-10 animate-fade-in">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
              <div className="h-12 w-12 rounded-xl gradient-brand flex items-center justify-center shadow-lift">
                <Boxes className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">activeASSET</h1>
                <p className="text-[10px] text-muted-foreground">Asset & Demo Management</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight mb-1">ยินดีต้อนรับ</h2>
              <p className="text-sm text-muted-foreground">เข้าสู่ระบบเพื่อจัดการทรัพย์สินของคุณ</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@activeasset.local"
                  className="h-11 bg-muted/30 border-border/50 rounded-xl transition-smooth focus:ring-2 focus:ring-accent/20"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 bg-muted/30 border-border/50 rounded-xl transition-smooth focus:ring-2 focus:ring-accent/20"
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-2.5 animate-fade-in">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl gradient-brand text-primary-foreground font-medium shadow-lift transition-smooth hover:shadow-float hover:-translate-y-0.5 disabled:translate-y-0 shimmer"
                disabled={loadingLogin}
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loadingLogin ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </Button>
            </form>

            {/* Demo accounts */}
            <div className="mt-8 pt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-3 text-center font-medium">บัญชีทดลอง — คลิกเพื่อเข้าสู่ระบบ</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a, i) => (
                  <button
                    key={a.email}
                    onClick={(e) => {
                      setEmail(a.email)
                      setPassword(a.password)
                      handleLogin(undefined, { email: a.email, password: a.password })
                    }}
                    className="text-xs p-2.5 border border-border/40 rounded-xl hover:bg-accent/5 hover:border-accent/30 hover-lift text-left bg-card/50 transition-smooth"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="font-semibold text-foreground">{a.label}</div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">{a.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export function UserMenu() {
  const { user, logout } = useSimpleAuth()
  if (!user) return null
  return (
    <div className="flex items-center gap-2">
      <TenantSwitcher />
      <NotificationBell />
      <Badge variant="outline" className={`text-xs ${user.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-200' : user.role === 'manager' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
        <UserIcon className="h-3 w-3 mr-1" />
        {user.name} • {ROLE_LABELS[user.role] || user.role}
      </Badge>
      <Button size="sm" variant="ghost" onClick={() => logout()}>
        <LogOut className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function useCurrentUser() {
  const { user } = useSimpleAuth()
  return {
    user,
    role: user?.role,
    isAdmin: user?.role === 'admin',
    isStore: user?.role === 'store',
    isManager: user?.role === 'manager',
    isSales: user?.role === 'sales',
  }
}
