import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost(`/attendance/settings/checkpoints/${id}/deactivate`, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Request failed", data: null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
