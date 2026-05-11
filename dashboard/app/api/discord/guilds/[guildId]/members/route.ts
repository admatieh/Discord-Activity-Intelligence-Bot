import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapGuildMemberRow } from "@/lib/server/botMappers"

export async function GET(
  _request: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await context.params
  const result = await botGet<{ ok?: boolean; members?: unknown[]; error?: string }>(
    `/discord/guilds/${guildId}/members`
  )
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Could not load members",
      details: result.details,
      data: [],
    })
  }
  const raw = Array.isArray(result.data?.members) ? result.data.members : []
  const data = raw
    .filter((m): m is Record<string, unknown> => m !== null && typeof m === "object")
    .map((m) => {
      const row = { ...m, guildId }
      return mapGuildMemberRow(row)
    })
  return NextResponse.json({ ok: true, data })
}
