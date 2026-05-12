import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const result = await botPost("/roster/import", body, { timeoutMs: 30_000 })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "Import failed", data: result.data ?? null }, { status: 400 })
  }
  return NextResponse.json({ ok: true, data: result.data })
}
