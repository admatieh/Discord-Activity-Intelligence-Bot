import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapDatabaseStatus } from "@/lib/server/botMappers"

export async function GET() {
  const result = await botGet<Record<string, unknown>>("/system/database")
  if (!result.ok || !result.data || typeof result.data !== "object") {
    return NextResponse.json({
      ok: false,
      error: result.error ?? "Bot API is offline",
      details: result.details,
      data: null,
    })
  }
  return NextResponse.json({
    ok: true,
    data: mapDatabaseStatus(result.data as Record<string, unknown>),
  })
}
