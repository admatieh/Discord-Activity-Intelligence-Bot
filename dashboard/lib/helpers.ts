import type { ApiResponse } from "./types"

// ─── Safe array ───────────────────────────────────────────────────────────────

export function safeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

// ─── Error message ────────────────────────────────────────────────────────────

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  return "An unexpected error occurred"
}

// ─── Date / time ─────────────────────────────────────────────────────────────
export * from "./time"

// ─── Status ───────────────────────────────────────────────────────────────────

export function formatStatus(status: string | undefined | null): string {
  if (!status) return "Unknown"
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

// ─── API fetch helper (client-side) ──────────────────────────────────────────

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    })
    const json = (await res.json()) as ApiResponse<T> & Record<string, unknown>
    if (!res.ok && json.ok === undefined) {
      return {
        ok: false,
        error:
          (typeof json.error === "string" && json.error) ||
          `Request failed (${res.status})`,
        details: typeof json.details === "string" ? json.details : undefined,
        data: json.data as T | undefined,
      }
    }
    return json as ApiResponse<T>
  } catch (err) {
    return {
      ok: false,
      error: "Network error",
      details: getErrorMessage(err),
    }
  }
}

// ─── cn (re-export) ───────────────────────────────────────────────────────────
export { cn } from "./utils"
