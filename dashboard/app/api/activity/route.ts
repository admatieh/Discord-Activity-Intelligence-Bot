import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapActivityFeedEntry } from "@/lib/server/botMappers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sp = new URLSearchParams()
  const limit = searchParams.get("limit")
  const guildId = searchParams.get("guildId")
  const sessionId = searchParams.get("sessionId")
  const type = searchParams.get("type")
  if (limit) sp.set("limit", limit)
  if (guildId) sp.set("guildId", guildId)
  if (sessionId) sp.set("sessionId", sessionId)
  if (type) sp.set("type", type)
  const qs = sp.toString()
  const path = qs ? `/activity?${qs}` : "/activity"

  const result = await botGet<{ ok?: boolean; feed?: unknown[] }>(path)
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }
  const feed = Array.isArray(result.data?.feed) ? result.data.feed : []
  const data = feed
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(mapActivityFeedEntry)

  return NextResponse.json({ ok: true, data })
}
