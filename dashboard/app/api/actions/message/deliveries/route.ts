import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapMessageDeliveryRow } from "@/lib/server/botMappers"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sp = new URLSearchParams()
  const guildId = searchParams.get("guildId")
  const textChannelId = searchParams.get("textChannelId")
  const status = searchParams.get("status")
  const limit = searchParams.get("limit")
  if (guildId) sp.set("guildId", guildId)
  if (textChannelId) sp.set("textChannelId", textChannelId)
  if (status) sp.set("status", status)
  if (limit) sp.set("limit", limit)
  const qs = sp.toString()
  const path = qs ? `/actions/message/deliveries?${qs}` : "/actions/message/deliveries"

  const result = await botGet<{ ok?: boolean; deliveries?: unknown[] }>(path)
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }
  const rows = Array.isArray(result.data?.deliveries) ? result.data.deliveries : []
  const data = rows
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(mapMessageDeliveryRow)

  return NextResponse.json({ ok: true, data })
}
