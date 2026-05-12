import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const month = searchParams.get("month")
  const year = searchParams.get("year")
  if (!guildId || !month || !year) {
    return NextResponse.json(
      { ok: false, error: "guildId, month, and year are required", data: null },
      { status: 400 }
    )
  }
  const sp = new URLSearchParams({ guildId, month, year })
  const result = await botGet(`/attendance/month?${sp.toString()}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

