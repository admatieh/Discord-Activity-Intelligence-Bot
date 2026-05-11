import { cn } from "@/lib/utils"

type StatusVariant =
  | "active"
  | "online"
  | "connected"
  | "success"
  | "ended"
  | "completed"
  | "scheduled"
  | "failed"
  | "cancelled"
  | "offline"
  | "disconnected"
  | "warning"
  | "pending"
  | "running"
  | "info"
  | "session"
  | "message"
  | string

const variantMap: Record<string, string> = {
  active: "bg-success-subtle text-success border-success/20",
  online: "bg-success-subtle text-success border-success/20",
  connected: "bg-success-subtle text-success border-success/20",
  success: "bg-success-subtle text-success border-success/20",
  ended: "bg-muted text-muted-foreground border-border",
  completed: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-accent text-primary border-primary/20",
  running: "bg-accent text-primary border-primary/20",
  pending: "bg-warning-subtle text-warning-foreground border-warning/20",
  warning: "bg-warning-subtle text-warning-foreground border-warning/20",
  failed: "bg-danger-subtle text-destructive border-destructive/20",
  cancelled: "bg-muted text-muted-foreground border-border",
  offline: "bg-danger-subtle text-destructive border-destructive/20",
  disconnected: "bg-danger-subtle text-destructive border-destructive/20",
  session: "bg-accent text-primary border-primary/20",
  message: "bg-secondary text-secondary-foreground border-border",
  info: "bg-muted text-muted-foreground border-border",
}

interface StatusBadgeProps {
  status: StatusVariant
  label?: string
  dot?: boolean
  className?: string
}

export default function StatusBadge({ status, label, dot = false, className }: StatusBadgeProps) {
  const styles = variantMap[status.toLowerCase()] ?? "bg-muted text-muted-foreground border-border"
  const displayLabel = label ?? capitalize(status)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        styles,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            status === "active" || status === "online" || status === "connected" || status === "success"
              ? "bg-success"
              : status === "failed" || status === "offline" || status === "disconnected"
              ? "bg-destructive"
              : status === "scheduled" || status === "running"
              ? "bg-primary"
              : "bg-muted-foreground"
          )}
        />
      )}
      {displayLabel}
    </span>
  )
}

function capitalize(str: string): string {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1)
}
