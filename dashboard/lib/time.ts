import { format, formatDistanceToNow, isValid, parseISO } from "date-fns"

export function isDateOnlyString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function parseApiDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === "number") return new Date(value)
  
  if (typeof value === "string") {
    // Attendance dates: parse as local midnight
    if (isDateOnlyString(value)) {
      const d = new Date(value + "T00:00:00")
      return isNaN(d.getTime()) ? null : d
    }

    // SQLite UTC datetime without Z: YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
      const d = new Date(value.replace(" ", "T") + "Z")
      return isNaN(d.getTime()) ? null : d
    }

    // ISO string or other formats
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d

    // Fallback to date-fns parseISO
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }
  
  return null
}

export function formatDateTime(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return "—"
  return format(d, "MMM d, yyyy 'at' h:mm a")
}

export function formatDateShort(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return "—"
  return format(d, "MMM d, yyyy")
}

export function formatTimeAgo(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return "—"
  return formatDistanceToNow(d, { addSuffix: true })
}

export const formatRelativeTime = formatTimeAgo // Alias requested by user

export function formatTime(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return "—"
  return format(d, "h:mm a")
}

export function formatElapsedSince(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return "—"
  
  const now = new Date()
  let diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) diffMs = 0
  
  const totalSeconds = Math.floor(diffMs / 1000)
  if (totalSeconds < 60) {
    return `< 1m`
  }
  
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

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

export function toLocalDateInputValue(value: string | number | Date | undefined | null): string {
  const d = parseApiDate(value)
  if (!d) return ""
  
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function localDateTimeToUtcIso(localDateTimeStr: string): string {
  if (!localDateTimeStr) return ""
  const d = new Date(localDateTimeStr)
  if (isNaN(d.getTime())) return ""
  return d.toISOString()
}
