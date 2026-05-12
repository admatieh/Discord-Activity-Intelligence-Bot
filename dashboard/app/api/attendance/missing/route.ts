import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const date = searchParams.get("date")
  if (!guildId || !date) {
    return NextResponse.json(
      { ok: false, error: "guildId and date are required", data: null },
      { status: 400 }
    )
  }
  const sp = new URLSearchParams({ guildId, date })
  const result = await botGet(`/attendance/missing?${sp.toString()}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

