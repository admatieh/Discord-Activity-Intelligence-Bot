import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapScheduledRow } from "@/lib/server/botMappers"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const result = await botGet<{ ok?: boolean; item?: Record<string, unknown>; error?: string }>(
    `/actions/schedule/${id}`
  )
  if (!result.ok || !result.data?.item) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Scheduled item not found",
      data: null,
    }, { status: result.ok ? 404 : 502 })
  }
  return NextResponse.json({
    ok: true,
    data: mapScheduledRow(result.data.item),
  })
}
