import { dashboardFetch } from "./client"
import type { Session } from "@/lib/types"

export function fetchSessions(limit?: number) {
  const q = limit ? `?limit=${limit}` : ""
  return dashboardFetch<Session[]>(`/api/sessions${q}`)
}

export function fetchActiveSessions() {
  return dashboardFetch<Session[]>("/api/sessions/active")
}

export function fetchSession(id: string) {
  return dashboardFetch<Session>(`/api/sessions/${id}`)
}
