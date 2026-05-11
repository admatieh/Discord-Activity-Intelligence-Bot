import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapScheduledRow } from "@/lib/server/botMappers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sp = new URLSearchParams()
  const type = searchParams.get("type")
  const status = searchParams.get("status")
  const guildId = searchParams.get("guildId")
  const limit = searchParams.get("limit")
  if (type) sp.set("type", type)
  if (status) sp.set("status", status)
  if (guildId) sp.set("guildId", guildId)
  if (limit) sp.set("limit", limit)
  const qs = sp.toString()
  const path = qs ? `/actions/schedule?${qs}` : "/actions/schedule"

  const result = await botGet<{ ok?: boolean; items?: unknown[] }>(path)

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }

  const items = Array.isArray(result.data?.items) ? result.data.items : []
  const data = items
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(mapScheduledRow)

  return NextResponse.json({ ok: true, data })
}
