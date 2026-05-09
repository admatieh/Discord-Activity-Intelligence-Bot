// dashboard/app/api/actions/schedule/session/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${BOT_API_URL}/actions/schedule/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': BOT_API_KEY },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bot offline' }, { status: 503 });
  }
}
