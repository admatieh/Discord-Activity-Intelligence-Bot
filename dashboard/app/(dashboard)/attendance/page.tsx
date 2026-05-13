"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch, safeArray, parseApiDate, formatDateShort } from "@/lib/helpers"
import { useWorkspace } from "@/components/providers/workspace-context"
import { Calendar, Download, RefreshCw, ClipboardCheck, AlertTriangle, Users, Cloud } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { OfficialSheetsPanel } from "./official-sheets-panel"
import { ManualStudentCombobox } from "./manual-student-combobox"
import { extractRosterStudentsFromApiResponse } from "@/lib/rosterStudentUtils"
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
type Student = { id: number; full_name: string; preferred_name?: string; email?: string; discord_user_id?: string; discord_username?: string; duty_station?: string; student_code?: string; active: number; source?: string | null; synced_from_discord?: number | null; last_synced_at?: string | null }
type Cohort = { id: number; name: string; active: number; course_name?: string | null }
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
  allowAfterCloseManualOnly?: boolean
  required: boolean
  active: boolean
  includeInOfficialCompletion?: boolean
  sortOrder: number
}

type DailyStatusPayload = {
  status: string
  exportable: boolean
  completedRequired: number
  totalRequired: number
}

type SummaryRangePayload = {
  byUser?: Record<string, Record<string, DailyStatusPayload>>
  rosterConfigured?: boolean
  warning?: string | null
}

