import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const courseName = searchParams.get("courseName")
  if (!guildId || !startDate || !endDate) {
    return NextResponse.json(
      { ok: false, error: "guildId, startDate, and endDate are required", data: null },
      { status: 400 }
    )
  }
  const sp = new URLSearchParams({ guildId, startDate, endDate })
  if (courseName) sp.set("courseName", courseName)
  const result = await botGet(`/attendance/export?${sp.toString()}`, { timeoutMs: 30_000 })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

