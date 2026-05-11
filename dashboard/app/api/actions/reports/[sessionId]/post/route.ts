import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const forward = {
    requestedBy: body.requestedBy ?? "dashboard",
    textChannelId: body.textChannelId ?? body.channelId,
  }
  const result = await botPost(`/actions/reports/${sessionId}/post`, forward)
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
