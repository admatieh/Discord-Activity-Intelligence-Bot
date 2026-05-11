import type { ApiResponse } from "@/lib/types"
import { getErrorMessage } from "@/lib/helpers"

export function normalizeResponse<T>(json: unknown): ApiResponse<T> {
  if (!json || typeof json !== "object") {
    return { ok: false, error: "Invalid response" }
  }
  const o = json as ApiResponse<T>
  if (typeof o.ok === "boolean") return o
  return { ok: false, error: "Unexpected response shape" }
}

export async function dashboardFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    })
    const json = (await res.json()) as unknown
    return normalizeResponse<T>(json)
  } catch (e) {
    return { ok: false, error: "Network error", details: getErrorMessage(e) }
  }
}
