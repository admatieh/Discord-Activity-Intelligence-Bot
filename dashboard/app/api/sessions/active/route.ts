import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapSessionRow } from "@/lib/server/botMappers"

export async function GET() {
  const result = await botGet<{ ok?: boolean; sessions?: unknown[] }>("/sessions/active")
  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      data: [],
    })
  }
  const rows = Array.isArray(result.data?.sessions) ? result.data.sessions : []
  const data = rows
    .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
    .map(mapSessionRow)
  return NextResponse.json({ ok: true, data })
}
