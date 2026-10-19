'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useSimpleAuth, authFetch } from '@/components/auth/SimpleAuth'
import { OverviewTab } from '@/components/activeasset/OverviewTab'
import { AssetsTab } from '@/components/activeasset/AssetsTab'
import { LoansTab } from '@/components/activeasset/LoansTab'
import { AuditTab } from '@/components/activeasset/AuditTab'
import { AnalyticsTab } from '@/components/activeasset/AnalyticsTab'
import { TeamTab } from '@/components/activeasset/TeamTab'
import { ReturnCalendarTab } from '@/components/activeasset/ReturnCalendarTab'
import { ReservationTab } from '@/components/activeasset/ReservationTab'
import { RegisterAssetView, SuppliersView } from '@/components/activeasset/AssetsManagementViews'
import { RequestLoanSheet } from '@/components/activeasset/RequestLoanSheet'
import { StoreView } from '@/components/activeasset/StoreView'
import { SupplierAlertsWidget } from '@/components/activeasset/SupplierAlertsWidget'
import { Sidebar, type SidebarPage } from '@/components/activeasset/Sidebar'
import { AuthGate } from '@/components/auth/AuthGate'
import { Menu, LogOut } from 'lucide-react'

export default function Home() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  )
}

const VALID_PAGES: SidebarPage[] = [
  'overview',
  'loans',
  'store-counter',
  'reservations',
  'assets',
  'assets-register',
  'assets-suppliers',
  'audit',
  'return-calendar',
  'analytics',
  'team',
]

