'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Terminal,
  Layers,
  Radio,
  FileText,
  Users,
  Cpu,
  ChevronRight,
  Bot,
  Activity,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Observability',
    items: [
      { label: 'Overview', href: '/', icon: LayoutDashboard },
      { label: 'Live Sessions', href: '/sessions', icon: Radio },
      { label: 'User Analytics', href: '/users', icon: Users },
      { label: 'Logs', href: '/logs', icon: FileText },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Command Terminal', href: '/terminal', icon: Terminal },
      { label: 'Command Explorer', href: '/commands', icon: Layers },
      { label: 'System Control', href: '/control', icon: Cpu },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 flex flex-col bg-sidebar border-r border-sidebar-border z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-7 h-7 rounded bg-primary/10 border border-primary/20">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-xs font-semibold text-foreground tracking-tight">DiscordOps</span>
          <span className="text-[10px] text-muted-foreground font-mono">control-plane v2.4</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-sidebar-border bg-sidebar-accent/30">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-online" />
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">BOT ONLINE</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          <Activity className="w-2.5 h-2.5 inline mr-1 text-status-online" />
          1 active
        </span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 terminal-scroll">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <div className="px-4 py-1.5">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 uppercase tracking-widest">
                {group.label}
              </span>
            </div>
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-sm transition-colors group',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground')} />
                      <span className="font-mono text-xs">{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary/60" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="text-[10px] font-mono text-muted-foreground/50 space-y-0.5">
          <div className="flex justify-between">
            <span>uptime</span>
            <span className="text-muted-foreground">14d 6h 22m</span>
          </div>
          <div className="flex justify-between">
            <span>guild</span>
            <span className="text-muted-foreground">DevOps Guild</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
