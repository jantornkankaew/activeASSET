'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'

// ThemeToggle — สลับ light / dark / system
// ใช้ icon-only (ไม่มีข้อความ) เพื่อ minimal aesthetic
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true))
  }, [])

  if (!mounted) {
    return <div className="h-8 w-8" /> // placeholder ป้องกัน hydration mismatch
  }

  const cycle = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const icon = theme === 'light' ? <Sun className="h-4 w-4" />
    : theme === 'dark' ? <Moon className="h-4 w-4" />
    : <Monitor className="h-4 w-4" />

  const label = theme === 'light' ? 'สว่าง' : theme === 'dark' ? 'มืด' : 'ตามระบบ'

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 transition-smooth hover:bg-accent/10"
      onClick={cycle}
      title={`ธีม: ${label}`}
    >
      {icon}
    </Button>
  )
}