function statusBadge(status: string | undefined | null) {
  const s = String(status || "")
  if (s === "present") return <Badge className="bg-success text-success-foreground">Present</Badge>
  if (s === "late") return <Badge className="bg-warning text-warning-foreground">Late</Badge>
  if (s === "complete" || s === "completed") return <Badge className="bg-success text-success-foreground">Complete</Badge>
  if (s === "complete_late") return <Badge className="bg-warning text-warning-foreground">Complete (late)</Badge>
  if (s === "partial") return <Badge variant="secondary">Partial</Badge>
  if (s === "missing") return <Badge variant="destructive">Missing</Badge>
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
  const [allDefs, setAllDefs] = useState<CheckpointDef[]>([])
  const [summaryWeek, setSummaryWeek] = useState<SummaryRangePayload | null>(null)
  const [summaryMonth, setSummaryMonth] = useState<SummaryRangePayload | null>(null)
  const [dailyByUser, setDailyByUser] = useState<Record<string, Record<string, DailyStatusPayload>> | null>(null)
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
  const [manualStudentId, setManualStudentId] = useState<number | null>(null)
  const [dailyOverrideStudentId, setDailyOverrideStudentId] = useState<number | null>(null)
  const [manual, setManual] = useState({
    checkpointKey: "",
    status: "present",
    notes: "",
    signatureText: "",
  })
  const [dailyOverride, setDailyOverride] = useState({
    status: "completed",
    signatureText: "",
    notes: "",
  })
  const [manualTabNotice, setManualTabNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [officialSheetsRefreshNonce, setOfficialSheetsRefreshNonce] = useState(0)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMode, setSyncMode] = useState<"append" | "mirror">("append")
  const [syncCohortId, setSyncCohortId] = useState<string>("")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncRoles, setSyncRoles] = useState<any[]>([])
  const [syncRolesLoading, setSyncRolesLoading] = useState(false)
  const [syncSelectedRoleId, setSyncSelectedRoleId] = useState<string | null>(null)
  const [syncSummary, setSyncSummary] = useState<{
    scannedMembers: number
    matchedStudentRole: number
    created: number
    updated: number
    linked: number
    deactivated: number
    skippedBots: number
    skippedNoStudentRole: number
    errors: { userId: string; error: string }[]
    warnings: string[]
  } | null>(null)
  const [mirrorAcknowledged, setMirrorAcknowledged] = useState(false)
  const [showAdvancedSync, setShowAdvancedSync] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (!selectedGuildId) {
        setRows([])
        setMissing([])
        setDailyByUser(null)
        setSummaryWeek(null)
        setSummaryMonth(null)
        setAllDefs([])
        setCohorts([])
        setStudents([])
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
      const monthStart = `${yyyy}-${String(Number(mm)).padStart(2, "0")}-01`
      const monthEnd = `${yyyy}-${String(Number(mm)).padStart(2, "0")}-${String(new Date(Number(yyyy), Number(mm), 0).getDate()).padStart(2, "0")}`
      const cohortQ = selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""

      const [todayRes, missingRes, settingsRes, cohortsRes, studentsRes, summaryWeekRes, summaryMonthRes] =
        await Promise.all([
          apiFetch<any>(`/api/attendance/today?guildId=${selectedGuildId}&date=${date}${cohortQ}`),
          apiFetch<any>(`/api/attendance/missing?guildId=${selectedGuildId}&date=${date}`),
          apiFetch<{ definitions?: CheckpointDef[] }>(`/api/attendance/settings?guildId=${selectedGuildId}`),
          apiFetch<any>(`/api/roster/cohorts?guildId=${selectedGuildId}`),
          apiFetch<any>(
            `/api/roster/students?guildId=${selectedGuildId}${selectedCohortId !== "all" ? `&cohortId=${selectedCohortId}` : ""}&active=1`
          ),
          apiFetch<any>(
            `/api/attendance/summary-range?guildId=${selectedGuildId}&startDate=${wr.weekStart}&endDate=${wr.weekEnd}${cohortQ}`
          ),
          apiFetch<any>(
            `/api/attendance/summary-range?guildId=${selectedGuildId}&startDate=${monthStart}&endDate=${monthEnd}${cohortQ}`
          ),
        ])

      if (!todayRes.ok) {
        setError(todayRes.error ?? "Could not load attendance.")
        setRows([])
        setDailyByUser(null)
      } else {
        const payload = todayRes.data as any
        const list = safeArray<AttendanceRow>(payload?.rows)
        setRows(list)
        setDailyByUser((payload?.dailyByUser as Record<string, Record<string, DailyStatusPayload>>) || null)
      }

      if (missingRes.ok) {
        const payload = missingRes.data as any
        const list = safeArray<MissingItem>(payload?.missing)
        setMissing(list)
      } else {
        setMissing([])
      }

      let rw: string | null = null
      if (todayRes.ok) rw = (todayRes.data as any)?.rosterWarning ?? rw
      if (missingRes.ok) rw = (missingRes.data as any)?.warning ?? rw
      setRosterWarning(rw)

      if (settingsRes.ok) {
        const d = safeArray<CheckpointDef>((settingsRes.data as any)?.definitions)
        setAllDefs(d)
        if (!manual.checkpointKey && d.filter((x) => x.active)[0]?.key) {
          setManual((m) => ({ ...m, checkpointKey: d.filter((x) => x.active)[0].key }))
        }
      } else {
        setAllDefs([])
      }
      if (cohortsRes.ok) {
        const list = safeArray<Cohort>((cohortsRes.data as any)?.cohorts)
        setCohorts(list)
      } else {
        setCohorts([])
      }
      if (studentsRes.ok) {
        const list = extractRosterStudentsFromApiResponse(studentsRes as { ok?: boolean; data?: unknown; students?: unknown })
        setStudents(list as Student[])
      } else {
        setStudents([])
      }
      if (summaryWeekRes.ok) {
        setSummaryWeek((summaryWeekRes.data as SummaryRangePayload) || null)
      } else {
        setSummaryWeek(null)
      }
      if (summaryMonthRes.ok) {
        setSummaryMonth((summaryMonthRes.data as SummaryRangePayload) || null)
      } else {
        setSummaryMonth(null)
      }

      setLoading(false)
      setRefreshing(false)
    },
    [selectedGuildId, date, month, manual.checkpointKey, selectedCohortId]
  )

  useEffect(() => {
    setManualStudentId(null)
    setDailyOverrideStudentId(null)
    setManualTabNotice(null)
  }, [selectedGuildId])

  useEffect(() => {
    if (manualStudentId == null) return
    if (!students.some((s) => s.id === manualStudentId)) setManualStudentId(null)
  }, [students, manualStudentId])

  useEffect(() => {
    if (dailyOverrideStudentId == null) return
    if (!students.some((s) => s.id === dailyOverrideStudentId)) setDailyOverrideStudentId(null)
  }, [students, dailyOverrideStudentId])

  const activeDefs = useMemo(() => allDefs.filter((d) => d.active).sort((a, b) => a.sortOrder - b.sortOrder), [allDefs])

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

  const todayStudentRows = useMemo(() => {
    if (!students.length) return byStudent
    return students.map((s) => {
      const userId = s.discord_user_id || `student:${s.id}`
      const hit = byStudent.find((b) => b.userId === userId)
      return hit || { userId, name: s.preferred_name || s.full_name, byKey: {} }
    })
  }, [students, byStudent])

  const weekMatrix = useMemo(() => {
    const wr = weekRange(date)
    const days: string[] = []
    for (let d = new Date(`${wr.weekStart}T00:00:00`); d <= new Date(`${wr.weekEnd}T00:00:00`); d.setDate(d.getDate() + 1)) {
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    }
    const byUser = summaryWeek?.byUser || {}
    return students.map((s) => {
      const userId = s.discord_user_id || `student:${s.id}`
      const dayCells = days.map((dt) => {
        const st = byUser[userId]?.[dt]
        return { date: dt, status: st?.status || "missing", exportable: Boolean(st?.exportable) }
      })
      const completeDays = dayCells.filter((c) => c.status === "complete" || c.status === "complete_late").length
      const partialDays = dayCells.filter((c) => c.status === "partial").length
      return {
        student: s,
        dayCells,
        completeDays,
        partialDays,
      }
    })
  }, [students, summaryWeek, date])

  const monthSummary = useMemo(() => {
    const [yyyy, mm] = month.split("-")
    const daysInMonth = new Date(Number(yyyy), Number(mm), 0).getDate()
    const byUser = summaryMonth?.byUser || {}
    return students.map((s) => {
      const userId = s.discord_user_id || `student:${s.id}`
      let complete = 0
      let completeLate = 0
      let partial = 0
      let missing = 0
      let exportableDays = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${yyyy}-${String(Number(mm)).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        const st = byUser[userId]?.[dateStr]
        if (!st) {
          missing++
          continue
        }
        if (st.status === "complete") complete++
        else if (st.status === "complete_late") completeLate++
        else if (st.status === "partial") partial++
        else if (st.status === "missing") missing++
        if (st.exportable) exportableDays++
      }
      const pct = Math.round(((complete + completeLate) / Math.max(1, daysInMonth)) * 100)
      return { student: s, daysInMonth, complete, completeLate, partial, missing, exportableDays, pct }
    })
  }, [students, summaryMonth, month])

  const needsAttention = useMemo(() => {
    const lateToday = rows.filter((r) => r.status === "late")
    const partialToday = students
      .map((s) => {
        const userId = s.discord_user_id || `student:${s.id}`
        const st = dailyByUser?.[userId]?.[date]
        return st?.status === "partial" || st?.status === "missing"
          ? { userId, name: s.preferred_name || s.full_name, status: st?.status, exportable: st?.exportable }
          : null
      })
      .filter(Boolean) as { userId: string; name: string; status: string; exportable: boolean }[]
    const notExportable = students
      .map((s) => {
        const userId = s.discord_user_id || `student:${s.id}`
        const st = dailyByUser?.[userId]?.[date]
        if (st && !st.exportable && st.status === "partial") {
          return { userId, name: s.preferred_name || s.full_name, status: st.status }
        }
        return null
      })
      .filter(Boolean) as { userId: string; name: string; status: string }[]
    return { lateToday, partialToday, notExportable, incompleteWeek: weekMatrix.filter((w) => w.partialDays > 0) }
  }, [rows, students, dailyByUser, date, weekMatrix])

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
      label: "New checkpoint",
      commandType: "checkin",
      targetTime: "10:00",
      opensBeforeMinutes: 15,
      lateAfterMinutes: 15,
      closesAfterMinutes: null,
      allowLateSubmission: true,
      required: true,
      active: true,
      includeInOfficialCompletion: true,
      sortOrder: (allDefs.at(-1)?.sortOrder ?? 0) + 10,
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

  async function fetchRoles() {
    if (!selectedGuildId) return
    setSyncRolesLoading(true)
    const res = await apiFetch<any>(`/api/discord/guilds/${selectedGuildId}/roles`)
    setSyncRolesLoading(false)
    if (res.ok) {
      const result = res as any
      const roles = Array.isArray(result?.roles) ? result.roles :
                    Array.isArray(result?.data?.roles) ? result.data.roles :
                    Array.isArray(result?.data) ? result.data :
                    Array.isArray(result) ? result :
                    []
      // Filter out managed/bot roles unless needed? 
      // The user asked to "Hide or disable managed/bot roles unless there is a reason to show them."
      // Since managed = true for bot roles and integration roles, we can filter them out.
      const filtered = roles.filter((r: any) => !r.managed)
      setSyncRoles(filtered)
      
      // Auto-select
      const savedRoleId = localStorage.getItem(`syncRole_${selectedGuildId}`)
      if (savedRoleId && filtered.find((r: any) => r.id === savedRoleId)) {
        setSyncSelectedRoleId(savedRoleId)
      } else {
        // Fallback to name "Student"
        const studentRole = filtered.find((r: any) => r.name.toLowerCase() === "student")
        if (studentRole) {
          setSyncSelectedRoleId(studentRole.id)
        } else {
          setSyncSelectedRoleId(null)
        }
      }
    } else {
      setSyncRoles([])
    }
  }

  async function runDiscordSync() {
    if (!selectedGuildId) return
    setSyncing(true)
    setSyncSummary(null)
    setSyncError(null)
    const selectedRoleObj = syncRoles.find(r => r.id === syncSelectedRoleId)
    const res = await apiFetch<any>("/api/roster/sync-discord", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        cohortId: syncCohortId || null,
        mode: syncMode,
        syncedBy: "dashboard",
        studentRoleId: selectedRoleObj?.id || null,
        studentRoleName: selectedRoleObj?.name || null,
      }),
    })
    setSyncing(false)
    if (!res.ok) {
      setSyncError(res.error ?? "Discord sync failed.")
      setError(res.error ?? "Discord sync failed.")
      return
    }
    const summary = (res.data as any)?.summary ?? null
    setSyncSummary(summary)
    await load(true)
  }

  async function toggleStudentActive(studentId: number, active: boolean) {
    if (!selectedGuildId) return
    const res = await apiFetch<any>(`/api/roster/students/${studentId}`, {
      method: "PATCH",
      body: JSON.stringify({ guildId: selectedGuildId, active }),
    })
    if (!res.ok) {
      setError(res.error ?? "Could not update student.")
      return
    }
    await load(true)
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
    setManualTabNotice(null)
    const student = students.find((s) => s.id === manualStudentId)
    if (!student) {
      setManualTabNotice({ kind: "err", text: "Select a student first." })
      return
    }
    if (!manual.checkpointKey) {
      setManualTabNotice({ kind: "err", text: "Select a checkpoint." })
      return
    }
    const discordId =
      student.discord_user_id != null && String(student.discord_user_id).trim() !== ""
        ? String(student.discord_user_id).trim()
        : null
    const res = await apiFetch("/api/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        studentId: student.id,
        userId: discordId,
        displayName: student.full_name,
        username: student.discord_username != null && String(student.discord_username).trim() !== "" ? student.discord_username : null,
        date,
        checkpointKey: manual.checkpointKey,
        status: manual.status,
        notes: manual.notes || undefined,
        changedBy: "dashboard",
        signatureText: manual.signatureText || undefined,
        source: "dashboard_manual",
      }),
    })
    if (!res.ok) {
      setManualTabNotice({ kind: "err", text: res.error ?? "Manual correction failed." })
      setError(res.error ?? "Manual correction failed.")
      return
    }
    setError(null)
    setManualTabNotice({ kind: "ok", text: "Checkpoint correction saved." })
    setOfficialSheetsRefreshNonce((n) => n + 1)
    await load(true)
  }

  async function saveDailyOverride() {
    if (!selectedGuildId) return
    setManualTabNotice(null)
    const student = students.find((s) => s.id === dailyOverrideStudentId)
    if (!student) {
      setManualTabNotice({ kind: "err", text: "Select a student for the daily override." })
      return
    }
    const discordId =
      student.discord_user_id != null && String(student.discord_user_id).trim() !== ""
        ? String(student.discord_user_id).trim()
        : null
    const res = await apiFetch("/api/attendance/daily-override", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        studentId: student.id,
        userId: discordId,
        attendanceDate: date,
        status: dailyOverride.status,
        signatureText: dailyOverride.signatureText || undefined,
        notes: dailyOverride.notes || undefined,
        changedBy: "dashboard",
      }),
    })
    if (!res.ok) {
      setManualTabNotice({ kind: "err", text: res.error ?? "Daily override failed." })
      setError(res.error ?? "Daily override failed.")
      return
    }
    setError(null)
    setManualTabNotice({ kind: "ok", text: "Daily override saved." })
    setOfficialSheetsRefreshNonce((n) => n + 1)
    await load(true)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Attendance"
        description="Live checkpoints show partial progress. Official exports only include days where every required checkpoint is satisfied, unless an instructor uses manual corrections or a daily override."
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
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Official sheets only include completed attendance days. Partial check-ins remain visible in Today / Needs
            Attention but are not exported unless manually approved. Students must complete all required checkpoints for
            the day to be counted as complete. Manual corrections let instructors handle exceptions.
          </div>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="needs">Needs Attention</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="manual">Manual Corrections</TabsTrigger>
            <TabsTrigger value="official">Official Sheets</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
          ) : todayStudentRows.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No students or attendance for this view"
              description="Add students to the roster, or wait for students to use !checkin / !checkout during open windows."
            />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3 w-[220px]">Student</th>
                    <th className="text-left font-medium px-4 py-3 w-[120px]">Daily status</th>
                    {activeDefs.map((d) => (
                      <th key={d.key} className="text-left font-medium px-4 py-3">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {todayStudentRows.map((s) => {
                    const ds = dailyByUser?.[s.userId]?.[date]
                    return (
                    <tr key={s.userId} className="hover:bg-accent/10">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{s.userId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {statusBadge(ds?.status)}
                          {!ds?.exportable && ds?.status && ds.status !== "missing" && (
                            <span className="text-[10px] text-muted-foreground">Not on official sheet</span>
                          )}
                        </div>
                      </td>
                      {activeDefs.map((d) => {
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rosterWarning && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{rosterWarning}</p>
                <Button size="sm" variant="outline" onClick={() => setTab("roster")}>Open roster</Button>
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
              <p className="text-sm font-semibold">Weekly daily status</p>
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
                    <th className="text-left p-2">Complete days</th>
                    <th className="text-left p-2">Partial days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {weekMatrix.map((w) => (
                    <tr key={w.student.id}>
                      <td className="p-2">{w.student.preferred_name || w.student.full_name}</td>
                      {w.dayCells.map((c) => (
                        <td key={`${w.student.id}-${c.date}`} className="p-2">
                          {statusBadge(c.status)}
                        </td>
                      ))}
                      <td className="p-2">{w.completeDays}</td>
                      <td className="p-2">{w.partialDays}</td>
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
                    <th className="text-left p-2">Days in month</th>
                    <th className="text-left p-2">Complete</th>
                    <th className="text-left p-2">Complete (late)</th>
                    <th className="text-left p-2">Partial</th>
                    <th className="text-left p-2">Missing</th>
                    <th className="text-left p-2">Exportable days</th>
                    <th className="text-left p-2">Complete %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthSummary.map((m) => (
                    <tr key={m.student.id}>
                      <td className="p-2">{m.student.preferred_name || m.student.full_name}</td>
                      <td className="p-2">{m.daysInMonth}</td>
                      <td className="p-2">{m.complete}</td>
                      <td className="p-2">{m.completeLate}</td>
                      <td className="p-2">{m.partial}</td>
                      <td className="p-2">{m.missing}</td>
                      <td className="p-2">{m.exportableDays}</td>
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
                <Button size="sm" variant="outline" onClick={() => setTab("roster")}>Open roster</Button>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Partial or missing day (today)</p>
              <ul className="space-y-1 text-sm">
                {needsAttention.partialToday.slice(0, 20).map((p, i) => (
                  <li key={`${p.userId}-${i}`} className="flex items-center justify-between gap-2">
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      {statusBadge(p.status)}
                      <Button size="sm" variant="outline" onClick={() => { setTab("manual"); setDailyOverride((d) => ({ ...d, userId: p.userId, status: "completed" })) }}>Add correction</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Not exportable today</p>
              <ul className="space-y-1 text-sm">
                {needsAttention.notExportable.slice(0, 15).map((p, i) => (
                  <li key={`${p.userId}-ne-${i}`} className="flex items-center justify-between">
                    <span>{p.name}</span>
                    {statusBadge(p.status)}
                  </li>
                ))}
              </ul>
            </div>
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
              <p className="text-sm font-semibold mb-2">Late checkpoint today</p>
              <ul className="space-y-1 text-sm">
                {needsAttention.lateToday.slice(0, 15).map((r, i) => (
                  <li key={`${r.user_id}-${i}`} className="flex items-center justify-between">
                    <span>{r.display_name || r.username || r.user_id}</span>
                    <Badge className="bg-warning text-warning-foreground">{r.checkpoint_label || r.checkpoint_key}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-semibold mb-2">Partial days this week</p>
              <ul className="space-y-1 text-sm">
                {needsAttention.incompleteWeek.slice(0, 12).map((w) => (
                  <li key={w.student.id} className="flex items-center justify-between">
                    <span>{w.student.preferred_name || w.student.full_name}</span>
                    <Badge variant="secondary">{w.partialDays} partial</Badge>
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
                  <Dialog open={syncDialogOpen} onOpenChange={(open) => { 
                    setSyncDialogOpen(open); 
                    if (!open) { 
                      setSyncSummary(null); 
                      setSyncError(null); 
                      setMirrorAcknowledged(false); 
                      setShowAdvancedSync(false); 
                      setSyncMode("append") 
                    } else {
                      void fetchRoles()
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setSyncCohortId(selectedCohortId === "all" ? "" : selectedCohortId); setSyncSummary(null); setSyncError(null); setSyncMode("append"); setMirrorAcknowledged(false); setShowAdvancedSync(false); void fetchRoles(); }}>
                        <Cloud className="h-3.5 w-3.5" />
                        Sync from Discord
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Sync students from Discord</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Select the Discord role assigned to students. Only members with this role will be added to the roster.
                      </p>
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Student role</label>
                          {syncRolesLoading ? (
                            <div className="text-sm text-muted-foreground h-9 flex items-center border border-border rounded-md px-3 bg-muted/30">Loading roles...</div>
                          ) : syncRoles.length === 0 ? (
                            <div className="text-sm text-destructive h-9 flex items-center border border-destructive/30 rounded-md px-3 bg-destructive/10">Could not load Discord roles. Make sure the bot can view this server.</div>
                          ) : (
                            <Select value={syncSelectedRoleId || "none"} onValueChange={(v) => {
                              const val = v === "none" ? null : v;
                              setSyncSelectedRoleId(val);
                              if (val) localStorage.setItem(`syncRole_${selectedGuildId}`, val);
                              else localStorage.removeItem(`syncRole_${selectedGuildId}`);
                            }}>
                              <SelectTrigger><SelectValue placeholder="Choose the Discord role that represents students" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" disabled>Choose the Discord role that represents students...</SelectItem>
                                {syncRoles.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    <div className="flex items-center gap-2 w-full justify-between pr-4">
                                      <span className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color && r.color !== '#000000' ? r.color : '#99aab5' }} />
                                        {r.name}
                                      </span>
                                      {r.memberCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">{r.memberCount} members</span>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Cohort</label>
                          <Select value={syncCohortId || "default"} onValueChange={(v) => setSyncCohortId(v === "default" ? "" : v)}>
                            <SelectTrigger><SelectValue placeholder="Active/default cohort" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Active / default cohort</SelectItem>
                              {cohorts.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Sync mode</label>
                          <div className="rounded-md border border-border p-3 space-y-2">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="radio" name="syncMode" checked={syncMode === "append"} onChange={() => setSyncMode("append")} />
                              <span><strong>Append / update only</strong> <span className="text-muted-foreground">(recommended)</span></span>
                            </label>
                            <p className="text-xs text-muted-foreground pl-6">Creates new students and updates existing ones. Never deactivates anyone.</p>
                            {!showAdvancedSync ? (
                              <button type="button" className="text-xs text-muted-foreground underline pl-0 mt-1" onClick={() => setShowAdvancedSync(true)}>Show advanced options…</button>
                            ) : (
                              <>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input type="radio" name="syncMode" checked={syncMode === "mirror"} onChange={() => setSyncMode("mirror")} />
                                  <span><strong>Mirror Student role</strong> <Badge variant="destructive" className="ml-1 text-[10px]">Advanced</Badge></span>
                                </label>
                                <p className="text-xs text-muted-foreground pl-6">Creates/updates Student role members <strong>and deactivates</strong> roster students who no longer have the Student role.</p>
                                {syncMode === "mirror" && (
                                  <label className="flex items-start gap-2 text-xs bg-destructive/10 border border-destructive/30 rounded-md p-2 ml-6 cursor-pointer">
                                    <input type="checkbox" checked={mirrorAcknowledged} onChange={(e) => setMirrorAcknowledged(e.target.checked)} className="mt-0.5" />
                                    <span>I understand this may deactivate roster students who no longer have the Student role.</span>
                                  </label>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {syncSummary && (
                        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1 mt-2">
                          <p className="font-semibold text-foreground">Sync complete</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                            <span className="text-muted-foreground">Scanned members</span><span>{syncSummary.scannedMembers}</span>
                            <span className="text-muted-foreground">Matched Student role</span><span>{syncSummary.matchedStudentRole}</span>
                            <span className="text-muted-foreground">Created</span><span className="text-emerald-600 font-medium">{syncSummary.created}</span>
                            <span className="text-muted-foreground">Updated</span><span>{syncSummary.updated}</span>
                            <span className="text-muted-foreground">Linked to cohort</span><span>{syncSummary.linked}</span>
                            {syncSummary.deactivated > 0 && (<><span className="text-muted-foreground">Deactivated</span><span className="text-destructive font-medium">{syncSummary.deactivated}</span></>)}
                            <span className="text-muted-foreground">Skipped (bots)</span><span>{syncSummary.skippedBots}</span>
                            <span className="text-muted-foreground">Skipped (no Student role)</span><span>{syncSummary.skippedNoStudentRole}</span>
                          </div>
                          {syncSummary.warnings.length > 0 && (
                            <div className="mt-1 text-xs text-amber-600">{syncSummary.warnings.join(" ")}</div>
                          )}
                          {syncSummary.errors.length > 0 && (
                            <div className="mt-1 text-xs text-destructive">{syncSummary.errors.length} error(s)</div>
                          )}
                        </div>
                      )}
                      {syncError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm mt-2 flex gap-2 text-destructive items-start">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>{syncError}</p>
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
                        <Button size="sm" disabled={syncing || (syncMode === "mirror" && !mirrorAcknowledged) || !syncSelectedRoleId} onClick={() => void runDiscordSync()}>
                          {syncing ? "Syncing…" : "Sync now"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
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
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left p-2">Full Name</th>
                      <th className="text-left p-2">Preferred Name</th>
                      <th className="text-left p-2">Discord Username</th>
                      <th className="text-left p-2">Discord User ID</th>
                      <th className="text-left p-2">Duty Station</th>
                      <th className="text-left p-2">Source</th>
                      <th className="text-left p-2">Active</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {students.map((s) => {
                      const src = s.source || "manual"
                      const srcLabel = src === "discord_sync" ? "Discord Sync" : src === "discord_checkin_auto" ? "Auto Check-in" : "Manual"
                      const srcVariant = src === "discord_sync" ? "default" : src === "discord_checkin_auto" ? "secondary" : "outline"
                      return (
                      <tr key={s.id}>
                        <td className="p-2">{s.full_name}</td>
                        <td className="p-2">{s.preferred_name || "—"}</td>
                        <td className="p-2">{s.discord_username || "—"}</td>
                        <td className="p-2 font-mono text-xs">{s.discord_user_id || "—"}</td>
                        <td className="p-2">{s.duty_station || "Remote"}</td>
                        <td className="p-2">
                          <div className="flex flex-col gap-0.5">
                            <Badge variant={srcVariant as any} className="text-[10px] w-fit">{srcLabel}</Badge>
                            {s.last_synced_at && <span className="text-[10px] text-muted-foreground">{formatDateShort(s.last_synced_at)}</span>}
                          </div>
                        </td>
                        <td className="p-2">{s.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</td>
                        <td className="p-2">
                          <div className="flex gap-1">
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
                            {s.active ? (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void toggleStudentActive(s.id, false)}>Deactivate</Button>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => void toggleStudentActive(s.id, true)}>Reactivate</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3">
            {manualTabNotice ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  manualTabNotice.kind === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                )}
              >
                {manualTabNotice.text}
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold">Checkpoint correction</p>
              <p className="text-xs text-muted-foreground">Sets or updates a single checkpoint row for a student and date.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ManualStudentCombobox
                  students={students}
                  valueId={manualStudentId}
                  onValueIdChange={(id) => setManualStudentId(id)}
                  disabled={!selectedGuildId}
                  placeholder="Select student…"
                />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Select value={manual.checkpointKey || "none"} onValueChange={(v) => setManual((m) => ({ ...m, checkpointKey: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Checkpoint" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select checkpoint</SelectItem>
                    {activeDefs.map((d) => (
                      <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                    ))}
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
                    <SelectItem value="completed">completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Signature / confirmation text" value={manual.signatureText} onChange={(e) => setManual((m) => ({ ...m, signatureText: e.target.value }))} />
              <Input placeholder="Notes / reason" value={manual.notes} onChange={(e) => setManual((m) => ({ ...m, notes: e.target.value }))} />
              <Button size="sm" onClick={() => void saveManual()}>Save checkpoint correction</Button>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <p className="text-sm font-semibold">Daily override</p>
              <p className="text-xs text-muted-foreground">
                Use when a student forgot a checkpoint but the day should still count for the official sheet. This does not delete raw checkpoint events.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ManualStudentCombobox
                  students={students}
                  valueId={dailyOverrideStudentId}
                  onValueIdChange={(id) => setDailyOverrideStudentId(id)}
                  disabled={!selectedGuildId}
                  placeholder="Select student…"
                />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <Select value={dailyOverride.status} onValueChange={(v) => setDailyOverride((d) => ({ ...d, status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Daily status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">completed</SelectItem>
                    <SelectItem value="manual">manual</SelectItem>
                    <SelectItem value="present">present</SelectItem>
                    <SelectItem value="late">late</SelectItem>
                    <SelectItem value="excused">excused</SelectItem>
                    <SelectItem value="missing">missing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Input placeholder="Signature text for sheet" value={dailyOverride.signatureText} onChange={(e) => setDailyOverride((d) => ({ ...d, signatureText: e.target.value }))} />
              <Input placeholder="Notes / reason" value={dailyOverride.notes} onChange={(e) => setDailyOverride((d) => ({ ...d, notes: e.target.value }))} />
              <Button size="sm" variant="secondary" onClick={() => void saveDailyOverride()}>Save daily override</Button>
            </div>
          </TabsContent>

          <TabsContent value="official" className="space-y-3">
            {selectedGuildId ? (
              <OfficialSheetsPanel
                guildId={selectedGuildId}
                cohorts={cohorts}
                selectedCohortId={selectedCohortId}
                onCohortChange={setSelectedCohortId}
                refreshNonce={officialSheetsRefreshNonce}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="settings" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Checkpoint schedule</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Changing a checkpoint key after creation is risky; labels and times are safe to edit. Delete with records deactivates instead of removing history.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={async () => {
                    if (!selectedGuildId) return
                    const res = await apiFetch("/api/attendance/settings/restore-defaults", { method: "POST", body: JSON.stringify({ guildId: selectedGuildId }) })
                    if (!res.ok) setError(res.error ?? "Restore failed")
                    await load(true)
                  }}>Restore default checkpoints</Button>
                  <Button size="sm" onClick={() => void addCheckpoint()}>Add checkpoint</Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {allDefs.map((d) => (
                  <CheckpointEditor
                    key={d.id}
                    def={d}
                    onSave={saveCheckpoint}
                    onDeactivate={async (id) => {
                      if (!selectedGuildId) return
                      const res = await apiFetch(`/api/attendance/settings/checkpoints/${id}/deactivate`, {
                        method: "POST",
                        body: JSON.stringify({ guildId: selectedGuildId }),
                      })
                      if (!res.ok) setError(res.error ?? "Deactivate failed")
                      await load(true)
                    }}
                    onMove={async (orderedIds) => {
                      if (!selectedGuildId) return
                      const res = await apiFetch("/api/attendance/settings/checkpoints/reorder", {
                        method: "POST",
                        body: JSON.stringify({ guildId: selectedGuildId, orderedIds }),
                      })
                      if (!res.ok) setError(res.error ?? "Reorder failed")
                      await load(true)
                    }}
                    allDefs={allDefs}
                  />
                ))}
              </div>
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
  onDeactivate,
  onMove,
  allDefs,
}: {
  def: CheckpointDef
  onSave: (d: CheckpointDef) => Promise<void>
  onDeactivate: (id: number) => Promise<void>
  onMove: (orderedIds: number[]) => Promise<void>
  allDefs: CheckpointDef[]
}) {
  const [local, setLocal] = useState(def)
  useEffect(() => setLocal(def), [def])

  const move = (dir: -1 | 1) => {
    const sorted = [...allDefs].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((x) => x.id === def.id)
    const j = idx + dir
    if (idx < 0 || j < 0 || j >= sorted.length) return
    const next = [...sorted]
    const t = next[idx]
    next[idx] = next[j]
    next[j] = t
    void onMove(next.map((d) => d.id))
  }

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-mono text-muted-foreground">key: {local.key}</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={() => move(-1)}>Up</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => move(1)}>Down</Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => void onDeactivate(local.id)}>Deactivate</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input value={local.label} onChange={(e) => setLocal({ ...local, label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Command type</label>
          <Select value={local.commandType} onValueChange={(v) => setLocal({ ...local, commandType: v as "checkin" | "checkout" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="checkin">checkin</SelectItem>
              <SelectItem value="checkout">checkout</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Target time (HH:mm)</label>
          <Input value={local.targetTime} onChange={(e) => setLocal({ ...local, targetTime: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Opens before (min)</label>
          <Input value={String(local.opensBeforeMinutes)} onChange={(e) => setLocal({ ...local, opensBeforeMinutes: Number(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Late after (min)</label>
          <Input value={String(local.lateAfterMinutes)} onChange={(e) => setLocal({ ...local, lateAfterMinutes: Number(e.target.value) || 0 })} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Closes after (min, empty = end of day)</label>
          <Input
            value={local.closesAfterMinutes == null ? "" : String(local.closesAfterMinutes)}
            onChange={(e) =>
              setLocal({
                ...local,
                closesAfterMinutes: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={local.allowLateSubmission} onChange={(e) => setLocal({ ...local, allowLateSubmission: e.target.checked })} />
          Accept late submissions
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={local.required} onChange={(e) => setLocal({ ...local, required: e.target.checked })} />
          Required for daily completion
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={local.includeInOfficialCompletion !== false} onChange={(e) => setLocal({ ...local, includeInOfficialCompletion: e.target.checked })} />
          Include in official completion
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={local.active} onChange={(e) => setLocal({ ...local, active: e.target.checked })} />
          Active
        </label>
      </div>
      <Button size="sm" variant="outline" onClick={() => void onSave(local)}>Save checkpoint</Button>
    </div>
  )
}

