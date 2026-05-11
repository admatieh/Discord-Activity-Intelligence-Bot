import type { ApiResponse } from "@/lib/types"

const BOT_API_URL = process.env.BOT_API_URL ?? "http://127.0.0.1:4000/api"
const BOT_API_KEY = process.env.BOT_API_KEY ?? "local_dashboard_key_123"
const DEFAULT_TIMEOUT_MS = 12_000

function buildHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-api-key": BOT_API_KEY,
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "")
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { _raw: text }
  }
}

export function normalizeBotError(err: unknown): { error: string; details?: string } {
  const message = err instanceof Error ? err.message : "Unknown error"
  const isOffline =
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("ENOTFOUND")
  return {
    error: isOffline ? "Bot API is offline" : "Request failed",
    details: message,
  }
}

/** @deprecated Prefer typed responses from route handlers */
export function proxyBotResponse<T>(result: ApiResponse<T>): ApiResponse<T> {
  return result
}

export async function botGet<T = unknown>(
  path: string,
  options?: { timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const url = `${BOT_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: buildHeaders(),
        cache: "no-store",
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )

    const body = (await parseBody(res)) as T

    if (!res.ok) {
      const errObj = body && typeof body === "object" ? (body as { error?: string }) : null
      return {
        ok: false,
        error: errObj?.error ?? `Bot API returned ${res.status}`,
        details: typeof body === "object" ? JSON.stringify(body) : String(body),
      }
    }

    return { ok: true, data: body }
  } catch (err) {
    const { error, details } = normalizeBotError(err)
    return { ok: false, error, details }
  }
}

export async function botPost<T = unknown>(
  path: string,
  body?: unknown,
  options?: { timeoutMs?: number }
): Promise<ApiResponse<T>> {
  const url = `${BOT_API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    )

    const parsed = (await parseBody(res)) as T

    if (!res.ok) {
      const errObj = parsed && typeof parsed === "object" ? (parsed as { error?: string }) : null
      return {
        ok: false,
        error: errObj?.error ?? `Bot API returned ${res.status}`,
        details: typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed),
        ...(parsed && typeof parsed === "object" ? { data: parsed as T } : {}),
      }
    }

    return { ok: true, data: parsed }
  } catch (err) {
    const { error, details } = normalizeBotError(err)
    return { ok: false, error, details }
  }
}

/** Aliases matching integration spec naming */
export const botApiGet = botGet
export const botApiPost = botPost
