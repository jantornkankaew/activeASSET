import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'activeasset-dev-secret-2026-super-secure-key-for-jwt-signing'

// GET /api/auth/simple-session — อ่าน user จาก Bearer token
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ user: null })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string
      email: string
      name: string
      role: string
      tenantId?: string
    }

    return NextResponse.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        tenantId: decoded.tenantId,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
  } catch (err: any) {
    // Token invalid/expired
    return NextResponse.json({ user: null })
  }
}
