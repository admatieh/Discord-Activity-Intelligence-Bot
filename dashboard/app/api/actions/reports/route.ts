import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapReportListRow } from "@/lib/server/botMappers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sp = new URLSearchParams()
  const guildId = searchParams.get("guildId")
  const limit = searchParams.get("limit")
  if (guildId) sp.set("guildId", guildId)
  if (limit) sp.set("limit", limit)
  const qs = sp.toString()
  const path = qs ? `/actions/reports?${qs}` : "/actions/reports"

  const result = await botGet<{ ok?: boolean; reports?: unknown[] }>(path)
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }
  const rows = Array.isArray(result.data?.reports) ? result.data.reports : []
  const data = rows
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(mapReportListRow)

  return NextResponse.json({ ok: true, data })
}
