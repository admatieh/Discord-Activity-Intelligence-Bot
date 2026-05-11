"use client"

import { useState, useEffect } from "react"

interface BotStatus {
  bot: "online" | "offline" | "checking"
  db: "connected" | "disconnected" | "checking"
}

export function useBotStatus() {
  const [status, setStatus] = useState<BotStatus>({
    bot: "checking",
    db: "checking",
  })

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/system/health", { cache: "no-store" })
        const json = await res.json()
        setStatus({
          bot: json?.ok ? "online" : "offline",
          db: json?.data?.database?.connected ? "connected" : "disconnected",
        })
      } catch {
        setStatus({ bot: "offline", db: "disconnected" })
      }
    }

    check()
    const interval = setInterval(check, 30_000)
    return () => clearInterval(interval)
  }, [])

  return { status }
}
