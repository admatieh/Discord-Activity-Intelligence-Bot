"use client"

import { Building2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspace } from "@/components/providers/workspace-context"

export function GuildSelector() {
  const {
    guilds,
    guildsLoading,
    selectedGuildId,
    setSelectedGuildId,
  } = useWorkspace()

  return (
    <div className="px-3 pb-2">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Server
      </p>
      <Select
        value={selectedGuildId || undefined}
        onValueChange={setSelectedGuildId}
        disabled={guildsLoading || guilds.length === 0}
      >
        <SelectTrigger className="h-8 text-xs bg-sidebar-accent/30 border-border/60">
          <Building2 className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
          <SelectValue placeholder={guildsLoading ? "Loading…" : "Select server…"} />
        </SelectTrigger>
        <SelectContent>
          {guilds.map((g) => (
            <SelectItem key={g.id} value={g.id} className="text-xs">
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
