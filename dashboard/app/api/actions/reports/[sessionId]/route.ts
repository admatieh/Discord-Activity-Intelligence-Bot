import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapReportDetail } from "@/lib/server/botMappers"

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params
  const result = await botGet<{ ok?: boolean; report?: Record<string, unknown>; error?: string }>(
    `/actions/reports/${sessionId}`
  )

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: null,
    })
  }

  const inner = result.data
  if (!inner?.ok || !inner.report) {
    return NextResponse.json({
      ok: false,
      error: typeof inner?.error === "string" ? inner.error : "No report generated yet",
      data: null,
    })
  }

  const detail = mapReportDetail(inner.report as Record<string, unknown>)
  return NextResponse.json({ ok: true, data: detail })
}
