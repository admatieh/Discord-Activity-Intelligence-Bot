import { AlertCircle, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorPanelProps {
  title?: string
  message?: string
  details?: string
  offline?: boolean
  className?: string
  action?: React.ReactNode
}

export default function ErrorPanel({
  title,
  message,
  details,
  offline = false,
  className,
  action,
}: ErrorPanelProps) {
  const Icon = offline ? WifiOff : AlertCircle
  const defaultTitle = offline ? "Bot API is offline" : "Something went wrong"
  const defaultMessage = offline
    ? "The bot is not responding. Stored data may still be available."
    : "Could not load this data. Please try again."

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/20 bg-danger-subtle px-4 py-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">
            {title ?? defaultTitle}
          </p>
          <p className="mt-0.5 text-sm text-destructive/80">
            {message ?? defaultMessage}
          </p>
          {details && (
            <p className="mt-1 text-xs text-destructive/60 font-mono break-all">
              {details}
            </p>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}
