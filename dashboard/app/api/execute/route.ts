import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

type BotExecuteBody = {
  success?: boolean
  requestId?: string
  data?: {
    output?: string
    exitCode?: number
    logs?: string[]
    executionMs?: number
    timestamp?: string
  }
  error?: string | null
}

export type ExecuteResponseData = {
  success: boolean
  output: string
  message: string
  logs: string[]
  requestId?: string
  executor: BotExecuteBody["data"] | null
  raw: unknown
}

function buildExecutePayload(
  result: Awaited<ReturnType<typeof botPost<BotExecuteBody>>>
): { success: boolean; body: ExecuteResponseData } {
  const botBody =
    result.ok && result.data && typeof result.data === "object"
      ? (result.data as BotExecuteBody)
      : !result.ok && result.data && typeof result.data === "object"
        ? (result.data as BotExecuteBody)
        : null

  const exec = botBody?.data
  const success = Boolean(
    result.ok &&
      botBody?.success === true &&
      (exec?.exitCode === undefined || exec.exitCode === 0)
  )
  const output =
    typeof exec?.output === "string"
      ? exec.output
      : typeof botBody?.error === "string" && botBody.error
        ? botBody.error
        : result.error ?? "Command failed"

  const logs = Array.isArray(exec?.logs) ? exec.logs.map(String) : []

  const body: ExecuteResponseData = {
    success,
    output: output || (success ? "Done." : ""),
    message: success
      ? "Command completed successfully."
      : result.error ?? output,
    logs,
    requestId: botBody?.requestId,
    executor: exec ?? null,
    raw: botBody ?? { details: result.details },
  }

  return { success, body }
}

export async function POST(request: Request) {
  const requestBody = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const textId = requestBody.textChannelId ?? requestBody.channelId
  const voiceId = requestBody.voiceChannelId
  const forward = {
    command: requestBody.command,
    args: requestBody.args,
    requestId: requestBody.requestId,
    guildId: requestBody.guildId,
    textChannelId: typeof textId === "string" ? textId : undefined,
    voiceChannelId: typeof voiceId === "string" ? voiceId : undefined,
    channelId:
      typeof textId === "string"
        ? textId
        : typeof voiceId === "string"
          ? voiceId
          : undefined,
  }

  const result = await botPost<BotExecuteBody>("/execute", forward)
  const { success, body: executeData } = buildExecutePayload(result)

  return NextResponse.json(
    {
      ok: success,
      data: executeData,
      error: success ? undefined : executeData.message,
    },
    { status: success ? 200 : 400 }
  )
}
