// dashboard/app/api/sessions/active/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET() {
  try {
    const res = await fetch(`${BOT_API_URL}/sessions/active`, {
      headers: { 'x-api-key': BOT_API_KEY },
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bot offline', sessions: [] }, { status: 503 });
  }
}
