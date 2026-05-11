"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { apiFetch, safeArray } from "@/lib/helpers"
import type { Guild } from "@/lib/types"

const STORAGE_KEY = "instructor-dashboard.guildId"

interface WorkspaceContextValue {
  guilds: Guild[]
  guildsLoading: boolean
  guildsError: string | null
  selectedGuildId: string
  selectedGuild: Guild | null
  setSelectedGuildId: (id: string) => void
  refreshGuilds: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [guildsLoading, setGuildsLoading] = useState(true)
  const [guildsError, setGuildsError] = useState<string | null>(null)
  const [selectedGuildId, setSelectedGuildIdState] = useState("")

  const refreshGuilds = useCallback(async () => {
    setGuildsLoading(true)
    setGuildsError(null)
    const res = await apiFetch<Guild[]>("/api/discord/guilds")
    if (res.ok) {
      const list = safeArray<Guild>(res.data)
      setGuilds(list)
      setSelectedGuildIdState((current) => {
        if (current && list.some((g) => g.id === current)) return current
        const stored =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null
        if (stored && list.some((g) => g.id === stored)) return stored
        if (list.length === 1) return list[0].id
        return ""
      })
    } else {
      setGuilds([])
      setGuildsError(res.error ?? "Could not load servers")
    }
    setGuildsLoading(false)
  }, [])

  useEffect(() => {
    void refreshGuilds()
  }, [refreshGuilds])

  const setSelectedGuildId = useCallback((id: string) => {
    setSelectedGuildIdState(id)
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id)
      else window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const selectedGuild = useMemo(
    () => guilds.find((g) => g.id === selectedGuildId) ?? null,
    [guilds, selectedGuildId]
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      guilds,
      guildsLoading,
      guildsError,
      selectedGuildId,
      selectedGuild,
      setSelectedGuildId,
      refreshGuilds,
    }),
    [
      guilds,
      guildsLoading,
      guildsError,
      selectedGuildId,
      selectedGuild,
      setSelectedGuildId,
      refreshGuilds,
    ]
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return ctx
}
