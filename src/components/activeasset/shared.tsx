'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  ASSET_STATUS_LABELS, LOAN_STATUS_LABELS, GRADE_LABELS, ASSET_TYPE_LABELS,
  CATEGORY_LABELS, PURPOSE_LABELS, SOURCE_LABELS, INDUSTRY_LABELS,
  getAssetStatusLabel, getLoanStatusLabel,
} from '@/lib/activeasset-constants'

// ===== Status Badges =====
export function AssetStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = getAssetStatusLabel(status)
  return (
    <Badge variant="outline" className={cn('text-xs', s.color, s.bg, className)}>
      {s.label}
    </Badge>
  )
}

export function LoanStatusBadge({ status, className }: { status: string; className?: string }) {
  const s = getLoanStatusLabel(status)
  return (
    <Badge variant="outline" className={cn('text-xs', s.color, s.bg, className)}>
      {s.label}
    </Badge>
  )
}

export function GradeBadge({ grade, className }: { grade: string; className?: string }) {
  const g = GRADE_LABELS[grade]
  if (!g) return null
  return (
    <Badge variant="outline" className={cn('text-xs', g.color, g.bg, className)}>
      Grade {g.label}
    </Badge>
  )
}

export function PurposeBadge({ purpose, className }: { purpose: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {PURPOSE_LABELS[purpose] || purpose}
    </Badge>
  )
}

export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {CATEGORY_LABELS[category] || category}
    </Badge>
  )
}

export function SourceBadge({ source, className }: { source: string; className?: string }) {
  const s = SOURCE_LABELS[source]
  if (!s) return null
  return (
    <Badge variant="outline" className={cn('text-xs', s.color, s.bg, className)}>
      {s.label}
    </Badge>
  )
}

export function IndustryBadge({ industry, className }: { industry: string; className?: string }) {
  const label = INDUSTRY_LABELS[industry] || industry
  return (
    <Badge variant="outline" className={cn('text-xs', className)}>
      {label}
    </Badge>
  )
}

// ===== Phase Stepper (3-phase loan indicator) =====
export function PhaseStepper({ status, className }: { status: string; className?: string }) {
  const meta = LOAN_STATUS_LABELS[status]
  if (!meta) return null
  const phase = meta.phase
  const steps = [
    { n: 1, label: 'ขอยืม' },
    { n: 2, label: 'จัดของ' },
    { n: 3, label: 'ส่งมอบ/ยืม' },
  ]
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((s, i) => {
        const done = phase > s.n
        const active = phase === s.n
        return (
          <div key={s.n} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
              done && 'bg-emerald-100 text-emerald-700',
              active && 'bg-slate-900 text-white',
              !done && !active && 'bg-slate-100 text-slate-400'
            )}>
              <span className="font-bold">{done ? '✓' : s.n}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 2 && <span className="text-slate-300 text-xs mx-0.5">›</span>}
          </div>
        )
      })}
    </div>
  )
}

// ===== Stat Card =====
const TONES: Record<string, string> = {
  slate: 'bg-card text-foreground border-border',
  emerald: 'bg-emerald-500/5 text-foreground border-emerald-500/20',
  amber: 'bg-amber-500/5 text-foreground border-amber-500/20',
  purple: 'bg-purple-500/5 text-foreground border-purple-500/20',
  blue: 'bg-blue-500/5 text-foreground border-blue-500/20',
  rose: 'bg-rose-500/5 text-foreground border-rose-500/20',
}

const TONE_DOTS: Record<string, string> = {
  slate: 'bg-muted-foreground',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  rose: 'bg-rose-500',
}

export function StatCard({
  label, value, icon, tone = 'slate', onClick,
}: {
  label: string
  value: number | string
  icon?: React.ReactNode
  tone?: keyof typeof TONES | string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'text-left p-3 rounded-xl border transition-smooth shadow-premium',
        TONES[tone] || TONES.slate,
        onClick && 'hover:shadow-md cursor-pointer hover:border-accent/30'
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon || <span className={cn('h-2 w-2 rounded-full', TONE_DOTS[tone] || TONE_DOTS.slate)} />}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold mt-1 tracking-tight">{value}</div>
    </button>
  )
}

// ===== Empty State =====
export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <div className="p-12 text-center text-slate-400">
      {icon && <div className="flex justify-center mb-3 opacity-50">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ===== Loading State =====
export function LoadingState({ message = 'กำลังโหลด...' }: { message?: string }) {
  return <p className="p-6 text-center text-slate-500 text-sm">{message}</p>
}

// Re-export labels for convenience
export {
  ASSET_STATUS_LABELS, LOAN_STATUS_LABELS, GRADE_LABELS, ASSET_TYPE_LABELS,
  CATEGORY_LABELS, PURPOSE_LABELS,
}
