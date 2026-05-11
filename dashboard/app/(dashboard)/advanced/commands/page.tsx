"use client"

import { useState, useEffect, useMemo } from "react"
import { BookOpen, Search, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import PageHeader from "@/components/layout/PageHeader"
import EmptyState from "@/components/states/EmptyState"
import ErrorPanel from "@/components/states/ErrorPanel"
import LoadingState from "@/components/states/LoadingState"
import StatusBadge from "@/components/ui/status-badge"
import { apiFetch, safeArray } from "@/lib/helpers"
import type { Command } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [expandedName, setExpandedName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const res = await apiFetch("/api/commands")
      if (res.ok) {
        setCommands(safeArray(res.data))
      } else {
        setError(res.error ?? "Could not load commands.")
      }
      setLoading(false)
    }
    load()
  }, [])

  const categories = useMemo(() => {
    const cats = new Set(commands.map((c) => c.category ?? "General"))
    return ["All", ...Array.from(cats).sort()]
  }, [commands])

  const [selectedCategory, setSelectedCategory] = useState("All")

  const filtered = useMemo(() => {
    let list = commands
    if (selectedCategory !== "All") {
      list = list.filter((c) => (c.category ?? "General") === selectedCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q) ||
          (c.aliases ?? []).some((a) => a.toLowerCase().includes(q))
      )
    }
    return list
  }, [commands, selectedCategory, search])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Command Explorer"
        description="Browse all available bot commands and their parameters."
      />

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search commands…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                selectedCategory === cat
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading commands…" />
      ) : error ? (
        <ErrorPanel message={error} offline={error.includes("offline")} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No commands found"
          description={search ? "Try a different search term." : "No commands available."}
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((cmd) => (
            <CommandCard
              key={cmd.name}
              cmd={cmd}
              expanded={expandedName === cmd.name}
              onToggle={() =>
                setExpandedName(expandedName === cmd.name ? null : cmd.name)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CommandCard({
  cmd,
  expanded,
  onToggle,
}: {
  cmd: Command
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-muted/30"
        onClick={onToggle}
      >
        <code className="text-sm font-mono font-medium text-foreground min-w-0 flex-1">
          /{cmd.name}
        </code>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {cmd.category && (
            <span className="text-xs text-muted-foreground">{cmd.category}</span>
          )}
          {cmd.supportsDashboard && (
            <StatusBadge status="success" label="Dashboard" />
          )}
          {cmd.requiredPermission && (
            <StatusBadge status="warning" label={cmd.requiredPermission} />
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-4 bg-muted/10 space-y-3">
          {cmd.description && (
            <p className="text-sm text-foreground">{cmd.description}</p>
          )}

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {cmd.aliases && cmd.aliases.length > 0 && (
              <InfoRow label="Aliases" value={cmd.aliases.map((a) => `/${a}`).join(", ")} />
            )}
            {cmd.usage && (
              <InfoRow label="Usage" value={cmd.usage} mono />
            )}
            {cmd.requiresGuild !== undefined && (
              <InfoRow label="Requires guild" value={cmd.requiresGuild ? "Yes" : "No"} />
            )}
            {cmd.requiresVoiceChannel !== undefined && (
              <InfoRow label="Requires voice" value={cmd.requiresVoiceChannel ? "Yes" : "No"} />
            )}
            {cmd.requiresTextChannel !== undefined && (
              <InfoRow label="Requires text" value={cmd.requiresTextChannel ? "Yes" : "No"} />
            )}
          </div>

          {cmd.options && cmd.options.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Options</p>
              <div className="space-y-1.5">
                {cmd.options.map((opt) => (
                  <div
                    key={opt.name}
                    className="flex items-start gap-3 rounded-md bg-muted px-3 py-2"
                  >
                    <code className="text-xs font-mono text-foreground shrink-0">{opt.name}</code>
                    <span className="text-xs text-muted-foreground">{opt.type}</span>
                    {opt.required && (
                      <span className="text-xs text-destructive ml-auto shrink-0">required</span>
                    )}
                    {opt.description && (
                      <p className="text-xs text-muted-foreground ml-auto">{opt.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={cn("text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  )
}
