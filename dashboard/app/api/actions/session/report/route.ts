import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const sid = body.sessionId
  const forward = {
    sessionId: typeof sid === "string" ? Number(sid) || sid : sid,
    requestedBy: body.requestedBy ?? "dashboard",
    postToChannelId: body.postToChannelId ?? body.textChannelId ?? null,
  }
  const result = await botPost("/actions/session/report", forward)
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
