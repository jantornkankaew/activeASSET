import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { headers } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'activeasset-dev-secret-2026-super-secure-key-for-jwt-signing'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  tenantId?: string
}

// Helper: อ่าน user จาก Bearer token (simple-auth) — รองรับ cross-origin
function getUserFromBearer(authHeader: string | null): AuthUser | null {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser
    return decoded
  } catch {
    return null
  }
}

// Helper: อ่าน user จาก NextAuth session (cookie-based — สำหรับ same-origin)
async function getUserFromSession(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return null
    const u = session.user as any
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      tenantId: u.tenantId,
    }
  } catch {
    return null
  }
}

// ตรวจสอบ auth — รองรับทั้ง Bearer token (cross-origin) และ NextAuth session (same-origin)
// ไม่ต้องรับ req parameter — ใช้ headers() ของ Next.js แทน
export async function requireAuth(): Promise<{ user: AuthUser | null; session: any; response?: NextResponse }> {
  // อ่าน Authorization header จาก next/headers
  const h = await headers()
  const authHeader = h.get('authorization')

  // ลอง Bearer token ก่อน
  let user = getUserFromBearer(authHeader)

  // ถ้าไม่มี, ลอง NextAuth session
  if (!user) {
    const session = await getUserFromSession()
    if (session) {
      user = session
    }
  }

  if (!user) {
    return {
      user: null,
      session: null,
      response: NextResponse.json({ error: 'ไม่ได้ล็อกอิน' }, { status: 401 }),
    }
  }
  return { user, session: { user } }
}

// ตรวจสอบ role
export async function requireRole(...roles: string[]): Promise<{ user: AuthUser | null; session: any; response?: NextResponse }> {
  const { user, session, response } = await requireAuth()
  if (response) return { user: null, session: null, response }
  if (!user || !roles.includes(user.role)) {
    return {
      user: null,
      session: null,
      response: NextResponse.json({ error: `ไม่มีสิทธิ์ (ต้องการ: ${roles.join(' หรือ ')})` }, { status: 403 }),
    }
  }
  return { user, session }
}

// สำหรับ routes ที่ต้องการรับ req โดยตรง (compatibility)
export async function requireAuthWithReq(req: Request): Promise<{ user: AuthUser | null; session: any; response?: NextResponse }> {
  return requireAuth()
}

export async function requireRoleWithReq(req: Request, ...roles: string[]): Promise<{ user: AuthUser | null; session: any; response?: NextResponse }> {
  return requireRole(...roles)
}

// ตรวจ cron secret
export function requireCronSecret(request: Request): { ok: boolean; response?: NextResponse } {
  const authHeader = request.headers.get('authorization')
  const url = new URL(request.url)
  const secretFromUrl = url.searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET || 'activeasset-cron-dev-secret'
  if (authHeader !== `Bearer ${expectedSecret}` && secretFromUrl !== expectedSecret) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'cron secret ไม่ถูกต้อง' }, { status: 401 }),
    }
  }
  return { ok: true }
}
