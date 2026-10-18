import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/auth/api-guard'

const execFileAsync = promisify(execFile)

// GET /api/loans/[docNo]/pdf?type=loan|return — Generate and download PDF
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docNo: string }> }
) {
  const { response } = await requireAuth()
  if (response) return response

  const { docNo } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') === 'return' ? 'return' : 'loan'

  // สร้าง temp file path
  const tmpDir = '/tmp/activeasset-pdfs'
  await mkdir(tmpDir, { recursive: true })
  const outputPath = path.join(tmpDir, `${docNo}-${type}-${Date.now()}.pdf`)

  try {
    // เรียก Python script
    const { stdout, stderr } = await execFileAsync(
      'python3',
      ['/home/z/my-project/scripts/gen-loan-pdf.py', docNo, '--type', type, '--output', outputPath],
      { timeout: 30000 }
    )

    // ตรวจผลลัพธ์
    const result = JSON.parse(stdout.trim())
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // อ่าน PDF file
    const pdfBuffer = await readFile(outputPath)

    // ลบ temp file
    await unlink(outputPath).catch(() => {})

    // ส่ง PDF กลับ
    // ใช้ ASCII filename + filename* (RFC 5987) สำหรับ Thai
    const asciiFilename = `${type === 'return' ? 'return' : 'loan'}-${docNo}.pdf`
    const thaiFilename = `${type === 'return' ? 'ใบคืน' : 'ใบยืม'}-${docNo}.pdf`
    const encodedThai = encodeURIComponent(thaiFilename)
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedThai}`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (e) {
    // cleanup
    await unlink(outputPath).catch(() => {})
    const err = e as Error & { stderr?: string }
    return NextResponse.json({
      error: 'PDF generation failed',
      details: err.stderr || err.message,
    }, { status: 500 })
  }
}
