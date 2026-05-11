import { dashboardFetch } from "./client"
import type { DatabaseStatus, SystemHealth } from "@/lib/types"

export function fetchHealth() {
  return dashboardFetch<{ health: SystemHealth | null; database: DatabaseStatus | null }>(
    "/api/system/health"
  )
}

export function fetchDatabase() {
  return dashboardFetch<DatabaseStatus | null>("/api/system/database")
}
