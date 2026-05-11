import { dashboardFetch } from "./client"
import type { Command } from "@/lib/types"

export function fetchCommands() {
  return dashboardFetch<Command[]>("/api/commands")
}
