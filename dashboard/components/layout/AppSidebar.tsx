"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Radio,
  Calendar,
  MessageSquare,
  FileText,
  Users,
  Activity,
  Terminal,
  BookOpen,
  Server,
  ScrollText,
  Settings,
  ChevronDown,
  ChevronRight,
  Bot,
  Database,
  LifeBuoy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { useBotStatus } from "@/hooks/use-bot-status"
import { GuildSelector } from "@/components/layout/GuildSelector"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const workspaceNav: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Record Session", href: "/record", icon: Radio },
  { label: "Scheduled", href: "/scheduled", icon: Calendar },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Participants", href: "/participants", icon: Users },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Setup Guide", href: "/setup", icon: LifeBuoy },
]

const advancedNav: NavItem[] = [
  { label: "Command Terminal", href: "/advanced/terminal", icon: Terminal },
  { label: "Command Explorer", href: "/advanced/commands", icon: BookOpen },
  { label: "System Health", href: "/advanced/system", icon: Server },
  { label: "Technical Logs", href: "/advanced/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const [advancedOpen, setAdvancedOpen] = useState(
    advancedNav.some((item) => pathname.startsWith(item.href))
  )
  const { status } = useBotStatus()

  return (
    <aside className={cn("flex h-full w-60 shrink-0 flex-col border-r border-border bg-sidebar", className)}>
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-tight">
            Instructor
          </p>
          <p className="text-xs text-muted-foreground leading-tight">
            Workspace
          </p>
        </div>
      </div>

      <GuildSelector />

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        <div>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <ul className="space-y-0.5">
            {workspaceNav.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-primary font-medium"
                        : "text-sidebar-foreground hover:bg-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="mb-1.5 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Advanced</span>
            {advancedOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
          {advancedOpen && (
            <ul className="space-y-0.5">
              {advancedNav.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        isActive
                          ? "bg-accent text-primary font-medium"
                          : "text-sidebar-foreground hover:bg-accent/50"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span>Bot:</span>
          <StatusDot status={status.bot} />
          <span
            className={cn(
              status.bot === "online"
                ? "text-success"
                : status.bot === "offline"
                  ? "text-destructive"
                  : "text-warning"
            )}
          >
            {status.bot === "online"
              ? "Online"
              : status.bot === "offline"
                ? "Offline"
                : "Checking…"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span>Database:</span>
          <StatusDot status={status.db} />
          <span
            className={cn(
              status.db === "connected"
                ? "text-success"
                : status.db === "disconnected"
                  ? "text-destructive"
                  : "text-warning"
            )}
          >
            {status.db === "connected"
              ? "Connected"
              : status.db === "disconnected"
                ? "Disconnected"
                : "Checking…"}
          </span>
        </div>
      </div>
    </aside>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        status === "online" || status === "connected"
          ? "bg-success"
          : status === "offline" || status === "disconnected"
            ? "bg-destructive"
            : "bg-warning animate-pulse"
      )}
    />
  )
}
