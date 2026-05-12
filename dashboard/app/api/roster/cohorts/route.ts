import { NextResponse } from "next/server"
import { botGet, botPost } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "guildId is required", data: null }, { status: 400 })
  }
  const result = await botGet(`/roster/cohorts?guildId=${encodeURIComponent(guildId)}`)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Bot API is offline", data: null }, { status: 503 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost("/roster/cohorts", body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Request failed", data: result.data ?? null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
