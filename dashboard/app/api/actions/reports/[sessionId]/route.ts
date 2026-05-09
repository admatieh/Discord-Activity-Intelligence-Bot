// dashboard/app/api/actions/reports/[sessionId]/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const res = await fetch(`${BOT_API_URL}/actions/reports/${sessionId}`, {
      headers: { 'x-api-key': BOT_API_KEY },
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bot offline' }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const res = await fetch(`${BOT_API_URL}/actions/session/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': BOT_API_KEY },
      body: JSON.stringify({ sessionId: Number(sessionId), ...body })
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bot offline' }, { status: 503 });
  }
}
