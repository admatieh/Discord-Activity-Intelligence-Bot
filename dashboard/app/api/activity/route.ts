// dashboard/app/api/activity/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    if (searchParams.get('limit')) params.set('limit', searchParams.get('limit')!);
    if (searchParams.get('guildId')) params.set('guildId', searchParams.get('guildId')!);
    if (searchParams.get('sessionId')) params.set('sessionId', searchParams.get('sessionId')!);
    if (searchParams.get('type')) params.set('type', searchParams.get('type')!);

    const res = await fetch(`${BOT_API_URL}/activity?${params.toString()}`, {
      headers: { 'x-api-key': BOT_API_KEY },
      cache: 'no-store'
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: 'Bot offline or not reachable', feed: [] }, { status: 503 });
  }
}
