import { NextResponse } from "next/server"
import { botPost } from "@/lib/server/botApi"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const result = await botPost(`/actions/schedule/${id}/run-now`)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
