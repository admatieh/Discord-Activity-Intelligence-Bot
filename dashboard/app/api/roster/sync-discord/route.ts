import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const { guildId, cohortId, mode, syncedBy } = body
  if (!guildId) {
    return NextResponse.json({ ok: false, error: "guildId is required" }, { status: 400 })
  }
  const result = await botPost("/roster/sync-discord", {
    guildId,
    cohortId: cohortId ?? null,
    mode: mode ?? "append",
    syncedBy: syncedBy ?? "dashboard",
  }, { timeoutMs: 30_000 })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Sync failed", data: result.data ?? null },
      { status: 400 }
    )
  }
  return NextResponse.json({ ok: true, data: result.data })
}
