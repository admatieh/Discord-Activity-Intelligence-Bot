'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Radio,
  Calendar,
  MessageSquare,
  BarChart,
  Users,
  Activity,
  Settings,
  ChevronRight,
  BookOpen,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { label: 'Home', href: '/', icon: Home },
      { label: 'Record Session', href: '/record', icon: Radio },
      { label: 'Scheduled', href: '/scheduled', icon: Calendar },
      { label: 'Messages', href: '/messages', icon: MessageSquare },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart },
      { label: 'Participants', href: '/participants', icon: Users },
      { label: 'Activity Feed', href: '/activity', icon: Activity },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Advanced Tools', href: '/advanced', icon: Settings },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col bg-sidebar border-r border-sidebar-border z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shadow-sm">
          <BookOpen className="w-5 h-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-foreground tracking-tight">Instructor Workspace</span>
          <span className="text-[11px] text-muted-foreground">Activity Intelligence</span>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-sidebar-border bg-sidebar-accent/50">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-online opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-status-online" />
          </span>
          <span className="text-xs font-medium text-foreground">System Online</span>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full border border-border">
          Ready
        </span>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 terminal-scroll">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6">
            <div className="px-5 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.label}
              </span>
            </div>
            <ul className="space-y-1 px-3">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all group',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-sidebar-foreground')} />
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary-foreground/70" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-4 bg-sidebar-accent/30">
        <div className="text-[11px] text-muted-foreground space-y-1.5">
          <div className="flex justify-between items-center">
            <span>Primary Guild</span>
            <span className="font-medium text-foreground">Study Group</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
