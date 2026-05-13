"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { RosterStudentRow } from "@/lib/rosterStudentUtils"
import { rosterStudentSearchHaystack } from "@/lib/rosterStudentUtils"

function secondaryLine(s: RosterStudentRow): string {
  const parts = [s.discord_username, s.student_code, s.discord_user_id].filter(
    (x) => x != null && String(x).trim() !== ""
  )
  return parts.length ? parts.map(String).join(" · ") : "—"
}

export function ManualStudentCombobox({
  students,
  valueId,
  onValueIdChange,
  disabled,
  placeholder = "Select student…",
}: {
  students: RosterStudentRow[]
  valueId: number | null
  onValueIdChange: (id: number | null, student: RosterStudentRow | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = valueId != null ? students.find((s) => s.id === valueId) ?? null : null
  const primary = selected ? selected.preferred_name || selected.full_name : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal min-h-10 h-auto py-2"
          disabled={disabled}
        >
          {selected ? (
            <span className="truncate text-left flex-1 min-w-0">
              <span className="block font-medium truncate">{primary}</span>
              <span className="block text-xs text-muted-foreground truncate">{secondaryLine(selected)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, Discord, email, code…" />
          <CommandList>
            <CommandEmpty>No students found. Add students in the Roster tab first.</CommandEmpty>
            <CommandGroup>
              {students.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.id} ${rosterStudentSearchHaystack(s)}`}
                  onSelect={() => {
                    onValueIdChange(s.id, s)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", valueId === s.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">{s.preferred_name || s.full_name}</span>
                    <span className="text-xs text-muted-foreground truncate">{secondaryLine(s)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
