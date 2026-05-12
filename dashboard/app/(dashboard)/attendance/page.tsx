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
import { Calendar, Download, RefreshCw, ClipboardCheck, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"

type AttendanceRow = {
  id?: number
  user_id: string
  username?: string
  display_name?: string
  duty_station?: string
  attendance_date: string
  checkpoint_key: "morning_checkin" | "midday_checkin" | "checkout" | string
  checkpoint_label?: string
  status: "present" | "late" | "missing" | "completed" | "manual" | "excused" | string
  checked_at?: string
  local_checked_at?: string
}

type TodayPayload = { ok?: boolean; attendanceDate?: string; rows?: unknown[]; error?: string }
type MissingPayload = { ok?: boolean; date?: string; missing?: unknown[]; error?: string }
type MissingItem = { userId: string; name: string; checkpointKey: string; attendanceDate: string }
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

function statusBadge(status: string | undefined) {
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

export default function AttendancePage() {
  const { selectedGuildId } = useWorkspace()

  const [date, setDate] = useState(isoDateToday())
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [missing, setMissing] = useState<MissingItem[]>([])
  const [defs, setDefs] = useState<CheckpointDef[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [csvText, setCsvText] = useState("")
  const [importPreview, setImportPreview] = useState<Array<{ rowNumber: number; status: string; error?: string | null }>>([])
  const [manual, setManual] = useState({
    userId: "",
    displayName: "",
    checkpointKey: "",
    status: "manual",
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

      const [todayRes, missingRes, settingsRes] = await Promise.all([
        apiFetch<TodayPayload>(`/api/attendance/today?guildId=${selectedGuildId}&date=${date}`),
        apiFetch<MissingPayload>(`/api/attendance/missing?guildId=${selectedGuildId}&date=${date}`),
        apiFetch<{ definitions?: CheckpointDef[] }>(`/api/attendance/settings?guildId=${selectedGuildId}`),
      ])

      if (!todayRes.ok) {
        setError(todayRes.error ?? "Could not load attendance.")
        setRows([])
      } else {
        const payload = todayRes.data
        const list = safeArray<AttendanceRow>((payload as TodayPayload)?.rows)
        setRows(list)
      }

      if (missingRes.ok) {
        const payload = missingRes.data as MissingPayload
        const list = safeArray<MissingItem>(payload?.missing)
        setMissing(list)
      } else {
        setMissing([])
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

      setLoading(false)
      setRefreshing(false)
    },
    [selectedGuildId, date, manual.checkpointKey]
  )

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

  async function downloadCsv() {
    if (!selectedGuildId) return
    const res = await apiFetch<{ ok?: boolean; csv?: string; error?: string }>(
      `/api/attendance/export?guildId=${selectedGuildId}&startDate=${date}&endDate=${date}`
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
    a.download = `attendance_${date}.csv`
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
    const res = await apiFetch<{ rows?: Array<{ rowNumber: number; status: string; error?: string | null }> }>(
      "/api/attendance/import/preview",
      { method: "POST", body: JSON.stringify({ guildId: selectedGuildId, csvText }) }
    )
    if (!res.ok) {
      setError(res.error ?? "Import preview failed.")
      setImportPreview([])
      return
    }
    setImportPreview(safeArray((res.data as any)?.rows))
  }

  async function commitImport() {
    if (!selectedGuildId) return
    const res = await apiFetch("/api/attendance/import/commit", {
      method: "POST",
      body: JSON.stringify({ guildId: selectedGuildId, csvText, importedBy: "dashboard" }),
    })
    if (!res.ok) setError(res.error ?? "Import commit failed.")
    await load(true)
  }

  async function saveManual() {
    if (!selectedGuildId) return
    const res = await apiFetch("/api/attendance/manual", {
      method: "POST",
      body: JSON.stringify({
        guildId: selectedGuildId,
        userId: manual.userId,
        displayName: manual.displayName || undefined,
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
            <Button size="sm" className="gap-1.5" onClick={() => void downloadCsv()}>
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
        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
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

          {!loading && missing.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Missing checkpoints</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                This is based on the roster inferred from existing attendance records for the day.
              </p>
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
            <p className="text-sm font-semibold">Weekly review</p>
            <p className="text-xs text-muted-foreground mt-1">
              Weekly matrix is based on required checkpoints. Use export for detailed administrative sheets.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void load(true)}>Refresh week data</Button>
          </TabsContent>

          <TabsContent value="month" className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm font-semibold">Monthly sheets</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use CSV export for monthly submissions. Word/PDF import remains experimental; convert to CSV first.
            </p>
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
              <p className="text-sm font-semibold">CSV import</p>
              <p className="text-xs text-muted-foreground">
                Paste CSV contents, preview rows, then commit. For best results convert Word/PDF sheets to CSV first.
              </p>
              <textarea
                className="w-full min-h-40 rounded-md border border-border bg-background p-3 text-xs font-mono"
                placeholder="Student Name,Duty Station,Date,Checkpoint,Status,Time,Signature / Confirmation,Notes"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void previewImport()}>
                  <Upload className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button size="sm" onClick={() => void commitImport()}>Commit import</Button>
              </div>
              {importPreview.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {importPreview.slice(0, 10).map((r) => (
                    <li key={r.rowNumber} className="flex items-center justify-between">
                      <span>Row {r.rowNumber}</span>
                      <span className={cn(r.status === "imported" ? "text-success" : "text-warning-foreground")}>
                        {r.status}{r.error ? `: ${r.error}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <p className="text-sm font-semibold">Manual correction</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="User ID" value={manual.userId} onChange={(e) => setManual((m) => ({ ...m, userId: e.target.value }))} />
                <Input placeholder="Display name" value={manual.displayName} onChange={(e) => setManual((m) => ({ ...m, displayName: e.target.value }))} />
                <Input placeholder="Checkpoint key" value={manual.checkpointKey} onChange={(e) => setManual((m) => ({ ...m, checkpointKey: e.target.value }))} />
                <Input placeholder="Status (present/late/excused/manual)" value={manual.status} onChange={(e) => setManual((m) => ({ ...m, status: e.target.value }))} />
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

