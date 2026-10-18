import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { requireAuth } from '@/lib/auth/api-guard'

// POST /api/uploads — อัปโหลดรูป (ต้องล็อกอิน)
export async function POST(request: Request) {
  const { response } = await requireAuth()
  if (response) return response

  const body = await request.json()
  const { data, caption } = body

  if (!data || typeof data !== 'string') {
    return NextResponse.json({ error: 'ต้องส่ง base64 data' }, { status: 400 })
  }

  // แยก data URL prefix ออก
  const matches = data.match(/^data:image\/(\w+);base64,(.+)$/)
  let buffer: Buffer
  let ext = 'jpg'
  if (matches) {
    ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    buffer = Buffer.from(matches[2], 'base64')
  } else {
    buffer = Buffer.from(data, 'base64')
  }

  // จำกัดขนาด ~5MB
  if (buffer.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'รูปใหญ่เกิน 5MB' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(uploadDir, { recursive: true })
  const filename = `${randomUUID()}.${ext}`
  const filepath = path.join(uploadDir, filename)
  await writeFile(filepath, buffer)

  // return path ที่ client ใช้แสดงผลได้
  const publicPath = `/uploads/${filename}`
  return NextResponse.json({ path: publicPath, caption: caption || null })
}
