import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
  iconColor?: string
  mono?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  trend,
  icon: Icon,
  iconColor,
  mono,
  className,
  size = 'md',
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded p-3.5 flex flex-col gap-2',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && (
          <Icon className={cn('w-3.5 h-3.5', iconColor ?? 'text-muted-foreground')} />
        )}
      </div>

      <div className={cn('flex items-end gap-1.5', size === 'sm' && 'items-baseline')}>
        <span
          className={cn(
            'font-semibold leading-none',
            size === 'md' ? 'text-2xl' : 'text-lg',
            mono && 'font-mono'
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground font-mono mb-0.5">{unit}</span>
        )}
      </div>

      {(delta || trend) && (
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-status-online" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-status-error" />}
          {trend === 'neutral' && <Minus className="w-3 h-3 text-muted-foreground" />}
          {delta && (
            <span
              className={cn(
                'text-[10px] font-mono',
                trend === 'up' && 'text-status-online',
                trend === 'down' && 'text-status-error',
                trend === 'neutral' && 'text-muted-foreground'
              )}
            >
              {delta}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
