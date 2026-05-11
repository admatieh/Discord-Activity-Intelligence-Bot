import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface MetricCardProps {
  title: string
  value: React.ReactNode
  subtitle?: string
  icon?: LucideIcon
  iconClassName?: string
  variant?: "default" | "success" | "warning" | "danger" | "primary"
  className?: string
  action?: React.ReactNode
}

const variantStyles: Record<string, { icon: string; bg: string }> = {
  default: { icon: "text-muted-foreground bg-muted", bg: "" },
  success: { icon: "text-success bg-success-subtle", bg: "" },
  warning: { icon: "text-warning-foreground bg-warning-subtle", bg: "" },
  danger: { icon: "text-destructive bg-danger-subtle", bg: "" },
  primary: { icon: "text-primary bg-accent", bg: "" },
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
  action,
}: MetricCardProps) {
  const styles = variantStyles[variant] ?? variantStyles.default

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-semibold text-foreground leading-none">{value}</div>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  )
}
