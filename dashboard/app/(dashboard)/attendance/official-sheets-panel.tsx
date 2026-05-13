"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiFetch, safeArray } from "@/lib/helpers"
import { Download } from "lucide-react"

type Cohort = { id: number; name: string; active: number; course_name?: string | null }

type SheetGroup = {
  student: { userId: string; fullName: string; dutyStation: string }
  rows: Array<{ date: string; dayLabel: string; dutyStation: string; status: string; signatureText: string }>
}

export function OfficialSheetsPanel({
  guildId,
  cohorts,
  selectedCohortId,
  onCohortChange,
  refreshNonce = 0,
}: {
  guildId: string
  cohorts: Cohort[]
  selectedCohortId: string
  onCohortChange: (v: string) => void
  /** Increment after attendance corrections so preview/exportability state reloads. */
  refreshNonce?: number
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [courseName, setCourseName] = useState("")
  const [dutyStation, setDutyStation] = useState("Remote")
  const [includeIncomplete, setIncludeIncomplete] = useState(false)
  const [includeAllRosterStudents, setIncludeAllRosterStudents] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<SheetGroup[]>([])
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    const c = cohorts.find((x) => String(x.id) === selectedCohortId)
    if (c?.course_name) setCourseName(c.course_name)
    else if (c?.name) setCourseName(c.name)
  }, [cohorts, selectedCohortId])

  const preview = useCallback(async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    const [y, m] = month.split("-").map(Number)
    const cohortQ = selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""
    const res = await apiFetch<{
      groups?: SheetGroup[]
      warning?: string | null
    }>(
      `/api/attendance/official-sheet?guildId=${encodeURIComponent(guildId)}&month=${m}&year=${y}${cohortQ}&dutyStationDefault=${encodeURIComponent(dutyStation)}&includeIncomplete=${includeIncomplete ? "true" : "false"}&includeAllRosterStudents=${includeAllRosterStudents ? "true" : "false"}`
    )
    setLoading(false)
    if (!res.ok) {
      setError(res.error ?? "Preview failed")
      setGroups([])
      return
    }
    const data = res.data as { groups?: SheetGroup[]; warning?: string | null }
    setGroups(safeArray<SheetGroup>(data?.groups))
    setWarning(data?.warning || null)
  }, [guildId, month, selectedCohortId, dutyStation, includeIncomplete, includeAllRosterStudents])

  useEffect(() => {
    if (!refreshNonce) return
    void preview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: bump refreshNonce to re-fetch preview only
  }, [refreshNonce])

  async function downloadPdf() {
    if (!guildId) return
    const [y, m] = month.split("-").map(Number)
    const cohortQ = selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""
    const cn = encodeURIComponent(courseName || "export")
    const url = `/api/attendance/export/pdf?guildId=${encodeURIComponent(guildId)}&month=${m}&year=${y}${cohortQ}&courseName=${cn}&dutyStationDefault=${encodeURIComponent(dutyStation)}&includeIncomplete=${includeIncomplete ? "true" : "false"}&includeAllRosterStudents=${includeAllRosterStudents ? "true" : "false"}`
    window.location.href = url
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <p className="text-sm text-muted-foreground">
          Official sheets only include completed attendance days. Partial check-ins remain visible in Today / Needs
          Attention but are not exported unless manually approved. Students must complete all required checkpoints for
          the day to be counted as complete.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Course name</label>
            <Input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="FS-DH / …" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Month</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cohort</label>
            <Select value={selectedCohortId} onValueChange={onCohortChange}>
              <SelectTrigger>
                <SelectValue placeholder="Cohort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cohorts</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Default duty station</label>
            <Input value={dutyStation} onChange={(e) => setDutyStation(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeAllRosterStudents} onCheckedChange={(v) => setIncludeAllRosterStudents(v === true)} />
            Include all roster students (blank rows if no official days)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeIncomplete} onCheckedChange={(v) => setIncludeIncomplete(v === true)} />
            Include incomplete records in review appendix (PDF)
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void preview()} disabled={loading}>
            {loading ? "Loading…" : "Preview official sheet"}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => void downloadPdf()}>
            <Download className="h-3.5 w-3.5" />
            Export official PDF
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {warning && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">{warning}</p>}
      </div>

      {groups.length > 0 && (
        <div className="space-y-6">
          {groups.slice(0, 8).map((g) => (
            <div
              key={g.student.userId}
              className="mx-auto max-w-[720px] rounded-sm border border-neutral-300 bg-white p-8 text-black shadow-sm"
              style={{ minHeight: 900 }}
            >
              <h2 className="text-center text-base font-bold text-black">Youth Scholarship Programme - Attendance Sheet</h2>
              <p className="mt-4 text-sm text-black">Course Name: {courseName || "—"}</p>
              <p className="text-sm text-black">
                Month: {month} / {month.split("-")[0]}
              </p>
              <p className="mt-3 text-sm font-semibold text-black">Student: {g.student.fullName}</p>
              <table className="mt-4 w-full border-collapse text-xs text-black">
                <thead>
                  <tr className="border-b border-black">
                    <th className="border border-neutral-400 px-1 py-1 text-left font-semibold">#</th>
                    <th className="border border-neutral-400 px-1 py-1 text-left font-semibold">Full name</th>
                    <th className="border border-neutral-400 px-1 py-1 text-left font-semibold">Duty station</th>
                    <th className="border border-neutral-400 px-1 py-1 text-left font-semibold">Day &amp; Date</th>
                    <th className="border border-neutral-400 px-1 py-1 text-left font-semibold">Youth signature</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const r = g.rows[i]
                    return (
                      <tr key={i}>
                        <td className="border border-neutral-300 px-1 py-1">{i + 1}</td>
                        <td className="border border-neutral-300 px-1 py-1">{r ? g.student.fullName : ""}</td>
                        <td className="border border-neutral-300 px-1 py-1">{r?.dutyStation || ""}</td>
                        <td className="border border-neutral-300 px-1 py-1">{r?.dayLabel || ""}</td>
                        <td className="border border-neutral-300 px-1 py-1">{r?.signatureText || ""}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-8 text-sm text-black">Supervisor Signature: _______________________________</p>
            </div>
          ))}
          {groups.length > 8 && (
            <p className="text-xs text-muted-foreground text-center">Preview shows first 8 students. Export PDF for the full roster.</p>
          )}
        </div>
      )}
    </div>
  )
}
