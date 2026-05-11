import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const payload = {
    guildId: body.guildId,
    voiceChannelId: body.voiceChannelId,
    textChannelId: body.textChannelId,
    title: body.title,
    daysOfWeek: body.daysOfWeek,
    time: body.time,
    timezone: body.timezone ?? "Asia/Beirut",
    durationMinutes: body.durationMinutes,
    tracking: body.tracking,
    options: body.options,
    requestedBy: body.requestedBy ?? "dashboard",
    createdBy: body.createdBy ?? "dashboard",
  }

  const result = await botPost("/actions/schedule/recurring-session", payload)
  const inner = result.data && typeof result.data === "object"
    ? (result.data as { ok?: boolean; error?: string; message?: string })
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
