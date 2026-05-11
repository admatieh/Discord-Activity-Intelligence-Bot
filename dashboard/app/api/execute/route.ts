import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const forward = {
    command: body.command,
    args: body.args,
    requestId: body.requestId,
    guildId: body.guildId,
    channelId: body.channelId ?? body.textChannelId ?? body.voiceChannelId,
  }
  const result = await botPost("/execute", forward)
  const inner = result.data && typeof result.data === "object"
    ? (result.data as { success?: boolean; error?: string | null })
    : null
  const logicalOk = result.ok && (inner?.success !== false)
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
