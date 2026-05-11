import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET() {
  const result = await botGet<{ ok?: boolean; guilds?: unknown[]; error?: string }>(
    "/discord/guilds"
  )
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      details: result.details,
      data: [],
    })
  }
  const payload = result.data
  const guilds = Array.isArray(payload?.guilds) ? payload.guilds : []
  return NextResponse.json({ ok: true, data: guilds })
}
