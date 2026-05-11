import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapGuildMemberRow } from "@/lib/server/botMappers"

/**
 * Dashboard participants: live Discord guild members (no separate /api/users on bot).
 * Query: ?guildId= required for member list.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")

  if (!guildId) {
    return NextResponse.json({
      ok: true,
      data: [],
      meta: {
        source: "none",
        message: "Select a server to load members.",
      },
    })
  }

  const result = await botGet<{ ok?: boolean; members?: unknown[]; error?: string }>(
    `/discord/guilds/${guildId}/members`
  )

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Could not load members",
      data: [],
    })
  }

  const raw = Array.isArray(result.data?.members) ? result.data.members : []
  const data = raw
    .filter((m): m is Record<string, unknown> => m !== null && typeof m === "object")
    .map((m) => mapGuildMemberRow({ ...m, guildId }))

  return NextResponse.json({
    ok: true,
    data,
    meta: {
      source: "discord_live",
      guildId,
    },
  })
}
