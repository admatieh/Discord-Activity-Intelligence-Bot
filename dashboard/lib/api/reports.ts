import { dashboardFetch } from "./client"
import type { Report, ReportDetail } from "@/lib/types"

export function fetchReports(params?: { guildId?: string; limit?: number }) {
  const sp = new URLSearchParams()
  if (params?.guildId) sp.set("guildId", params.guildId)
  if (params?.limit) sp.set("limit", String(params.limit))
  const qs = sp.toString()
  return dashboardFetch<Report[]>(qs ? `/api/actions/reports?${qs}` : "/api/actions/reports")
}

export function fetchReportDetail(sessionId: string) {
  return dashboardFetch<ReportDetail>(`/api/actions/reports/${sessionId}`)
}
