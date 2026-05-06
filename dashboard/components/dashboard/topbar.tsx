'use client'

import { Bell, RefreshCw, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface TopbarProps {
  title: string
  subtitle?: string
  badge?: string
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary'
  actions?: React.ReactNode
}

export function Topbar({ title, subtitle, badge, badgeVariant = 'default', actions }: TopbarProps) {
  const [time, setTime] = useState<string>('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-11 flex items-center justify-between px-5 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          {badge && (
            <Badge variant={badgeVariant} className="text-[10px] font-mono px-1.5 py-0 h-4">
              {badge}
            </Badge>
          )}
        </div>
        {subtitle && (
          <>
            <span className="text-border">|</span>
            <span className="text-xs font-mono text-muted-foreground truncate">{subtitle}</span>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded border border-border">
          <Clock className="w-2.5 h-2.5" />
          <span>{time || '00:00:00'}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  )
}
