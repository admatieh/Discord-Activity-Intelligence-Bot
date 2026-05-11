import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const opts = body.options && typeof body.options === "object"
    ? (body.options as Record<string, unknown>)
    : {}

  const forward = {
    guildId: body.guildId,
    voiceChannelId: body.voiceChannelId,
    textChannelId: body.textChannelId,
    title: body.title ?? body.sessionName,
    durationMinutes: body.durationMinutes,
    tracking: body.tracking,
    options: body.options,
    requestedBy: body.requestedBy ?? "dashboard",
    source: body.source ?? "dashboard",
    sendDiscordAnnouncement:
      Boolean(body.sendDiscordAnnouncement) || Boolean(opts.sendAnnouncement),
  }

  const result = await botPost("/actions/session/start", forward)
  const inner = result.data && typeof result.data === "object"
    ? (result.data as { ok?: boolean; error?: string })
    : null
  const logicalOk = result.ok && inner?.ok !== false
  return NextResponse.json(
    {
      ok: logicalOk,
      data: result.data,
      error: logicalOk ? undefined : inner?.error ?? result.error,
      details: result.details,
    },
    { status: logicalOk ? 200 : 400 }
  )
}
