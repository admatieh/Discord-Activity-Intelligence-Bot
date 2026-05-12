import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const cohortId = searchParams.get("cohortId")
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "guildId is required", data: null }, { status: 400 })
  }
  const sp = new URLSearchParams({ guildId })
  if (cohortId) sp.set("cohortId", cohortId)
  const result = await botGet(`/roster/export?${sp.toString()}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
