import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"
import type { ApiResponse } from "./types"

// ─── Safe array ───────────────────────────────────────────────────────────────

export function safeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

// ─── Error message ────────────────────────────────────────────────────────────

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "An unexpected error occurred"
}

// ─── Date / time ─────────────────────────────────────────────────────────────

export function formatDateTime(
  value: string | number | Date | undefined | null
): string {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : new Date(value)
  if (!isValid(date)) return "—"
  return format(date, "MMM d, yyyy 'at' h:mm a")
}

export function formatDateShort(
  value: string | number | Date | undefined | null
): string {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : new Date(value)
  if (!isValid(date)) return "—"
  return format(date, "MMM d, yyyy")
}

export function formatTimeAgo(
  value: string | number | Date | undefined | null
): string {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : new Date(value)
  if (!isValid(date)) return "—"
  return formatDistanceToNow(date, { addSuffix: true })
}

export function formatTime(
  value: string | number | Date | undefined | null
): string {
  if (!value) return "—"
  const date = typeof value === "string" ? parseISO(value) : new Date(value)
  if (!isValid(date)) return "—"
  return format(date, "h:mm a")
}

// ─── Duration ─────────────────────────────────────────────────────────────────

export function formatDuration(minutes: number | undefined | null): string {
  if (minutes === undefined || minutes === null || isNaN(minutes)) return "—"
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatUptime(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return "—"
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function formatStatus(status: string | undefined | null): string {
  if (!status) return "Unknown"
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

// ─── API fetch helper (client-side) ──────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    })
    const json = (await res.json()) as ApiResponse<T> & Record<string, unknown>
    if (!res.ok && json.ok === undefined) {
      return {
        ok: false,
        error:
          (typeof json.error === "string" && json.error) ||
          `Request failed (${res.status})`,
        details: typeof json.details === "string" ? json.details : undefined,
        data: json.data as T | undefined,
      }
    }
    return json as ApiResponse<T>
  } catch (err) {
    return {
      ok: false,
      error: "Network error",
      details: getErrorMessage(err),
    }
  }
}

// ─── cn (re-export) ───────────────────────────────────────────────────────────
export { cn } from "./utils"
