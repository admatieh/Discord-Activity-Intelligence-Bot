import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const weekStart = searchParams.get("weekStart")
  const weekEnd = searchParams.get("weekEnd")
  if (!guildId || !weekStart || !weekEnd) {
    return NextResponse.json(
      { ok: false, error: "guildId, weekStart, and weekEnd are required", data: null },
      { status: 400 }
    )
  }
  const sp = new URLSearchParams({ guildId, weekStart, weekEnd })
  const result = await botGet(`/attendance/week?${sp.toString()}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

