import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost(`/attendance/settings/checkpoints/${id}/update`, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Request failed", data: result.data ?? null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost(`/attendance/settings/checkpoints/${id}/delete`, body)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Request failed", data: result.data ?? null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}

