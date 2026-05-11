import { dashboardFetch } from "./client"
import type { ActivityEvent } from "@/lib/types"

export function fetchActivity(params?: { limit?: number; type?: string }) {
  const sp = new URLSearchParams()
  if (params?.limit) sp.set("limit", String(params.limit))
  if (params?.type) sp.set("type", params.type)
  const qs = sp.toString()
  return dashboardFetch<ActivityEvent[]>(qs ? `/api/activity?${qs}` : "/api/activity")
}