function AppShell() {
  const { user, logout } = useSimpleAuth()
  const session = user ? { user } : null

  // อ่านหน้าเริ่มต้นจาก URL hash, query param หรือ localStorage ทันทีที่โหลด (Synchronous lazy initializer)
  const [page, setPage] = useState<SidebarPage>(() => {
    if (typeof window === 'undefined') return 'overview'
    try {
      const rawHash = window.location.hash.replace(/^#/, '').split('?')[0] as SidebarPage
      const query = new URLSearchParams(window.location.search).get('page') as SidebarPage
      const saved = localStorage.getItem('activeasset_current_page') as SidebarPage
      const candidate = [rawHash, query, saved].find((p): p is SidebarPage => !!p && VALID_PAGES.includes(p))
      if (candidate) return candidate
    } catch {}
    return 'overview'
  })

  // อ่านสถานะหน้าต่าง "ขอยืมใหม่" ว่าเปิดอยู่หรือไม่ (จาก hash หรือ localStorage)
  const [createLoanOpen, setCreateLoanOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const rawHash = window.location.hash.replace(/^#/, '')
      const action = new URLSearchParams(window.location.search).get('action')
      const saved = localStorage.getItem('activeasset_create_loan_open')
      return rawHash === 'create-loan' || action === 'create-loan' || saved === 'true'
    } catch {}
    return false
  })

  const [auditStartTrigger, setAuditStartTrigger] = useState(0)
  const [globalStats, setGlobalStats] = useState<{ totalAssets: number; available: number; onLoan: number; overdueLoans: number; queuedLoans: number } | null>(null)
  const [openLoanDocNo, setOpenLoanDocNo] = useState<string | null>(null)
  const [loansRefreshKey, setLoansRefreshKey] = useState(0)

  // Sidebar state
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ฟังก์ชันเปิด-ปิด "ขอยืมใหม่" พร้อม sync กับ URL hash และ localStorage
  const handleOpenCreateLoan = () => {
    setCreateLoanOpen(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeasset_create_loan_open', 'true')
      window.history.replaceState(null, '', '#create-loan')
    }
  }

  const handleCloseCreateLoan = (openState: boolean) => {
    setCreateLoanOpen(openState)
    if (!openState && typeof window !== 'undefined') {
      localStorage.removeItem('activeasset_create_loan_open')
      window.history.replaceState(null, '', `#${page}`)
    }
  }

  // บันทึกหน้าปัจจุบันลง localStorage และ URL hash ทุกครั้งที่เปลี่ยนหน้า (กด refresh จะได้หน้าเดิมเสมอ 100%)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (createLoanOpen) {
      localStorage.setItem('activeasset_create_loan_open', 'true')
      if (window.location.hash !== '#create-loan') {
        window.history.replaceState(null, '', '#create-loan')
      }
    } else {
      localStorage.removeItem('activeasset_create_loan_open')
      if (VALID_PAGES.includes(page)) {
        localStorage.setItem('activeasset_current_page', page)
        if (window.location.hash !== `#${page}`) {
          window.history.replaceState(null, '', `#${page}`)
        }
      }
    }
  }, [page, createLoanOpen])

  // รองรับปุ่ม Back / Forward ของเบราว์เซอร์
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleHashChange = () => {
      const rawHash = window.location.hash.replace(/^#/, '')
      if (rawHash === 'create-loan') {
        setCreateLoanOpen(true)
        return
      }
      if (VALID_PAGES.includes(rawHash as SidebarPage)) {
        setCreateLoanOpen(false)
        setPage(rawHash as SidebarPage)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleOpenLoanFromOverview = (docNo: string | null) => {
    if (docNo) {
      setOpenLoanDocNo(docNo)
      setPage('loans')
    }
  }

  useEffect(() => {
    Promise.all([
      authFetch('/api/dashboard').then(r => r.json()),
      authFetch('/api/loans?status=Queued').then(r => r.json()).catch(() => ({ loans: [] })),
    ]).then(([dashData, queueData]) => {
      setGlobalStats({
        totalAssets: dashData.summary.totalAssets,
        available: dashData.summary.available,
        onLoan: dashData.summary.onLoan,
        overdueLoans: dashData.summary.overdueLoans,
        queuedLoans: queueData.loans?.length || 0,
      })
    }).catch(() => {})
  }, [page, createLoanOpen, loansRefreshKey])

  const handlePageChange = (newPage: SidebarPage) => {
    // Handle export pages — open in new tab
    if (newPage === 'export-loans') { window.open('/api/export/loans', '_blank'); return }
    if (newPage === 'export-assets') { window.open('/api/export/assets', '_blank'); return }
    if (newPage === 'export-analytics') { window.open('/api/export/analytics', '_blank'); return }
    if (newPage === 'audit') { setAuditStartTrigger(x => x + 1) }
    setCreateLoanOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('activeasset_create_loan_open')
      localStorage.setItem('activeasset_current_page', newPage)
      window.history.replaceState(null, '', `#${newPage}`)
    }
    setPage(newPage)
  }

  // Get page title for header
  const pageTitles: Record<string, string> = {
    overview: 'ภาพรวม',
    loans: 'ใบยืม & จัดส่ง',
    'store-counter': 'เคาน์เตอร์รับคืน (Store Check-In)',
    reservations: 'จอง & คิวยืม',
    assets: 'ทรัพย์สิน',
    'assets-register': 'ลงทะเบียนใหม่',
    'assets-suppliers': 'Suppliers',
    audit: 'ตรวจนับ',
    'return-calendar': 'ปฏิทินคืน',
    analytics: 'Analytics',
    team: 'ทีม & สิทธิ์การใช้งาน',
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentPage={page}
        onPageChange={handlePageChange}
        stats={globalStats || undefined}
        onOpenCreateLoan={handleOpenCreateLoan}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — mobile menu + page title + user */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden p-1.5 rounded hover:bg-muted"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold tracking-tight">{pageTitles[page] || 'activeASSET'}</h1>
            </div>
          </div>

          {/* User controls */}
          <div className="flex items-center gap-2">
            {globalStats && (
              <div className="hidden lg:flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/8 text-xs font-medium text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="tabular-nums">{globalStats.available}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/8 text-xs font-medium text-amber-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="tabular-nums">{globalStats.onLoan}</span>
                </div>
                {globalStats.overdueLoans > 0 && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/8 text-xs font-medium text-rose-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="tabular-nums">{globalStats.overdueLoans}</span>
                  </div>
                )}
              </div>
            )}
            {session?.user && (
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-medium">{user?.name}</div>
                  <div className="text-[10px] text-muted-foreground">{user?.role}</div>
                </div>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <button
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
                  onClick={() => logout()}
                  title="ออกจากระบบ"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <SupplierAlertsWidget />

          {page === 'overview' && (
            <OverviewTab
              onNavigate={(t) => {
                if (t === 'waiting') {
                  setPage('reservations')
                } else if (t === 'store-counter') {
                  setPage('store-counter')
                } else {
                  setPage(t)
                }
              }}
              onCreateLoan={handleOpenCreateLoan}
              onStartAudit={() => { setPage('audit'); setAuditStartTrigger(x => x + 1) }}
              onOpenLoan={handleOpenLoanFromOverview}
            />
          )}
          {page === 'assets' && <AssetsTab onBorrow={handleOpenCreateLoan} />}
          {page === 'assets-register' && (
            <RegisterAssetView
              onDone={() => setPage('assets')}
              onBack={() => setPage('assets')}
            />
          )}
          {page === 'assets-suppliers' && (
            <SuppliersView onBack={() => setPage('assets')} />
          )}
          {page === 'loans' && (
            <LoansTab
              createLoanOpen={createLoanOpen}
              onOpenCreateLoan={handleOpenCreateLoan}
              refreshKey={loansRefreshKey}
              initialOpenDocNo={openLoanDocNo}
              onConsumeInitialDocNo={() => setOpenLoanDocNo(null)}
            />
          )}
          {page === 'store-counter' && <StoreView />}
          {page === 'reservations' && <ReservationTab />}
          {page === 'return-calendar' && <ReturnCalendarTab onOpenLoan={handleOpenLoanFromOverview} />}
          {page === 'audit' && <AuditTab startNewTrigger={auditStartTrigger} />}
          {page === 'analytics' && <AnalyticsTab />}
          {page === 'team' && <TeamTab />}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-card px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground/60">activeASSET</span>
            <span>·</span>
            <span>Enterprise</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Online</span>
            <span>·</span>
            <span>PWA</span>
          </div>
        </footer>
      </div>

      <RequestLoanSheet
        open={createLoanOpen}
        onOpenChange={handleCloseCreateLoan}
        onCreated={() => setLoansRefreshKey(k => k + 1)}
      />
    </div>
  )
}
