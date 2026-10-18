import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/db'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'activeasset-dev-secret-2026-super-secure-key-for-jwt-signing'

// POST /api/auth/simple-login — สำหรับ cross-origin (localStorage based)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'กรุณากรอก email และ password' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!user) {
      return NextResponse.json({ error: 'Email หรือ Password ไม่ถูกต้อง' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return NextResponse.json({ error: 'Email หรือ Password ไม่ถูกต้อง' }, { status: 401 })
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || user.activeTenantId,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId || user.activeTenantId,
      },
    })
  } catch (err: any) {
    console.error('simple-login error:', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด: ' + err.message }, { status: 500 })
  }
}
