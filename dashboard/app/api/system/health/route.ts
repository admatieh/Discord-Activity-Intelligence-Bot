import { NextResponse } from "next/server"
import { botGet } from "@/lib/server/botApi"
import { mapDatabaseStatus, mapSystemHealth } from "@/lib/server/botMappers"

export async function GET() {
  const [healthRes, dbRes] = await Promise.all([
    botGet<Record<string, unknown>>("/health"),
    botGet<Record<string, unknown>>("/system/database"),
  ])

  const healthRaw =
    healthRes.ok && healthRes.data && typeof healthRes.data === "object"
      ? (healthRes.data as Record<string, unknown>)
      : null

  const dbRaw =
    dbRes.ok && dbRes.data && typeof dbRes.data === "object"
      ? (dbRes.data as Record<string, unknown>)
      : null

  const health = mapSystemHealth(healthRaw)
  const database = mapDatabaseStatus(dbRaw)

  const ok = healthRes.ok

  return NextResponse.json({
    ok,
    data: { health, database },
    error: ok ? undefined : healthRes.error ?? "Bot API is offline",
  })
}
