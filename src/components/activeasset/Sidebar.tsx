'use client'

import { useSimpleAuth } from '@/components/auth/SimpleAuth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { TenantSwitcher } from '@/components/auth/TenantSwitcher'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import {
  Boxes, FileText, Calendar, CalendarDays, ClipboardCheck, TrendingUp,
  Package, Plus, Building2, Download, Users,
  Home, Wrench, ScanLine,
  Menu, X, Clock, AlertTriangle,
} from 'lucide-react'

export type SidebarPage =
  | 'overview' | 'loans' | 'store-counter' | 'reservations' | 'return-calendar'
  | 'assets' | 'assets-register' | 'assets-suppliers'
  | 'audit' | 'analytics' | 'team'
  | 'export-loans' | 'export-assets' | 'export-analytics'

interface SidebarGroup {
  label: string
  items: SidebarItem[]
}

interface SidebarItem {
  id: SidebarPage
  label: string
  icon: React.ReactNode
  badge?: number
  badgeColor?: string
  roles?: string[]
  children?: { id: SidebarPage; label: string; icon: React.ReactNode }[]
}

interface SidebarProps {
  currentPage: SidebarPage
  onPageChange: (page: SidebarPage) => void
  stats?: { totalAssets: number; available: number; onLoan: number; overdueLoans: number; queuedLoans: number }
  onOpenCreateLoan: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  currentPage, onPageChange, stats, onOpenCreateLoan,
  collapsed, onToggleCollapse, mobileOpen, onMobileClose,
}: SidebarProps) {
  const { user } = useSimpleAuth()
  const role = user?.role || 'sales'
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'

  // Define groups — Velzon-style structure
  const groups: SidebarGroup[] = [
    {
      label: 'เมนูหลัก',
      items: [
        { id: 'overview', label: 'ภาพรวม', icon: <Home className="h-4 w-4" /> },
        {
          id: 'loans', label: 'ใบยืม & จัดส่ง', icon: <FileText className="h-4 w-4" />,
          badge: stats?.overdueLoans || 0, badgeColor: 'rose',
        },
        {
          id: 'store-counter', label: 'เคาน์เตอร์รับคืน', icon: <ScanLine className="h-4 w-4" />,
        },
        {
          id: 'reservations', label: 'จอง & คิวยืม', icon: <Calendar className="h-4 w-4" />,
          badge: stats?.queuedLoans || 0, badgeColor: 'amber',
        },
        {
          id: 'return-calendar', label: 'ปฏิทินคืน', icon: <CalendarDays className="h-4 w-4" />,
        },
      ],
    },
    {
      label: 'สินค้า',
      items: [
        { id: 'assets', label: 'ทรัพย์สิน', icon: <Package className="h-4 w-4" /> },
        {
          id: 'assets-register', label: 'ลงทะเบียนใหม่', icon: <Plus className="h-4 w-4" />,
          roles: ['admin', 'store'],
        },
        {
          id: 'assets-suppliers', label: 'Suppliers', icon: <Building2 className="h-4 w-4" />,
          roles: ['admin', 'store'],
        },
        { id: 'audit', label: 'ตรวจนับ', icon: <ClipboardCheck className="h-4 w-4" /> },
      ],
    },
    {
      label: 'รายงาน',
      items: [
        { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-4 w-4" /> },
        {
          id: 'export-loans', label: 'Export ใบยืม', icon: <Download className="h-4 w-4" />,
          roles: ['admin', 'manager'],
        },
        {
          id: 'export-assets', label: 'Export ทรัพย์สิน', icon: <Download className="h-4 w-4" />,
          roles: ['admin', 'manager'],
        },
        {
          id: 'export-analytics', label: 'Export Analytics', icon: <Download className="h-4 w-4" />,
          roles: ['admin', 'manager'],
        },
      ],
    },
    {
      label: 'ระบบ',
      items: [
        {
          id: 'team', label: 'ทีมงาน', icon: <Users className="h-4 w-4" />,
          roles: ['admin'],
        },
      ],
    },
  ]

  const badgeColors: Record<string, string> = {
    rose: 'bg-rose-500 text-white',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-blue-500 text-white',
    primary: 'bg-primary text-primary-foreground',
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 lg:z-30
        h-screen lg:h-auto
        bg-card border-r border-border
        flex flex-col
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header — logo + collapse toggle */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-border flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Boxes className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm tracking-tight">activeASSET</span>
            </div>
          )}
          {collapsed && (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <Boxes className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
          )}
          <button
            className="hidden lg:flex p-1 rounded hover:bg-muted transition-smooth"
            onClick={onToggleCollapse}
          >
            <Menu className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            className="lg:hidden p-1 rounded hover:bg-muted"
            onClick={onMobileClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Create button */}
        <div className="p-2">
          <Button
            size="sm"
            className={`w-full ${collapsed ? 'px-0' : ''}`}
            onClick={() => { onOpenCreateLoan(); onMobileClose() }}
            title="ขอยืมใหม่"
          >
            {collapsed ? <Plus className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" /> ขอยืมใหม่</>}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 -mx-1">
          <nav className="px-2 pb-4 space-y-4">
            {groups.map((group) => {
              const visibleItems = group.items.filter(item => !item.roles || item.roles.includes(role))
              if (visibleItems.length === 0) return null
              return (
                <div key={group.label}>
                  {!collapsed && (
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group.label}
                    </div>
                  )}
                  {collapsed && <div className="h-px bg-border/30 mx-2 my-2" />}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const active = currentPage === item.id
                      return (
                        <button
                          key={item.id}
                          onClick={() => { onPageChange(item.id); onMobileClose() }}
                          className={`
                            w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-smooth
                            ${active
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }
                            ${collapsed ? 'justify-center px-2' : ''}
                          `}
                          title={collapsed ? item.label : undefined}
                        >
                          <span className="flex-shrink-0">{item.icon}</span>
                          {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                          {!collapsed && item.badge && item.badge > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColors[item.badgeColor || 'primary']}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Footer — controls only */}
        <div className="border-t border-border p-2">
          <div className={`flex items-center gap-1 ${collapsed ? 'flex-col' : ''}`}>
            <ThemeToggle />
            <NotificationBell />
            <TenantSwitcher />
          </div>
        </div>
      </aside>
    </>
  )
}
