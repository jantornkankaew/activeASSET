'use client'

// Providers — ใช้สำหรับ wrap children
// (เดิมใช้ SessionProvider ของ next-auth แต่เราเปลี่ยนไปใช้ SimpleAuth แทน
// เพราะ next-auth ใช้ cookies ที่ไม่ทำงานข้าม cross-origin)
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
