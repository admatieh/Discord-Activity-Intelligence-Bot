import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const date = searchParams.get("date")
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "guildId is required", data: null }, { status: 400 })
  }
  const sp = new URLSearchParams({ guildId })
  if (date) sp.set("date", date)
  const result = await botGet(`/attendance/today?${sp.toString()}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

