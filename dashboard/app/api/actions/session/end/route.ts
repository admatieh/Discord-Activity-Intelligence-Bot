// dashboard/app/api/actions/session/end/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function POST(req: NextRequest) {
  const execId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${BOT_API_URL}/actions/session/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BOT_API_KEY
      },
      body: JSON.stringify({ ...body, source: 'dashboard' }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });

  } catch (error: any) {
    const offline = error.name === 'AbortError' || error.code === 'ECONNREFUSED';
    return NextResponse.json({
      ok: false,
      action: 'session.end',
      error: offline ? 'Bot API is offline.' : error.message,
      executionId: execId
    }, { status: offline ? 503 : 500 });
  }
}
