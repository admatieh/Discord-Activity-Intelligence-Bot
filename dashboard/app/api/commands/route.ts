import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"

export async function GET() {
  const result = await botGet<{ success?: boolean; data?: unknown[] }>("/commands")
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }
  const inner = result.data
  const list = Array.isArray(inner?.data) ? inner.data : []
  return NextResponse.json({ ok: true, data: list })
}
