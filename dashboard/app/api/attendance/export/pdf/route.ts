import { NextResponse } from "next/server"
import { botProxyGet } from "@/lib/server/botApi"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guildId = searchParams.get("guildId")
  const month = searchParams.get("month")
  const year = searchParams.get("year")
  if (!guildId || !month || !year) {
    return NextResponse.json(
      { ok: false, error: "guildId, month, and year are required" },
      { status: 400 }
    )
  }
  const sp = new URLSearchParams({ guildId, month, year })
  const cohortId = searchParams.get("cohortId")
  const courseName = searchParams.get("courseName")
  const dutyStationDefault = searchParams.get("dutyStationDefault")
  const includeIncomplete = searchParams.get("includeIncomplete")
  const includeAllRosterStudents = searchParams.get("includeAllRosterStudents")
  if (cohortId) sp.set("cohortId", cohortId)
  if (courseName) sp.set("courseName", courseName)
  if (dutyStationDefault) sp.set("dutyStationDefault", dutyStationDefault)
  if (includeIncomplete) sp.set("includeIncomplete", includeIncomplete)
  if (includeAllRosterStudents) sp.set("includeAllRosterStudents", includeAllRosterStudents)

  const res = await botProxyGet(`/attendance/export/pdf?${sp.toString()}`, { timeoutMs: 120_000 })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    return NextResponse.json(
      { ok: false, error: "PDF export failed", details: errText.slice(0, 500) },
      { status: res.status >= 400 ? res.status : 503 }
    )
  }
  const buf = await res.arrayBuffer()
  const cd = res.headers.get("content-disposition")
  const match = cd?.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? `attendance_${year}-${String(month).padStart(2, "0")}.pdf`
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
