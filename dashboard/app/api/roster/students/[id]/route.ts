import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost(`/roster/students/${encodeURIComponent(p.id)}`, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Request failed", data: result.data ?? null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
