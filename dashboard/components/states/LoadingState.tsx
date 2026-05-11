import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingStateProps {
  message?: string
  className?: string
  size?: "sm" | "md" | "lg"
}

export default function LoadingState({
  message = "Loading…",
  className,
  size = "md",
}: LoadingStateProps) {
  const iconSize =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-8 w-8" : "h-6 w-6"

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12",
        className
      )}
    >
      <Loader2 className={cn("animate-spin text-muted-foreground", iconSize)} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// Skeleton pulse for card-level loading
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-7 w-16 rounded bg-muted" />
        <div className="h-3 w-32 rounded bg-muted" />
      </div>
    </div>
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3",
        className
      )}
    >
      <div className="animate-pulse flex items-center gap-4 w-full">
        <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
        </div>
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
    </div>
  )
}
