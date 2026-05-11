import { dashboardFetch } from "./client"
import type { ScheduledItem } from "@/lib/types"

export function fetchSchedule(params?: { type?: string; status?: string; guildId?: string }) {
  const sp = new URLSearchParams()
  if (params?.type) sp.set("type", params.type)
  if (params?.status) sp.set("status", params.status)
  if (params?.guildId) sp.set("guildId", params.guildId)
  const qs = sp.toString()
  return dashboardFetch<ScheduledItem[]>(qs ? `/api/actions/schedule?${qs}` : "/api/actions/schedule")
}

export function cancelScheduleItem(id: string) {
  return dashboardFetch<unknown>(`/api/actions/schedule/${id}/cancel`, { method: "POST" })
}

export function runScheduleItemNow(id: string) {
  return dashboardFetch<unknown>(`/api/actions/schedule/${id}/run-now`, { method: "POST" })
}
