import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(
  _request: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await context.params
  const result = await botGet<{ ok?: boolean; roles?: unknown[]; error?: string }>(
    `/discord/guilds/${guildId}/roles`
  )
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Could not load roles",
      details: result.details,
      data: [],
    })
  }
  const raw = Array.isArray(result.data?.roles) ? result.data.roles : []
  return NextResponse.json({ ok: true, data: raw })
}
