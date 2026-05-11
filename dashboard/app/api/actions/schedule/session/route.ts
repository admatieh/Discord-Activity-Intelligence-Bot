import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const scheduledFor =
    typeof body.scheduledFor === "string"
      ? body.scheduledFor
      : typeof body.scheduledAt === "string"
        ? body.scheduledAt
        : undefined

  const payload = {
    guildId: body.guildId,
    voiceChannelId: body.voiceChannelId,
    textChannelId: body.textChannelId,
    title: body.title ?? body.sessionName,
    scheduledFor,
    durationMinutes: body.durationMinutes,
    requestedBy: body.requestedBy ?? "dashboard",
    payload: {
      tracking: body.tracking,
      options: body.options,
      sendDiscordAnnouncement:
        body.sendDiscordAnnouncement ??
        (body.options &&
        typeof body.options === "object" &&
        (body.options as { sendAnnouncement?: boolean }).sendAnnouncement),
    },
  }

  const result = await botPost("/actions/schedule/session", payload)
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
