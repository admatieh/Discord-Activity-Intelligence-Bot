/** DB-shaped roster row (snake_case) as returned by bot / students API */

export type RosterStudentRow = {
  id: number
  full_name: string
  preferred_name?: string | null
  email?: string | null
  discord_user_id?: string | null
  discord_username?: string | null
  duty_station?: string | null
  student_code?: string | null
  active?: number
  source?: string | null
  synced_from_discord?: number | null
  last_synced_at?: string | null
}

/**
 * Normalize roster student list from various API / proxy response shapes.
 * Never throws; returns [] if nothing parseable.
 */
export function extractRosterStudentsFromResponse(payload: unknown): RosterStudentRow[] {
  if (payload == null) return []
  if (Array.isArray(payload)) return payload as RosterStudentRow[]
  if (typeof payload !== "object") return []
  const o = payload as Record<string, unknown>
  if (Array.isArray(o.students)) return o.students as RosterStudentRow[]
  if (Array.isArray(o.data)) return o.data as RosterStudentRow[]
  if (o.data != null && typeof o.data === "object") {
    const inner = o.data as Record<string, unknown>
    if (Array.isArray(inner.students)) return inner.students as RosterStudentRow[]
    if (Array.isArray(inner.data)) return inner.data as RosterStudentRow[]
  }
  return []
}

export function extractRosterStudentsFromApiResponse(res: {
  ok?: boolean
  data?: unknown
  students?: unknown
}): RosterStudentRow[] {
  if (!res || res.ok === false) return []
  const fromData = extractRosterStudentsFromResponse(res.data ?? null)
  if (fromData.length) return fromData
  return extractRosterStudentsFromResponse(res as unknown)
}

export function rosterStudentAttendanceKey(s: RosterStudentRow): string {
  const d = s.discord_user_id != null && String(s.discord_user_id).trim() !== ""
  if (d) return String(s.discord_user_id).trim()
  return `student:${s.id}`
}

export function rosterStudentSearchHaystack(s: RosterStudentRow): string {
  return [
    s.full_name,
    s.preferred_name,
    s.discord_username,
    s.discord_user_id,
    s.student_code,
    s.email,
    String(s.id),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}
