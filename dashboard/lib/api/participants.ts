import { dashboardFetch } from "./client"
import type { Participant } from "@/lib/types"

export function fetchParticipants(guildId: string) {
  return dashboardFetch<Participant[]>(`/api/participants?guildId=${encodeURIComponent(guildId)}`)
}
