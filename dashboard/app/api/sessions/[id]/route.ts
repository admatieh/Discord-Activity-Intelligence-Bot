import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapSessionRow } from "@/lib/server/botMappers"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const result = await botGet<{ ok?: boolean; session?: Record<string, unknown>; error?: string }>(
    `/sessions/${id}`
  )
  if (!result.ok || !result.data?.session) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Session not found",
      data: null,
    }, { status: result.ok ? 404 : 502 })
  }
  return NextResponse.json({
    ok: true,
    data: mapSessionRow(result.data.session),
  })
}
