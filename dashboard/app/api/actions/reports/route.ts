// dashboard/app/api/actions/reports/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get('guildId')) params.set('guildId', searchParams.get('guildId')!);
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit')!);

    const res = await fetch(`${BOT_API_URL}/actions/reports?${params.toString()}`, {
      headers: { 'x-api-key': BOT_API_KEY },
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'Bot offline', reports: [] }, { status: 503 });
  }
}
