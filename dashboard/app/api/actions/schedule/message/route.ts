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

  const forward = {
    guildId: body.guildId,
    textChannelId: body.textChannelId ?? body.channelId,
    content: body.content,
    scheduledFor,
    createdBy: body.requestedBy ?? body.createdBy ?? "dashboard",
  }

  const result = await botPost("/actions/schedule/message", forward)
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
