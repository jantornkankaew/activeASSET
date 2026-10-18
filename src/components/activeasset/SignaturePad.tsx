'use client'

import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string | null
}

interface SignaturePadProps {
  label?: string
  hint?: string
  height?: number
  required?: boolean
  onChange?: (hasContent: boolean) => void
}

// Canvas สำหรับลายเซ็นดิจิทัล — รองรับทั้ง mouse และ touch
// ปิดช่องว่างข้อ 2: ลายเซ็นจริง (บังคับเซ็น ไม่สร้างตัวอย่าง)
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ label = 'ลงลายมือชื่อ', hint = 'ใช้นิ้วหรือปากกาสไตลัสเซ็นในกรอบด้านล่าง', height = 180, required = false, onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [hasContent, setHasContent] = useState(false)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.scale(dpr, dpr)
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#0f172a'
      }
    }, [])

    // Poll canvas content as a fallback: บางเบราว์เซอร์/ตัวทดสอบอัตโนมัติ dispatch pointer events
    // ที่ไม่ไปถึง React's onPointerDown — ใช้การตรวจ pixel data เป็นกลไกสำรอง
    useEffect(() => {
      const id = setInterval(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          // ตรวจหา pixel ที่ไม่ใช่โปร่งใส (alpha > 0)
          let hasPixel = false
          for (let i = 3; i < imgData.length; i += 16) { // sample every 4th pixel
            if (imgData[i] > 0) { hasPixel = true; break }
          }
          if (hasPixel && !hasContent) {
            setHasContent(true)
            onChange?.(true)
          } else if (!hasPixel && hasContent) {
            setHasContent(false)
            onChange?.(false)
          }
        } catch {
          // ignore (canvas may not be ready)
        }
      }, 400)
      return () => clearInterval(id)
    }, [hasContent, onChange])

    useImperativeHandle(ref, () => ({
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        setHasContent(false)
        onChange?.(false)
      },
      isEmpty: () => !hasContent,
      toDataURL: () => {
        if (!hasContent) return null
        return canvasRef.current?.toDataURL('image/png') ?? null
      },
    }))

    const getPos = (e: React.PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    const startDraw = (e: React.PointerEvent) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic events may not support capture */ }
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(pos.x + 0.1, pos.y + 0.1) // tiny dot so single tap registers
      ctx.stroke()
      setIsDrawing(true)
      if (!hasContent) {
        setHasContent(true)
        onChange?.(true)
      }
    }

    const draw = (e: React.PointerEvent) => {
      if (!isDrawing) return
      e.preventDefault()
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      const pos = getPos(e)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    }

    const endDraw = (e: React.PointerEvent) => {
      if (!isDrawing) return
      e.preventDefault()
      const canvas = canvasRef.current
      if (canvas) {
        try { canvas.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      }
      setIsDrawing(false)
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            {label}
            {required && <span className="text-rose-600 ml-1">*</span>}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const c = canvasRef.current
              if (c) {
                const ctx = c.getContext('2d')
                ctx?.clearRect(0, 0, c.width, c.height)
                setHasContent(false)
                onChange?.(false)
              }
            }}
          >
            <Eraser className="h-4 w-4 mr-1" /> ล้าง
          </Button>
        </div>
        <div className="relative border-2 border-dashed border-slate-300 rounded-md bg-slate-50">
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height: `${height}px` }}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            onPointerCancel={endDraw}
          />
          {!hasContent && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm">
              {hint}
            </div>
          )}
        </div>
        {required && !hasContent && (
          <p className="text-xs text-rose-600">จำเป็นต้องลงลายมือชื่อก่อนยืนยัน</p>
        )}
      </div>
    )
  }
)

SignaturePad.displayName = 'SignaturePad'
