import { dashboardFetch } from "./client"
import type { MessageDelivery } from "@/lib/types"

export function fetchDeliveries(params?: { guildId?: string; limit?: number }) {
  const sp = new URLSearchParams()
  if (params?.guildId) sp.set("guildId", params.guildId)
  if (params?.limit) sp.set("limit", String(params.limit))
  const qs = sp.toString()
  return dashboardFetch<MessageDelivery[]>(
    qs ? `/api/actions/message/deliveries?${qs}` : "/api/actions/message/deliveries"
  )
}
