import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET(
  _request: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await context.params
  const result = await botGet<{ ok?: boolean; channels?: unknown[]; error?: string }>(
    `/discord/guilds/${guildId}/text-channels`
  )
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Could not load text channels",
      details: result.details,
      data: [],
    })
  }
  const channels = Array.isArray(result.data?.channels) ? result.data.channels : []
  return NextResponse.json({ ok: true, data: channels })
}
