"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch, safeArray } from "@/lib/helpers"
import { useWorkspace } from "@/components/providers/workspace-context"
import { Calendar, Download, RefreshCw, ClipboardCheck, Upload, AlertTriangle, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import Papa from "papaparse"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

type AttendanceRow = { id?: number; user_id: string; username?: string; display_name?: string; duty_station?: string; attendance_date: string; checkpoint_key: string; checkpoint_label?: string; status: string; checked_at?: string; local_checked_at?: string; notes?: string; source?: string }
type MissingItem = { userId: string; name: string; checkpointKey: string; attendanceDate: string }
type Student = { id: number; full_name: string; preferred_name?: string; email?: string; discord_user_id?: string; discord_username?: string; duty_station?: string; student_code?: string; active: number }
type Cohort = { id: number; name: string; active: number }
type CheckpointDef = {
  id: number
  key: string
  label: string
  commandType: "checkin" | "checkout"
  targetTime: string
  opensBeforeMinutes: number
  lateAfterMinutes: number
  closesAfterMinutes: number | null
  allowLateSubmission: boolean
  required: boolean
  active: boolean
  sortOrder: number
}

const ROSTER_FIELDS = [
  "fullName",
  "preferredName",
  "email",
  "discordUserId",
  "discordUsername",
  "dutyStation",
  "studentCode",
  "cohort",
] as const

const FIELD_LABELS: Record<(typeof ROSTER_FIELDS)[number], string> = {
  fullName: "Full Name",
  preferredName: "Preferred Name",
  email: "Email",
  discordUserId: "Discord User ID",
  discordUsername: "Discord Username",
  dutyStation: "Duty Station",
  studentCode: "Student Code",
  cohort: "Cohort",
}

function statusBadge(status: string | undefined | null) {
  const s = String(status || "")
  if (s === "present") return <Badge className="bg-success text-success-foreground">Present</Badge>
  if (s === "late") return <Badge className="bg-warning text-warning-foreground">Late</Badge>
  if (s === "excused") return <Badge variant="secondary">Excused</Badge>
  if (s === "manual") return <Badge variant="outline">Manual</Badge>
  if (!s) return <Badge variant="outline">—</Badge>
  return <Badge variant="outline">{s}</Badge>
}

function isoDateToday() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function weekRange(ref: string) {
  const d = new Date(`${ref}T00:00:00`)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + mondayOffset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const toIso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  return { weekStart: toIso(start), weekEnd: toIso(end) }
}

export default function AttendancePage() {
  const { selectedGuildId } = useWorkspace()

  const [tab, setTab] = useState("today")
  const [date, setDate] = useState(isoDateToday())
  const [month, setMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [missing, setMissing] = useState<MissingItem[]>([])
  const [defs, setDefs] = useState<CheckpointDef[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [selectedCohortId, setSelectedCohortId] = useState<string>("all")
  const [students, setStudents] = useState<Student[]>([])
  const [rosterWarning, setRosterWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingStudent, setSavingStudent] = useState(false)
  const [studentDialogOpen, setStudentDialogOpen] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null)
  const [studentForm, setStudentForm] = useState({
    fullName: "",
    preferredName: "",
    email: "",
    discordUserId: "",
    discordUsername: "",
    dutyStation: "Remote",
    studentCode: "",
    cohortId: "",
    active: true,
  })
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([])
  const [csvText, setCsvText] = useState("")
  const [rosterImportResult, setRosterImportResult] = useState<any>(null)
  const [manual, setManual] = useState({
    userId: "",
    checkpointKey: "",
    status: "present",
    notes: "",
  })

  const load = useCallback(
    async (isRefresh = false) => {
      if (!selectedGuildId) {
        setRows([])
        setMissing([])
        setLoading(false)
        setRefreshing(false)
        setError(null)
        return
      }

      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const wr = weekRange(date)
      const [yyyy, mm] = month.split("-")
      const [todayRes, missingRes, settingsRes, cohortsRes, studentsRes, weekRes, monthRes] = await Promise.all([
        apiFetch<any>(`/api/attendance/today?guildId=${selectedGuildId}&date=${date}`),
        apiFetch<any>(`/api/attendance/missing?guildId=${selectedGuildId}&date=${date}`),
        apiFetch<{ definitions?: CheckpointDef[] }>(`/api/attendance/settings?guildId=${selectedGuildId}`),
        apiFetch<any>(`/api/roster/cohorts?guildId=${selectedGuildId}`),
        apiFetch<any>(
          `/api/roster/students?guildId=${selectedGuildId}${selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""}`
        ),
        apiFetch<any>(`/api/attendance/week?guildId=${selectedGuildId}&weekStart=${wr.weekStart}&weekEnd=${wr.weekEnd}`),
        apiFetch<any>(`/api/attendance/month?guildId=${selectedGuildId}&month=${mm}&year=${yyyy}`),
      ])

      if (!todayRes.ok) {
        setError(todayRes.error ?? "Could not load attendance.")
        setRows([])
      } else {
        const payload = todayRes.data as any
        const list = safeArray<AttendanceRow>(payload?.rows)
        setRows(list)
      }

      if (missingRes.ok) {
        const payload = missingRes.data as any
        const list = safeArray<MissingItem>(payload?.missing)
        setMissing(list)
        setRosterWarning(payload?.warning || null)
      } else {
        setMissing([])
        setRosterWarning(null)
      }

      if (settingsRes.ok) {
        const d = safeArray<CheckpointDef>((settingsRes.data as any)?.definitions)
        setDefs(d.filter((x) => x.active))
        if (!manual.checkpointKey && d[0]?.key) {
          setManual((m) => ({ ...m, checkpointKey: d[0].key }))
        }
      } else {
        setDefs([])
      }
      if (cohortsRes.ok) {
        const list = safeArray<Cohort>((cohortsRes.data as any)?.cohorts)
        setCohorts(list)
      } else {
        setCohorts([])
      }
      if (studentsRes.ok) {
        setStudents(safeArray<Student>((studentsRes.data as any)?.students))
      } else {
        setStudents([])
      }
      if (weekRes.ok) setWeekRows(safeArray<AttendanceRow>((weekRes.data as any)?.rows))
      else setWeekRows([])
      if (monthRes.ok) setMonthRows(safeArray<AttendanceRow>((monthRes.data as any)?.rows))
      else setMonthRows([])

      setLoading(false)
      setRefreshing(false)
    },
    [selectedGuildId, date, month, manual.checkpointKey, selectedCohortId]
  )

  const [weekRows, setWeekRows] = useState<AttendanceRow[]>([])
  const [monthRows, setMonthRows] = useState<AttendanceRow[]>([])

  useEffect(() => {
    void load()
  }, [load])

  const byStudent = useMemo(() => {
    const map = new Map<string, { name: string; byKey: Record<string, AttendanceRow | undefined> }>()
    for (const r of rows) {
      const name = r.display_name || r.username || r.user_id
      const cur = map.get(r.user_id) || { name, byKey: {} }
      cur.byKey[r.checkpoint_key] = r
      map.set(r.user_id, cur)
    }
    return Array.from(map.entries()).map(([userId, v]) => ({ userId, ...v }))
  }, [rows])

  const requiredDefs = useMemo(() => defs.filter((d) => d.active && d.required), [defs])
  const requiredCount = requiredDefs.length || 1

  const weekMatrix = useMemo(() => {
    const byStudentDay = new Map<string, Map<string, Set<string>>>()
    for (const r of weekRows) {
      if (r.status === "missing") continue
      const m = byStudentDay.get(r.user_id) || new Map<string, Set<string>>()
      const s = m.get(r.attendance_date) || new Set<string>()
      s.add(r.checkpoint_key)
      m.set(r.attendance_date, s)
      byStudentDay.set(r.user_id, m)
    }
    const wr = weekRange(date)
    const days: string[] = []
    for (let d = new Date(`${wr.weekStart}T00:00:00`); d <= new Date(`${wr.weekEnd}T00:00:00`); d.setDate(d.getDate() + 1)) {
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    }
    return students.map((s) => {
      const userId = s.discord_user_id || `student:${s.id}`
      const byDay = byStudentDay.get(userId) || new Map<string, Set<string>>()
      let completed = 0
      let late = 0
      for (const r of weekRows) if (r.user_id === userId && r.status === "late") late++
      const dayCells = days.map((d) => {
        const n = (byDay.get(d)?.size || 0)
        completed += n
        return { date: d, value: `${n}/${requiredCount}` }
      })
      const totalRequired = days.length * requiredCount
      return {
        student: s,
        dayCells,
        completion: `${completed}/${totalRequired}`,
        missing: Math.max(0, totalRequired - completed),
        late,
      }
    })
  }, [weekRows, students, requiredCount, date])

  const monthSummary = useMemo(() => {
    const [yyyy, mm] = month.split("-")
    const daysInMonth = new Date(Number(yyyy), Number(mm), 0).getDate()
    const requiredTotal = daysInMonth * requiredCount
    return students.map((s) => {
      const userId = s.discord_user_id || `student:${s.id}`
      const mine = monthRows.filter((r) => r.user_id === userId)
      const completed = mine.filter((r) => r.status !== "missing").length
      const late = mine.filter((r) => r.status === "late").length
      const excused = mine.filter((r) => r.status === "excused").length
      const manualCount = mine.filter((r) => r.status === "manual" || r.source === "dashboard_manual").length
      const missingCount = Math.max(0, requiredTotal - completed)
      const pct = Math.round((completed / Math.max(1, requiredTotal)) * 100)
      return { student: s, requiredTotal, completed, late, missingCount, excused, manualCount, pct }
    })
  }, [students, monthRows, month, requiredCount])

  const needsAttention = useMemo(() => {
    const lateToday = rows.filter((r) => r.status === "late")
    const incompleteWeek = weekMatrix.filter((w) => w.missing > 0)
    const importReview = monthRows.filter((r) => r.source === "csv_import" && r.status === "manual")
    return { lateToday, incompleteWeek, importReview }
  }, [rows, weekMatrix, monthRows])

  async function downloadCsv(range: "today" | "week" | "month") {
    if (!selectedGuildId) return
    let startDate = date
    let endDate = date
    if (range === "week") {
      const wr = weekRange(date)
      startDate = wr.weekStart
      endDate = wr.weekEnd
    } else if (range === "month") {
      const [y, m] = month.split("-").map(Number)
      startDate = `${y}-${String(m).padStart(2, "0")}-01`
      endDate = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`
    }
    const res = await apiFetch<{ ok?: boolean; csv?: string; error?: string }>(
      `/api/attendance/export?guildId=${selectedGuildId}&startDate=${startDate}&endDate=${endDate}${selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""}`
    )
    if (!res.ok) {
      setError(res.error ?? "Could not export CSV.")
      return
    }
    const csv = (res.data as any)?.csv as string | undefined
    if (!csv) {
      setError("Export returned no CSV data.")
      return
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const cohortName = cohorts.find((c) => String(c.id) === selectedCohortId)?.name || "all"
    a.download = `attendance_${cohortName}_${startDate}_to_${endDate}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function addCheckpoint() {
    if (!selectedGuildId) return
    const payload = {
      guildId: selectedGuildId,
      key: `checkpoint_${Date.now()}`,
      label: "New checkpoint",
      commandType: "checkin",
      targetTime: "10:00",
      opensBeforeMinutes: 15,
      lateAfterMinutes: 15,
      closesAfterMinutes: null,
      allowLateSubmission: true,
      required: true,
      active: true,
      sortOrder: (defs.at(-1)?.sortOrder ?? 0) + 10,
    }
    const res = await apiFetch("/api/attendance/settings/checkpoints", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    if (!res.ok) setError(res.error ?? "Could not add checkpoint.")
    await load(true)
  }

  async function saveCheckpoint(def: CheckpointDef) {
    if (!selectedGuildId) return
    const res = await apiFetch(`/api/attendance/settings/checkpoints/${def.id}`, {
      method: "PATCH",
      body: JSON.stringify({ guildId: selectedGuildId, ...def }),
    })
    if (!res.ok) setError(res.error ?? "Could not update checkpoint.")
    await load(true)
  }

  async function previewImport() {
    if (!selectedGuildId) return
    const res = await apiFetch<any>("/api/roster/import", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        csvText,
        dryRun: true,
        columnMap,
        cohortId: selectedCohortId !== "all" ? Number(selectedCohortId) : null,
      }),
    })
    if (!res.ok) {
      setError(res.error ?? "Import preview failed.")
      return
    }
    setRosterImportResult(res.data)
  }

  async function commitRosterImport() {
    if (!selectedGuildId) return
    const res = await apiFetch<any>("/api/roster/import", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        csvText,
        dryRun: false,
        columnMap,
        cohortId: selectedCohortId !== "all" ? Number(selectedCohortId) : null,
      }),
    })
    if (!res.ok) {
      setError(res.error ?? "Import failed.")
      return
    }
    setRosterImportResult(res.data)
    await load(true)
  }

  async function exportRosterCsv() {
    if (!selectedGuildId) return
    const res = await apiFetch<any>(
      `/api/roster/export?guildId=${selectedGuildId}${selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""}`
    )
    if (!res.ok) {
      setError(res.error ?? "Roster export failed.")
      return
    }
    const csv = (res.data as any)?.csv || ""
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `roster_${selectedGuildId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function saveStudent() {
    if (!selectedGuildId) return
    setSavingStudent(true)
    const payload = {
      guildId: selectedGuildId,
      fullName: studentForm.fullName,
      preferredName: studentForm.preferredName || null,
      email: studentForm.email || null,
      discordUserId: studentForm.discordUserId || null,
      discordUsername: studentForm.discordUsername || null,
      dutyStation: studentForm.dutyStation || "Remote",
      studentCode: studentForm.studentCode || null,
      cohortId: studentForm.cohortId ? Number(studentForm.cohortId) : null,
      active: studentForm.active,
    }
    const endpoint = editingStudentId ? `/api/roster/students/${editingStudentId}` : "/api/roster/students"
    const method = editingStudentId ? "PATCH" : "POST"
    const res = await apiFetch<any>(endpoint, { method, body: JSON.stringify(payload) })
    setSavingStudent(false)
    if (!res.ok) {
      setError(res.error ?? "Could not save student.")
      return
    }
    setStudentDialogOpen(false)
    await load(true)
  }

  async function saveManual() {
    if (!selectedGuildId) return
    const res = await apiFetch("/api/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        userId: manual.userId,
        displayName: students.find((s) => (s.discord_user_id || `student:${s.id}`) === manual.userId)?.full_name || undefined,
        date,
        checkpointKey: manual.checkpointKey,
        status: manual.status,
        reason: manual.notes,
        changedBy: "dashboard",
      }),
    })
    if (!res.ok) setError(res.error ?? "Manual correction failed.")
    await load(true)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Attendance"
        description="Daily check-ins and checkout checkpoints. Students use !checkin / !checkout during open windows."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => void downloadCsv("today")}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        }
      />

      {!selectedGuildId ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Select a Discord server"
          description="Pick a server in the sidebar to review attendance checkpoints."
        />
      ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="needs">Needs Attention</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="import-export">Import / Export</TabsTrigger>
            <TabsTrigger value="manual">Manual Corrections</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState message="Loading attendance…" />
          ) : error ? (
            <ErrorPanel message={error} offline={error.includes("offline")} />
          ) : byStudent.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No attendance check-ins recorded yet"
              description="Students can type !checkin during morning/midday windows, and !checkout during the checkout window."
            />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="min-w-[820px] w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3 w-[280px]">Student</th>
                    {defs.map((d) => (
                      <th key={d.key} className="text-left font-medium px-4 py-3">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byStudent.map((s) => (
                    <tr key={s.userId} className="hover:bg-accent/10">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{s.userId}</p>
                      </td>
                      {defs.map((d) => {
                        const cell = s.byKey[d.key]
                        return (
                          <td key={`${s.userId}-${d.key}`} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {statusBadge(cell?.status)}
                              <span className="text-xs text-muted-foreground">
                                {cell?.local_checked_at ? cell.local_checked_at.split(" ").slice(1).join(" ") : ""}
                              </span>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rosterWarning && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{rosterWarning}</p>
                <Button size="sm" variant="outline" onClick={() => setTab("roster")}>Import roster</Button>
              </div>
            </div>
          )}

          {!loading && missing.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Missing checkpoints</p>
              <p className="text-xs text-muted-foreground mt-0.5">Missing attendance is calculated from active roster students.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {missing.slice(0, 20).map((m, i) => (
                  <li key={`${m.userId}-${m.checkpointKey}-${i}`} className="flex items-center justify-between gap-3">
                    <span className="text-foreground truncate">{m.name}</span>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {m.checkpointKey}
                    </Badge>
                  </li>
                ))}
              </ul>
              {missing.length > 20 && (
                <p className="text-xs text-muted-foreground mt-3">Showing first 20 of {missing.length} missing items.</p>
              )}
            </div>
          )}
          </TabsContent>

          <TabsContent value="week" className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold">Weekly matrix</p>
              <Button size="sm" variant="outline" onClick={() => void downloadCsv("week")}>Export week CSV</Button>
            </div>
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left p-2">Student</th>
                    {weekRange(date) && weekMatrix[0]?.dayCells?.map((d) => (
                      <th key={d.date} className="text-left p-2">{d.date.slice(5)}</th>
                    ))}
                    <th className="text-left p-2">Completion</th>
                    <th className="text-left p-2">Missing</th>
                    <th className="text-left p-2">Late</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {weekMatrix.map((w) => (
                    <tr key={w.student.id}>
                      <td className="p-2">{w.student.preferred_name || w.student.full_name}</td>
                      {w.dayCells.map((c) => (
                        <td key={`${w.student.id}-${c.date}`} className="p-2">
                          <Badge variant={c.value.startsWith(`${requiredCount}/`) ? "default" : c.value.startsWith("0/") ? "destructive" : "secondary"}>
                            {c.value}
                          </Badge>
                        </td>
                      ))}
                      <td className="p-2">{w.completion}</td>
                      <td className="p-2">{w.missing}</td>
                      <td className="p-2">{w.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="month" className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Month</label>
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-56" />
              </div>
              <Button variant="outline" size="sm" onClick={() => void downloadCsv("month")}>Export month CSV</Button>
            </div>
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Required</th>
                    <th className="text-left p-2">Completed</th>
                    <th className="text-left p-2">Late</th>
                    <th className="text-left p-2">Missing</th>
                    <th className="text-left p-2">Excused</th>
                    <th className="text-left p-2">Manual</th>
                    <th className="text-left p-2">Completion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthSummary.map((m) => (
                    <tr key={m.student.id}>
                      <td className="p-2">{m.student.preferred_name || m.student.full_name}</td>
                      <td className="p-2">{m.requiredTotal}</td>
                      <td className="p-2">{m.completed}</td>
                      <td className="p-2">{m.late}</td>
                      <td className="p-2">{m.missingCount}</td>
                      <td className="p-2">{m.excused}</td>
                      <td className="p-2">{m.manualCount}</td>
                      <td className="p-2">{m.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="needs" className="space-y-3">
            {!rosterWarning ? null : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm">{rosterWarning}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTab("roster")}>Import roster</Button>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Missing checkpoint today</p>
              <ul className="space-y-1 text-sm">
                {missing.slice(0, 15).map((m, i) => (
                  <li key={`${m.userId}-${i}`} className="flex items-center justify-between">
                    <span>{m.name}</span>
                    <Badge variant="destructive">{m.checkpointKey}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Late today</p>
              <ul className="space-y-1 text-sm">
                {needsAttention.lateToday.slice(0, 15).map((r, i) => (
                  <li key={`${r.user_id}-${i}`} className="flex items-center justify-between">
                    <span>{r.display_name || r.username || r.user_id}</span>
                    <Badge className="bg-warning text-warning-foreground">{r.checkpoint_label || r.checkpoint_key}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="roster" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Roster</p>
                  <p className="text-xs text-muted-foreground">{students.length} students</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void exportRosterCsv()}>Export roster CSV</Button>
                  <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => {
                        setEditingStudentId(null)
                        setStudentForm({ fullName: "", preferredName: "", email: "", discordUserId: "", discordUsername: "", dutyStation: "Remote", studentCode: "", cohortId: selectedCohortId === "all" ? "" : selectedCohortId, active: true })
                      }}>Add student</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{editingStudentId ? "Edit student" : "Add student"}</DialogTitle></DialogHeader>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Full Name" value={studentForm.fullName} onChange={(e) => setStudentForm((s) => ({ ...s, fullName: e.target.value }))} />
                        <Input placeholder="Preferred Name" value={studentForm.preferredName} onChange={(e) => setStudentForm((s) => ({ ...s, preferredName: e.target.value }))} />
                        <Input placeholder="Email" value={studentForm.email} onChange={(e) => setStudentForm((s) => ({ ...s, email: e.target.value }))} />
                        <Input placeholder="Discord User ID" value={studentForm.discordUserId} onChange={(e) => setStudentForm((s) => ({ ...s, discordUserId: e.target.value }))} />
                        <Input placeholder="Discord Username" value={studentForm.discordUsername} onChange={(e) => setStudentForm((s) => ({ ...s, discordUsername: e.target.value }))} />
                        <Input placeholder="Duty Station" value={studentForm.dutyStation} onChange={(e) => setStudentForm((s) => ({ ...s, dutyStation: e.target.value }))} />
                        <Input placeholder="Student Code" value={studentForm.studentCode} onChange={(e) => setStudentForm((s) => ({ ...s, studentCode: e.target.value }))} />
                        <Select value={studentForm.cohortId || "none"} onValueChange={(v) => setStudentForm((s) => ({ ...s, cohortId: v === "none" ? "" : v }))}>
                          <SelectTrigger><SelectValue placeholder="Cohort" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No cohort</SelectItem>
                            {cohorts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => void saveStudent()} disabled={savingStudent}>{savingStudent ? "Saving..." : "Save"}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                  <SelectTrigger className="w-60"><SelectValue placeholder="All cohorts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cohorts</SelectItem>
                    {cohorts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md border border-border overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left p-2">Full Name</th>
                      <th className="text-left p-2">Preferred Name</th>
                      <th className="text-left p-2">Discord Username</th>
                      <th className="text-left p-2">Discord User ID</th>
                      <th className="text-left p-2">Duty Station</th>
                      <th className="text-left p-2">Student Code</th>
                      <th className="text-left p-2">Active</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="p-2">{s.full_name}</td>
                        <td className="p-2">{s.preferred_name || "—"}</td>
                        <td className="p-2">{s.discord_username || "—"}</td>
                        <td className="p-2 font-mono text-xs">{s.discord_user_id || "—"}</td>
                        <td className="p-2">{s.duty_station || "Remote"}</td>
                        <td className="p-2">{s.student_code || "—"}</td>
                        <td className="p-2">{s.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingStudentId(s.id)
                            setStudentForm({
                              fullName: s.full_name || "",
                              preferredName: s.preferred_name || "",
                              email: s.email || "",
                              discordUserId: s.discord_user_id || "",
                              discordUsername: s.discord_username || "",
                              dutyStation: s.duty_station || "Remote",
                              studentCode: s.student_code || "",
                              cohortId: selectedCohortId === "all" ? "" : selectedCohortId,
                              active: Boolean(s.active),
                            })
                            setStudentDialogOpen(true)
                          }}>Edit</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Checkpoint definitions</p>
                <Button size="sm" onClick={() => void addCheckpoint()}>Add checkpoint</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Late submissions are still saved and marked Late unless you disable late submissions.
              </p>
              <div className="mt-4 space-y-3">
                {defs.map((d) => (
                  <CheckpointEditor key={d.id} def={d} onSave={saveCheckpoint} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import-export" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Roster CSV import with mapping</p>
              <p className="text-xs text-muted-foreground">
                Upload roster CSV, map columns, preview, then commit.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  setCsvText(text)
                  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
                  const headers = parsed.meta.fields || []
                  setCsvHeaders(headers)
                  setCsvPreview((parsed.data || []).slice(0, 10))
                  const map: Record<string, string> = {}
                  headers.forEach((h: string) => {
                    const key = h.toLowerCase()
                    if (key.includes("full") && key.includes("name")) map.fullName = h
                    if (key.includes("preferred")) map.preferredName = h
                    if (key === "email" || key.includes("email")) map.email = h
                    if (key.includes("discord") && key.includes("id")) map.discordUserId = h
                    if (key.includes("discord") && key.includes("username")) map.discordUsername = h
                    if (key.includes("duty") || key.includes("station")) map.dutyStation = h
                    if (key.includes("student") && key.includes("code")) map.studentCode = h
                    if (key.includes("cohort") || key.includes("course")) map.cohort = h
                  })
                  setColumnMap(map)
                }}
              />
              {csvHeaders.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {ROSTER_FIELDS.map((field) => (
                    <div key={field} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{FIELD_LABELS[field]}</label>
                      <Select value={columnMap[field] || "unmapped"} onValueChange={(v) => setColumnMap((m) => ({ ...m, [field]: v === "unmapped" ? "" : v }))}>
                        <SelectTrigger><SelectValue placeholder="Map column" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmapped">Unmapped</SelectItem>
                          {csvHeaders.map((h) => <SelectItem key={`${field}-${h}`} value={h}>{h}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="w-full min-h-40 rounded-md border border-border bg-background p-3 text-xs font-mono"
                placeholder="Full Name,Preferred Name,Email,Discord User ID,Discord Username,Duty Station,Student Code,Cohort"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void previewImport()}>
                  <Upload className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button size="sm" onClick={() => void commitRosterImport()}>Commit import</Button>
              </div>
              {csvPreview.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Preview rows (first 10)</p>
                  <div className="rounded border border-border p-2 text-xs max-h-40 overflow-auto">
                    {csvPreview.map((r, i) => (
                      <pre key={i} className="whitespace-pre-wrap">{JSON.stringify(r, null, 0)}</pre>
                    ))}
                  </div>
                </div>
              )}
              {rosterImportResult && (
                <ul className="space-y-1 text-xs">
                  <li>Total: {rosterImportResult.rowsTotal ?? 0}</li>
                  <li>Imported: {rosterImportResult.rowsImported ?? 0}</li>
                  <li>Updated: {rosterImportResult.rowsUpdated ?? 0}</li>
                  <li>Skipped: {rosterImportResult.rowsSkipped ?? 0}</li>
                  <li>Failed: {rosterImportResult.rowsFailed ?? 0}</li>
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Manual correction</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={manual.userId || "none"} onValueChange={(v) => setManual((m) => ({ ...m, userId: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select Student" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select student</SelectItem>
                    {students.map((s) => {
                      const userId = s.discord_user_id || `student:${s.id}`
                      return <SelectItem key={userId} value={userId}>{s.preferred_name || s.full_name}</SelectItem>
                    })}
                  </SelectContent>
                </Select>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Select value={manual.checkpointKey || "none"} onValueChange={(v) => setManual((m) => ({ ...m, checkpointKey: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Checkpoint" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select checkpoint</SelectItem>
                    {defs.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={manual.status} onValueChange={(v) => setManual((m) => ({ ...m, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">present</SelectItem>
                    <SelectItem value="late">late</SelectItem>
                    <SelectItem value="excused">excused</SelectItem>
                    <SelectItem value="missing">missing</SelectItem>
                    <SelectItem value="manual">manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Notes / reason" value={manual.notes} onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))} />
              <Button size="sm" onClick={() => void saveManual()}>Save correction</Button>
            </div>
          </TabsContent>
          </Tabs>
      )}
    </div>
  )
}

function CheckpointEditor({
  def,
  onSave,
}: {
  def: CheckpointDef
  onSave: (d: CheckpointDef) => Promise<void>
}) {
  const [local, setLocal] = useState(def)
  useEffect(() => setLocal(def), [def])

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input value={local.label} onChange={(e) => setLocal({ ...local, label: e.target.value })} />
        <Input value={local.targetTime} onChange={(e) => setLocal({ ...local, targetTime: e.target.value })} />
        <Input value={String(local.opensBeforeMinutes)} onChange={(e) => setLocal({ ...local, opensBeforeMinutes: Number(e.target.value) || 0 })} />
        <Input value={String(local.lateAfterMinutes)} onChange={(e) => setLocal({ ...local, lateAfterMinutes: Number(e.target.value) || 0 })} />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs"><input type="checkbox" checked={local.allowLateSubmission} onChange={(e) => setLocal({ ...local, allowLateSubmission: e.target.checked })} /> allow late</label>
        <label className="text-xs"><input type="checkbox" checked={local.required} onChange={(e) => setLocal({ ...local, required: e.target.checked })} /> required</label>
        <label className="text-xs"><input type="checkbox" checked={local.active} onChange={(e) => setLocal({ ...local, active: e.target.checked })} /> active</label>
        <Button size="sm" variant="outline" onClick={() => void onSave(local)}>Save</Button>
      </div>
    </div>
  )
}

